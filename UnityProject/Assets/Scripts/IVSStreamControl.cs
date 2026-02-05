using System.Collections;
using System.Collections.Generic;
using System;
using UnityEngine;
using UnityEngine.Networking;
using TMPro;
using UnityEngine.Events;
using Substream.Streaming;

/// <summary>
/// IVS Stream Control - RTMPS streaming to AWS IVS
/// 
/// This replaces WebRTC-based RenderStreamControl with RTMPS ingest to AWS IVS.
/// 
/// Key differences from WebRTC:
/// - Uses RTMPS protocol instead of WebRTC
/// - No signaling server needed
/// - 2-5 second latency (vs sub-second with WebRTC)
/// - Automatic recording to S3
/// - Better scalability and reliability
/// 
/// Uses FFmpeg native plugin for cross-platform RTMP publishing.
/// </summary>
public class IVSStreamControl : MonoBehaviour
{
    [Header("UI References")]
    public TMP_Text _statusText;
    public TMP_Text _errorText;
    
    [Header("Backend Configuration")]
    [Tooltip("Backend API URL for IVS infrastructure")]
    public string backendUrl = "http://localhost:3000";
    
    [Tooltip("Child ID for streaming (from your user system)")]
    public string childId = "child-profile-001";
    
    [Tooltip("Auth token for API calls")]
    public string authToken = "";
    
    [Header("Quality Settings")]
    [Tooltip("Stream resolution width")]
    public int streamWidth = 1280;
    
    [Tooltip("Stream resolution height")]  
    public int streamHeight = 720;
    
    [Tooltip("Stream bitrate in kbps")]
    public int streamBitrate = 3500;
    
    [Tooltip("Stream frame rate")]
    public int streamFrameRate = 30;
    
    [Tooltip("Keyframe interval in seconds (IVS requires 2)")]
    public int keyframeInterval = 2;
    
    [Header("Events")]
    public UnityEvent OnStartStreaming;
    public UnityEvent OnStopStreaming;
    public UnityEvent<string> OnError;
    
    [Header("Debug Info")]
    [SerializeField] private bool _useNativePublisher = true;
    [SerializeField] private int _framesSent;
    [SerializeField] private int _droppedFrames;
    [SerializeField] private float _bitrateMbps;
    
    // State
    private bool isStreaming = false;
    private string currentSessionId;
    private IngestConfig ingestConfig;
    
    // Stream components
    private Camera streamCamera;
    private RenderTexture streamTexture;
    
    // FFmpeg RTMP publisher
    private FFmpegRTMPPublisher ffmpegPublisher;
    
    // Fallback stub publisher
    private IRTMPPublisher stubPublisher;
    
    // Heartbeat
    private Coroutine heartbeatCoroutine;
    private float lastStatsUpdate;
    
    // ==========================================
    // DATA STRUCTURES
    // ==========================================
    
    [Serializable]
    public class IngestConfig
    {
        public string channelArn;
        public IngestInfo ingest;
        public EncoderConfig recommendedEncoderConfig;
    }
    
    [Serializable]
    public class IngestInfo
    {
        public string protocol;
        public string endpoint;
        public string streamKey;
    }
    
    [Serializable]
    public class EncoderConfig
    {
        public int maxWidth;
        public int maxHeight;
        public int maxFramerate;
        public int maxBitrateKbps;
        public int keyframeIntervalSeconds;
    }
    
    [Serializable]
    public class SessionResponse
    {
        public string sessionId;
    }
    
    [Serializable]
    public class ErrorResponse
    {
        public string error;
        public string code;
    }
    
    // ==========================================
    // LIFECYCLE
    // ==========================================
    
    void Start()
    {
        // Check for duplicate FFmpegRTMPPublisherBehaviour components
        var duplicatePublisher = FindObjectOfType<Substream.Streaming.FFmpegRTMPPublisherBehaviour>();
        if (duplicatePublisher != null)
        {
            Debug.LogWarning("╔════════════════════════════════════════════════════════════════╗");
            Debug.LogWarning("║  ⚠️  DUPLICATE COMPONENT DETECTED                               ║");
            Debug.LogWarning("║                                                                ║");
            Debug.LogWarning("║  FFmpegRTMPPublisherBehaviour found in scene.                  ║");
            Debug.LogWarning("║  This is NOT needed - IVSStreamControl handles streaming.     ║");
            Debug.LogWarning("║                                                                ║");
            Debug.LogWarning("║  Please REMOVE FFmpegRTMPPublisherBehaviour from your scene.  ║");
            Debug.LogWarning("║  Only IVSStreamControl should be used.                        ║");
            Debug.LogWarning("╚════════════════════════════════════════════════════════════════╝");
        }
        
        // Load auth token from PlayerPrefs if not set
        if (string.IsNullOrEmpty(authToken))
        {
            authToken = PlayerPrefs.GetString("AuthToken", "");
        }
        
        // Load child ID from PlayerPrefs if not set
        if (string.IsNullOrEmpty(childId) || childId == "child-profile-001")
        {
            childId = PlayerPrefs.GetString("ChildId", childId);
        }
        
        SetupStreamCamera();
        
        // Initialize RTMP publisher
        InitializeRTMPPublisher();
        
        UpdateStatus("Ready to stream");
    }
    
    void Update()
    {
        // Toggle streaming with U key (same as original)
        if (Input.GetKeyDown(KeyCode.U))
        {
            ToggleStreaming();
        }
        
        // Send frames while streaming
        if (isStreaming && ffmpegPublisher != null && ffmpegPublisher.IsStreaming)
        {
            ffmpegPublisher.SendFrame();
            
            // Update stats every second
            if (Time.time - lastStatsUpdate > 1f)
            {
                _framesSent = ffmpegPublisher.FramesSent;
                _droppedFrames = ffmpegPublisher.DroppedFrames;
                _bitrateMbps = (ffmpegPublisher.BytesSent * 8f) / (Time.realtimeSinceStartup * 1000000f);
                lastStatsUpdate = Time.time;
            }
        }
    }
    
    void OnDestroy()
    {
        if (isStreaming)
        {
            StopStreamingImmediate();
        }
        
        // Dispose FFmpeg publisher
        ffmpegPublisher?.Dispose();
        
        if (streamTexture != null)
        {
            streamTexture.Release();
            DestroyImmediate(streamTexture);
        }
    }
    
    // ==========================================
    // CAMERA SETUP
    // ==========================================
    
    private void SetupStreamCamera()
    {
        // Find VR camera to follow
        Transform centerEyeAnchor = null;
        GameObject centerEyeObj = GameObject.FindGameObjectWithTag("MainCamera");
        if (centerEyeObj != null)
        {
            centerEyeAnchor = centerEyeObj.transform;
        }
        
        // Create stream camera
        GameObject streamCameraObj = new GameObject("IVSStreamCamera");
        
        if (centerEyeAnchor != null)
        {
            streamCameraObj.transform.SetParent(centerEyeAnchor, false);
            Debug.Log("[IVS] Stream camera parented to main camera - follows head movement");
        }
        
        streamCamera = streamCameraObj.AddComponent<Camera>();
        
        // Copy from main camera
        Camera mainCamera = centerEyeAnchor?.GetComponent<Camera>() ?? Camera.main;
        if (mainCamera != null)
        {
            streamCamera.CopyFrom(mainCamera);
            streamCamera.stereoTargetEye = StereoTargetEyeMask.None;
        }
        
        // Create render texture
        streamTexture = new RenderTexture(streamWidth, streamHeight, 24);
        streamTexture.format = RenderTextureFormat.ARGB32;
        streamTexture.Create();
        streamCamera.targetTexture = streamTexture;
        
        // Disable until streaming
        streamCamera.enabled = false;
        
        DontDestroyOnLoad(streamCameraObj);
        
        Debug.Log($"[IVS] Stream camera ready: {streamWidth}x{streamHeight}");
    }
    
    // ==========================================
    // RTMP PUBLISHER INITIALIZATION
    // ==========================================
    
    /// <summary>
    /// Interface for RTMP publishing - used for fallback stub
    /// </summary>
    public interface IRTMPPublisher
    {
        void Initialize(int width, int height, int fps, int bitrate, int keyframeInterval);
        void SetSourceTexture(RenderTexture texture);
        void Connect(string url);
        void StartPublishing();
        void StopPublishing();
        void Disconnect();
        bool IsConnected { get; }
        bool IsPublishing { get; }
    }
    
    private void InitializeRTMPPublisher()
    {
        // Try to use native FFmpeg publisher first
        if (_useNativePublisher && NativeFFmpegBridge.IsAvailable())
        {
            Debug.Log("[IVS] Native FFmpeg library available - using real RTMP publisher");
            
            ffmpegPublisher = new FFmpegRTMPPublisher();
            if (ffmpegPublisher.Initialize(streamWidth, streamHeight, streamFrameRate, streamBitrate, keyframeInterval))
            {
                ffmpegPublisher.SetSourceTexture(streamTexture);
                Debug.Log("[IVS] FFmpeg RTMP publisher initialized successfully");
                return;
            }
            else
            {
                Debug.LogWarning($"[IVS] FFmpeg init failed: {ffmpegPublisher.LastError}");
                ffmpegPublisher.Dispose();
                ffmpegPublisher = null;
            }
        }
        else if (_useNativePublisher)
        {
            Debug.LogWarning("[IVS] Native FFmpeg library not available - falling back to stub");
        }
        
        // Fall back to stub publisher
        stubPublisher = new StubRTMPPublisher();
        stubPublisher.Initialize(streamWidth, streamHeight, streamFrameRate, streamBitrate, keyframeInterval);
        stubPublisher.SetSourceTexture(streamTexture);
        
        Debug.Log("[IVS] RTMP publisher initialized (using stub - native library not available)");
        Debug.Log("[IVS] To enable native streaming:");
        Debug.Log("[IVS]   1. Build native FFmpeg library for your platform");
        Debug.Log("[IVS]   2. Place in Plugins/[platform]/ folder");
        Debug.Log("[IVS]   3. Restart Unity");
    }
    
    /// <summary>
    /// Stub publisher for testing - used when native library unavailable
    /// </summary>
    private class StubRTMPPublisher : IRTMPPublisher
    {
        private bool connected = false;
        private bool publishing = false;
        private string currentUrl;
        
        public bool IsConnected => connected;
        public bool IsPublishing => publishing;
        
        public void Initialize(int width, int height, int fps, int bitrate, int keyframeInterval)
        {
            Debug.Log($"[RTMP STUB] Initialized: {width}x{height} @ {fps}fps, {bitrate}kbps");
        }
        
        public void SetSourceTexture(RenderTexture texture)
        {
            Debug.Log($"[RTMP STUB] Source texture set: {texture?.width}x{texture?.height}");
        }
        
        public void Connect(string url)
        {
            currentUrl = url;
            connected = true;
            Debug.Log($"[RTMP STUB] Would connect to: {url}");
            Debug.Log("[RTMP STUB] ⚠️ This is a stub! Native library not available.");
            Debug.Log("[RTMP STUB] You can test manually with OBS or FFmpeg using these credentials.");
        }
        
        public void StartPublishing()
        {
            if (connected)
            {
                publishing = true;
                Debug.Log("[RTMP STUB] Publishing started (simulated)");
            }
        }
        
        public void StopPublishing()
        {
            publishing = false;
            Debug.Log("[RTMP STUB] Publishing stopped");
        }
        
        public void Disconnect()
        {
            publishing = false;
            connected = false;
            Debug.Log("[RTMP STUB] Disconnected");
        }
    }
    
    // ==========================================
    // STREAMING CONTROL
    // ==========================================
    
    public void ToggleStreaming()
    {
        if (isStreaming)
        {
            StopStreaming();
        }
        else
        {
            StartStreaming();
        }
    }
    
    public void StartStreaming()
    {
        if (isStreaming)
        {
            Debug.LogWarning("[IVS] Already streaming");
            return;
        }
        
        StartCoroutine(StartStreamingCoroutine());
    }
    
    private IEnumerator StartStreamingCoroutine()
    {
        UpdateStatus("Fetching ingest credentials...");
        
        // 1. Fetch ingest credentials from backend
        yield return StartCoroutine(FetchIngestConfig());
        
        if (ingestConfig == null)
        {
            ShowError("Failed to get streaming credentials");
            yield break;
        }
        
        UpdateStatus("Creating session...");
        
        // 2. Create session on backend
        yield return StartCoroutine(CreateSession());
        
        if (string.IsNullOrEmpty(currentSessionId))
        {
            ShowError("Failed to create session");
            yield break;
        }
        
        UpdateStatus("Connecting to IVS...");
        
        // 3. Start RTMP publishing
        string rtmpUrl = ingestConfig.ingest.endpoint + ingestConfig.ingest.streamKey;
        
        try
        {
            // Enable stream camera
            streamCamera.enabled = true;
            
            // Use FFmpeg publisher if available, otherwise stub
            if (ffmpegPublisher != null)
            {
                Debug.Log($"[IVS] Attempting RTMPS connection...");
                Debug.Log($"[IVS] Target: {ingestConfig.ingest.endpoint}");
                
                if (!ffmpegPublisher.Connect(rtmpUrl))
                {
                    Debug.LogError($"[IVS] ❌ Connection FAILED");
                    Debug.LogError($"[IVS] Error: {ffmpegPublisher.LastError}");
                    Debug.LogError($"[IVS] Native State: {Substream.Streaming.NativeFFmpegBridge.rtmp_get_state()}");
                    Debug.LogError($"[IVS] Possible causes:");
                    Debug.LogError($"[IVS]   - Network/firewall blocking RTMPS (port 443)");
                    Debug.LogError($"[IVS]   - Invalid RTMP URL or stream key");
                    Debug.LogError($"[IVS]   - Stub library being used instead of real FFmpeg");
                    throw new Exception($"FFmpeg connect failed: {ffmpegPublisher.LastError}");
                }
                
                Debug.Log($"[IVS] ✅ Connected to IVS");
                Debug.Log($"[IVS] Native State: {Substream.Streaming.NativeFFmpegBridge.rtmp_get_state()}");
                Debug.Log($"[IVS] IsConnected: {ffmpegPublisher.IsConnected}");
                
                if (!ffmpegPublisher.StartStreaming())
                {
                    Debug.LogError($"[IVS] ❌ StartStreaming FAILED");
                    Debug.LogError($"[IVS] Error: {ffmpegPublisher.LastError}");
                    throw new Exception($"FFmpeg start streaming failed: {ffmpegPublisher.LastError}");
                }
                
                Debug.Log($"[IVS] ✅ Streaming started successfully");
                Debug.Log($"[IVS] IsStreaming: {ffmpegPublisher.IsStreaming}");
            }
            else if (stubPublisher != null)
            {
                Debug.LogWarning("[IVS] ⚠️ Using STUB publisher - streaming will be simulated only!");
                stubPublisher.Connect(rtmpUrl);
                stubPublisher.StartPublishing();
            }
            else
            {
                throw new Exception("No RTMP publisher available");
            }
            
            isStreaming = true;
            
            // Start heartbeat
            heartbeatCoroutine = StartCoroutine(HeartbeatLoop());
            
            UpdateStatus("🔴 LIVE");
            Debug.Log($"[IVS] ═══════════════════════════════════════════════");
            Debug.Log($"[IVS] Streaming started. Session: {currentSessionId}");
            Debug.Log($"[IVS] RTMP URL: {ingestConfig.ingest.endpoint}");
            Debug.Log($"[IVS] Stream Key: {ingestConfig.ingest.streamKey.Substring(0, Math.Min(20, ingestConfig.ingest.streamKey.Length))}...");
            Debug.Log($"[IVS] Using Native FFmpeg: {(ffmpegPublisher != null ? "YES" : "NO (stub)")}");
            Debug.Log($"[IVS] ═══════════════════════════════════════════════");
            
            OnStartStreaming?.Invoke();
        }
        catch (Exception e)
        {
            ShowError($"Failed to start streaming: {e.Message}");
            streamCamera.enabled = false;
            yield break;
        }
    }
    
    public void StopStreaming()
    {
        if (!isStreaming)
        {
            return;
        }
        
        StartCoroutine(StopStreamingCoroutine());
    }
    
    private IEnumerator StopStreamingCoroutine()
    {
        UpdateStatus("Stopping stream...");
        
        // Stop heartbeat
        if (heartbeatCoroutine != null)
        {
            StopCoroutine(heartbeatCoroutine);
            heartbeatCoroutine = null;
        }
        
        // Stop RTMP
        try
        {
            if (ffmpegPublisher != null)
            {
                ffmpegPublisher.StopStreaming();
                ffmpegPublisher.Disconnect();
            }
            else if (stubPublisher != null)
            {
                stubPublisher.StopPublishing();
                stubPublisher.Disconnect();
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[IVS] Error stopping RTMP: {e.Message}");
        }
        
        // Disable camera
        if (streamCamera != null)
        {
            streamCamera.enabled = false;
        }
        
        // End session on backend
        if (!string.IsNullOrEmpty(currentSessionId))
        {
            yield return StartCoroutine(EndSession());
        }
        
        isStreaming = false;
        currentSessionId = null;
        
        // Log final stats
        if (ffmpegPublisher != null)
        {
            Debug.Log($"[IVS] Final stats: {_framesSent} frames sent, {_droppedFrames} dropped");
        }
        
        UpdateStatus("Ready to stream");
        Debug.Log("[IVS] Streaming stopped");
        
        OnStopStreaming?.Invoke();
    }
    
    private void StopStreamingImmediate()
    {
        if (heartbeatCoroutine != null)
        {
            StopCoroutine(heartbeatCoroutine);
        }
        
        try
        {
            if (ffmpegPublisher != null)
            {
                ffmpegPublisher.StopStreaming();
                ffmpegPublisher.Disconnect();
            }
            else if (stubPublisher != null)
            {
                stubPublisher?.StopPublishing();
                stubPublisher?.Disconnect();
            }
        }
        catch { }
        
        if (streamCamera != null)
        {
            streamCamera.enabled = false;
        }
        
        isStreaming = false;
    }
    
    // ==========================================
    // API CALLS
    // ==========================================
    
    private IEnumerator FetchIngestConfig()
    {
        string url = $"{backendUrl}/api/streams/children/{childId}/ingest";
        
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    ingestConfig = JsonUtility.FromJson<IngestConfig>(request.downloadHandler.text);
                    Debug.Log($"[IVS] Got ingest config: {ingestConfig.channelArn}");
                    
                    // Apply recommended encoder settings
                    if (ingestConfig.recommendedEncoderConfig != null)
                    {
                        var config = ingestConfig.recommendedEncoderConfig;
                        Debug.Log($"[IVS] Recommended: {config.maxWidth}x{config.maxHeight} @ {config.maxFramerate}fps, {config.maxBitrateKbps}kbps");
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"[IVS] Failed to parse ingest config: {e.Message}");
                    Debug.LogError($"[IVS] Response: {request.downloadHandler.text}");
                    ingestConfig = null;
                }
            }
            else
            {
                Debug.LogError($"[IVS] Failed to fetch ingest config: {request.error}");
                Debug.LogError($"[IVS] Response: {request.downloadHandler?.text}");
                ingestConfig = null;
            }
        }
    }
    
    private IEnumerator CreateSession()
    {
        string url = $"{backendUrl}/api/streams/children/{childId}/sessions";
        
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var response = JsonUtility.FromJson<SessionResponse>(request.downloadHandler.text);
                    currentSessionId = response.sessionId;
                    Debug.Log($"[IVS] Session created: {currentSessionId}");
                }
                catch (Exception e)
                {
                    Debug.LogError($"[IVS] Failed to parse session response: {e.Message}");
                    currentSessionId = null;
                }
            }
            else
            {
                Debug.LogError($"[IVS] Failed to create session: {request.error}");
                currentSessionId = null;
            }
        }
    }
    
    private IEnumerator EndSession()
    {
        string url = $"{backendUrl}/api/streams/sessions/{currentSessionId}";
        
        using (UnityWebRequest request = UnityWebRequest.Delete(url))
        {
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"[IVS] Session ended: {currentSessionId}");
            }
            else
            {
                Debug.LogError($"[IVS] Failed to end session: {request.error}");
            }
        }
    }
    
    private IEnumerator HeartbeatLoop()
    {
        while (isStreaming)
        {
            yield return new WaitForSeconds(30f);
            
            if (!isStreaming || string.IsNullOrEmpty(currentSessionId))
            {
                yield break;
            }
            
            yield return StartCoroutine(SendHeartbeat());
        }
    }
    
    private IEnumerator SendHeartbeat()
    {
        string url = $"{backendUrl}/api/streams/sessions/{currentSessionId}/heartbeat";
        
        // Build heartbeat data with current stats
        int currentBitrate = streamBitrate;
        string health = "healthy";
        
        if (ffmpegPublisher != null)
        {
            float dropRate = _framesSent > 0 ? (float)_droppedFrames / _framesSent : 0;
            if (dropRate > 0.1f) health = "degraded";
            if (dropRate > 0.3f) health = "poor";
        }
        
        string json = $"{{\"currentBitrateKbps\":{currentBitrate},\"streamHealth\":\"{health}\"}}";
        
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning($"[IVS] Heartbeat failed: {request.error}");
            }
        }
    }
    
    // ==========================================
    // UI HELPERS
    // ==========================================
    
    private void UpdateStatus(string status)
    {
        if (_statusText != null)
        {
            _statusText.text = status;
        }
        Debug.Log($"[IVS] Status: {status}");
    }
    
    private void ShowError(string error)
    {
        if (_errorText != null)
        {
            _errorText.text = error;
        }
        Debug.LogError($"[IVS] Error: {error}");
        OnError?.Invoke(error);
    }
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    /// <summary>
    /// Set auth token programmatically
    /// </summary>
    public void SetAuthToken(string token)
    {
        authToken = token;
        PlayerPrefs.SetString("AuthToken", token);
        PlayerPrefs.Save();
    }
    
    /// <summary>
    /// Set child ID programmatically
    /// </summary>
    public void SetChildId(string id)
    {
        childId = id;
        PlayerPrefs.SetString("ChildId", id);
        PlayerPrefs.Save();
    }
    
    /// <summary>
    /// Get current session ID
    /// </summary>
    public string GetCurrentSessionId() => currentSessionId;
    
    /// <summary>
    /// Check if currently streaming
    /// </summary>
    public bool IsStreaming => isStreaming;
    
    /// <summary>
    /// Check if using native FFmpeg (vs stub)
    /// </summary>
    public bool IsUsingNativePublisher => ffmpegPublisher != null;
    
    /// <summary>
    /// Get the current ingest configuration (after StartStreaming is called)
    /// </summary>
    public IngestConfig GetIngestConfig() => ingestConfig;
    
    /// <summary>
    /// Get current streaming stats
    /// </summary>
    public (int framesSent, int droppedFrames, float bitrateMbps) GetStreamStats()
    {
        return (_framesSent, _droppedFrames, _bitrateMbps);
    }
}
