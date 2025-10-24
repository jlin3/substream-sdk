using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System;
using UnityEngine;
using UnityEngine.Networking;
using Unity.RenderStreaming;
using TMPro;
using UnityEngine.Events;

public class RenderStreamControl : MonoBehaviour
{
    [Header("UI References")]
    public TMP_Text _errors;
    public GameObject _recordingText;
    
    [Header("Backend Configuration")]
    [Tooltip("Backend API URL (e.g., https://your-backend.up.railway.app)")]
    public string backendUrl = "https://substream-sdk-test.up.railway.app";
    
    [Tooltip("Auth token for API calls (set via PlayerPrefs or Inspector)")]
    public string authToken = "";
    
    [Header("Quality Settings")]
    [Tooltip("Enable high-quality local recording (requires Unity Recorder package)")]
    public bool enableHighQualityRecording = true;
    
    [Tooltip("Stream bitrate in kbps (3000-15000). Higher = better quality but more bandwidth")]
    public int streamBitrate = 8000; // 8 Mbps for high quality
    
    [Tooltip("Stream frame rate (30 or 60)")]
    public int streamFrameRate = 60; // 60fps for smooth playback
    
    [Header("Events")]
    public UnityEvent OnStartStreaming;
    public UnityEvent OnStopStreaming;
    
    // Private fields
    private SignalingManager signalingManager;
    private List<MonoBehaviour> autoAudioFilters = new List<MonoBehaviour>();
    private bool isStreaming = false;
    private string currentSessionId;
    private string currentConnectionId;

    // Stream camera setup (1920x1080, single eye)
    private Camera streamCamera;
    private RenderTexture streamTexture;
    private VideoStreamSender videoStreamSender;
    private AudioStreamSender audioStreamSender;
    private Broadcast broadcast;
    
    void Start()
    {
        // Load auth token from PlayerPrefs if not set in Inspector
        if (string.IsNullOrEmpty(authToken))
        {
            authToken = PlayerPrefs.GetString("AuthToken", "");
            if (string.IsNullOrEmpty(authToken))
            {
                Debug.LogWarning("⚠️  No auth token configured. Set in Inspector or PlayerPrefs.");
                Debug.LogWarning("   Streaming will work but without backend session tracking.");
            }
        }
        
        signalingManager = FindObjectOfType<SignalingManager>();
        if (signalingManager == null)
        {
            // Create SignalingManager automatically since automatic streaming is disabled
            GameObject signalingObj = new GameObject("SignalingManager");
            signalingManager = signalingObj.AddComponent<SignalingManager>();
            signalingManager.runOnAwake = false; // Manual control via our script
            
            // Ensure SignalingManager persists (important for VR scenes)
            DontDestroyOnLoad(signalingObj);
            
#if UNITY_EDITOR
            Debug.Log("Created SignalingManager automatically");
#endif
        }

        // Disable AutomaticStreaming components that cause the resolution error
        DisableAutomaticStreaming();
        
        SetupStreamCamera();
        RefreshAutoAudioFilters();
        StopStreamingImmediate();
    }

    private void DisableAutomaticStreaming()
    {
        // More efficient approach: Only search for specific component types
        // instead of ALL MonoBehaviours (which would be expensive in large scenes)
        
        // Find and disable any VideoStreamSender components that use Screen source
        var videoSenders = FindObjectsOfType<VideoStreamSender>();
        foreach (var sender in videoSenders)
        {
            if (sender.source == VideoStreamSource.Screen)
            {
                sender.enabled = false;
#if UNITY_EDITOR
                Debug.Log("Disabled Screen-based VideoStreamSender that was causing resolution error");
#endif
            }
        }
        
        // Only search for AutomaticStreaming if Unity.RenderStreaming namespace is available
        // This is more efficient than searching all MonoBehaviours
        try
        {
            var automaticStreamingType = System.Type.GetType("Unity.RenderStreaming.AutomaticStreaming, Unity.RenderStreaming");
            if (automaticStreamingType != null)
            {
                var components = FindObjectsOfType(automaticStreamingType);
                foreach (var component in components)
                {
                    if (component is MonoBehaviour mb)
                    {
                        mb.enabled = false;
#if UNITY_EDITOR
                        Debug.Log("Disabled AutomaticStreaming component that was causing resolution error");
#endif
                    }
                }
            }
        }
        catch
        {
            // AutomaticStreaming type doesn't exist in this Unity version - safe to ignore
        }
    }

    private void SetupStreamCamera()
    {
        // Find CenterEyeAnchor to parent the stream camera to
        Transform centerEyeAnchor = null;
        GameObject centerEyeObj = GameObject.FindGameObjectWithTag("MainCamera");
        if (centerEyeObj != null && centerEyeObj.name.Contains("CenterEye"))
        {
            centerEyeAnchor = centerEyeObj.transform;
        }
        
        // Create dedicated 1080p stream camera that follows player's head
        GameObject streamCameraObj = new GameObject("StreamCamera_1080p");
        
        // Parent to CenterEyeAnchor so it follows player movement
        if (centerEyeAnchor != null)
        {
            streamCameraObj.transform.SetParent(centerEyeAnchor, false);
#if UNITY_EDITOR
            Debug.Log("Stream camera parented to CenterEyeAnchor - will follow player head movement");
#endif
        }
        else
        {
#if UNITY_EDITOR
            Debug.LogWarning("CenterEyeAnchor not found, stream camera will be static");
#endif
        }
        
        streamCamera = streamCameraObj.AddComponent<Camera>();
        
        // Copy settings from main camera (CenterEyeAnchor camera)
        Camera mainCamera = centerEyeAnchor?.GetComponent<Camera>() ?? Camera.main;
        if (mainCamera != null)
        {
            streamCamera.CopyFrom(mainCamera);
            // Override stereo settings for single-eye stream
            streamCamera.stereoTargetEye = StereoTargetEyeMask.None;
        }
        
        // Create optimized 1920x1080 render texture for single eye stream
        streamTexture = new RenderTexture(1920, 1080, 24);
        streamTexture.format = RenderTextureFormat.ARGB32;
        streamTexture.useMipMap = false;
        streamTexture.autoGenerateMips = false;
        streamTexture.Create();
        streamCamera.targetTexture = streamTexture;
        streamCamera.depth = (mainCamera?.depth ?? 0) + 1;
        
        // Add video stream sender with TEXTURE source (not Screen)
        videoStreamSender = streamCameraObj.AddComponent<VideoStreamSender>();
        videoStreamSender.source = VideoStreamSource.Texture;
        videoStreamSender.sourceTexture = streamTexture;
        
        // Configure video stream settings BEFORE enabling (must be done before streaming starts)
        StartCoroutine(ConfigureVideoStreamSettings());
        
        // Add audio stream sender
        audioStreamSender = streamCameraObj.AddComponent<AudioStreamSender>();
        audioStreamSender.source = AudioStreamSource.APIOnly;
        
        // Add broadcast handler for SignalingManager
        broadcast = streamCameraObj.AddComponent<Broadcast>();
        broadcast.AddComponent(videoStreamSender);
        broadcast.AddComponent(audioStreamSender);
        
        // Subscribe to connection events for debugging
        broadcast.OnStartedConnection += OnConnectionStarted;
        broadcast.OnStoppedConnection += OnConnectionStopped;
        
        // Add broadcast to SignalingManager
        signalingManager.AddSignalingHandler(broadcast);
        
        // Ensure stream camera persists (important for VR scenes)
        DontDestroyOnLoad(streamCameraObj);
        
        // Disable until streaming starts
        streamCamera.enabled = false;
        videoStreamSender.enabled = false;
        audioStreamSender.enabled = false;
        
#if UNITY_EDITOR
        Debug.Log("Stream camera setup complete: 1920x1080 following player head (VR gameplay unaffected)");
        Debug.Log($"Broadcast component created and added to SignalingManager: {broadcast != null}");
#endif
    }

    public void toggleStreamFunc()
    {
        if (isStreaming) StopStreaming();
        else StartStreaming();
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.U))
        {
            toggleStreamFunc();
        }
    }

    private void StartStreaming()
    {
#if UNITY_EDITOR
        Debug.Log($"StartStreaming called - Component status: SignalingManager={signalingManager != null}, Broadcast={broadcast != null}, VideoSender={videoStreamSender != null}, AudioSender={audioStreamSender != null}");
#endif
        
        // Validate all components before starting
        if (signalingManager == null)
        {
            Debug.LogError("SignalingManager is null! Cannot start streaming. Re-finding SignalingManager...");
            signalingManager = FindObjectOfType<SignalingManager>();
            if (signalingManager == null)
            {
                Debug.LogError("SignalingManager still null after FindObjectOfType!");
                if (_errors != null) _errors.text = "ERROR: SignalingManager is null";
                return;
            }
            Debug.Log("SignalingManager found successfully after re-search");
        }
        
        if (broadcast == null)
        {
            Debug.LogError("Broadcast component is null! Cannot start streaming.");
            if (_errors != null) _errors.text = "ERROR: Broadcast component is null";
            return;
        }
        
        if (videoStreamSender == null || audioStreamSender == null)
        {
            Debug.LogError("Stream senders are null! Cannot start streaming.");
            if (_errors != null) _errors.text = "ERROR: Stream senders are null";
            return;
        }
        
        // Enable 1080p stream camera
        if (streamCamera != null) streamCamera.enabled = true;
        if (videoStreamSender != null) videoStreamSender.enabled = true;
        if (audioStreamSender != null) audioStreamSender.enabled = true;

        SetAutoFiltersSender();
        
        try
        {
            signalingManager.Run();
            isStreaming = true;
            
            // Generate connection ID for this session
            currentConnectionId = System.Guid.NewGuid().ToString();
            
#if UNITY_EDITOR
            Debug.Log($"Render Streaming started at 1920x1080. ConnectionID: {currentConnectionId}");
#endif
            
            // Call backend API to create session (async)
            if (!string.IsNullOrEmpty(authToken))
            {
                StartCoroutine(CreateStreamSession(currentConnectionId));
            }
            
            OnStartStreaming.Invoke();
        }
        catch (System.Exception e)
        {
            Debug.LogError($"Failed to start streaming: {e.Message}\n{e.StackTrace}");
            if (_errors != null) _errors.text = $"ERROR: {e.Message}";
            
            // Clean up on failure
            if (streamCamera != null) streamCamera.enabled = false;
            if (videoStreamSender != null) videoStreamSender.enabled = false;
            if (audioStreamSender != null) audioStreamSender.enabled = false;
        }
    }

    private void StopStreaming()
    {
        OnStopStreaming.Invoke();
        StartCoroutine(StopStreamingCoroutine());
    }

    private IEnumerator StopStreamingCoroutine()
    {
        // Call backend API to end session before stopping
        if (!string.IsNullOrEmpty(currentSessionId) && !string.IsNullOrEmpty(authToken))
        {
            yield return StartCoroutine(EndStreamSession(currentSessionId));
        }
        
        // Disable stream camera
        if (streamCamera != null) streamCamera.enabled = false;
        if (videoStreamSender != null) videoStreamSender.enabled = false;
        if (audioStreamSender != null) audioStreamSender.enabled = false;

        SetAutoFiltersSender(null);
        yield return null;

        signalingManager.Stop();
        isStreaming = false;
        
#if UNITY_EDITOR
        Debug.Log("Render Streaming stopped.");
#endif
    }

    private void StopStreamingImmediate()
    {
        if (streamCamera != null) streamCamera.enabled = false;
        if (videoStreamSender != null) videoStreamSender.enabled = false;
        if (audioStreamSender != null) audioStreamSender.enabled = false;
        
        SetAutoFiltersSender(null);
        if (signalingManager != null) signalingManager.Stop();
        isStreaming = false;
    }

    private void RefreshAutoAudioFilters()
    {
        autoAudioFilters.Clear();
        
        // More efficient: Use Type.GetType to find specific type instead of searching all MonoBehaviours
        // This avoids expensive iteration through tens of thousands of MonoBehaviours
        try
        {
            var autoAudioFilterType = System.Type.GetType("Unity.RenderStreaming.AutomaticStreaming+AutoAudioFilter, Unity.RenderStreaming");
            if (autoAudioFilterType != null)
            {
                var components = FindObjectsOfType(autoAudioFilterType, true);
                foreach (var component in components)
                {
                    if (component is MonoBehaviour mb)
                    {
                        autoAudioFilters.Add(mb);
                    }
                }
            }
        }
        catch
        {
            // AutoAudioFilter type doesn't exist in this Unity version - safe to ignore
            // This means automatic audio streaming is not available, but our manual setup will work
        }
    }

    private void SetAutoFiltersSender(AudioStreamSender sender = null)
    {
        if (autoAudioFilters.Count == 0) RefreshAutoAudioFilters();
        foreach (var mb in autoAudioFilters)
        {
            if (mb == null) continue;
            var mi = mb.GetType().GetMethod("SetSender", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (mi != null)
                mi.Invoke(mb, new object[] { sender });
        }
    }

    private IEnumerator ConfigureVideoStreamSettings()
    {
        // Wait one frame for VideoStreamSender to be fully initialized
        yield return null;
        
        // Note: Some VideoStreamSender methods (SetFrameRate, SetBitrate, SetScaleResolutionDown, SetTextureSize)
        // may not be available in Unity 2022.3.x and are only in Unity 6+
        // We try to call them via reflection for maximum compatibility
        
        int minBitrate = Mathf.Max(5000, streamBitrate - 2000);
        int maxBitrate = Mathf.Min(15000, streamBitrate + 2000);
        
#if UNITY_EDITOR
        Debug.Log($"Configuring video settings: {streamBitrate}kbps @ {streamFrameRate}fps");
#endif
        
        var senderType = videoStreamSender.GetType();
        
        // Try SetFrameRate (may not exist in Unity 2022.3.x)
        TryInvokeMethod(senderType, videoStreamSender, "SetFrameRate", new object[] { (float)streamFrameRate });
        
        // Try SetBitrate (may not exist in Unity 2022.3.x)
        TryInvokeMethod(senderType, videoStreamSender, "SetBitrate", new object[] { minBitrate, maxBitrate });
        
        // Try SetScaleResolutionDown (may not exist in Unity 2022.3.x)
        TryInvokeMethod(senderType, videoStreamSender, "SetScaleResolutionDown", new object[] { 1.0f });
        
        // Try SetTextureSize (may not exist in Unity 2022.3.x)
        TryInvokeMethod(senderType, videoStreamSender, "SetTextureSize", new object[] { new Vector2Int(1920, 1080) });
        
#if UNITY_EDITOR
        Debug.Log($"✅ Video settings configured (Unity {Application.unityVersion})");
        Debug.Log($"   Target: 1920x1080 @ {streamFrameRate}fps, {minBitrate}-{maxBitrate}kbps");
        Debug.Log($"   Note: Some settings may not apply on Unity 2022.3.x (Unity 6+ required for full control)");
#endif
    }
    
    /// <summary>
    /// Helper method to invoke methods that may not exist in older Unity versions
    /// Uses reflection for maximum compatibility across Unity versions
    /// </summary>
    private void TryInvokeMethod(System.Type type, object instance, string methodName, object[] parameters)
    {
        try
        {
            var method = type.GetMethod(methodName, BindingFlags.Public | BindingFlags.Instance);
            if (method != null)
            {
                method.Invoke(instance, parameters);
#if UNITY_EDITOR
                Debug.Log($"   ✅ {methodName} applied successfully");
#endif
            }
            else
            {
#if UNITY_EDITOR
                Debug.Log($"   ⚠️  {methodName} not available in Unity {Application.unityVersion} (Unity 6+ required)");
#endif
            }
        }
        catch (System.Exception e)
        {
#if UNITY_EDITOR
            Debug.LogWarning($"   ⚠️  {methodName} failed: {e.Message}");
#endif
        }
    }

    void OnDestroy()
    {
        if (streamTexture != null)
        {
            streamTexture.Release();
            DestroyImmediate(streamTexture);
        }
        
        // Unsubscribe from events
        if (broadcast != null)
        {
            broadcast.OnStartedConnection -= OnConnectionStarted;
            broadcast.OnStoppedConnection -= OnConnectionStopped;
        }
    }
    
    // Connection event handlers for debugging
    private void OnConnectionStarted(string connectionId)
    {
        Debug.Log($"✅ WebRTC Connection STARTED with ID: {connectionId}");
        if (_errors != null) _errors.text = $"Connected: {connectionId}";
    }
    
    private void OnConnectionStopped(string connectionId)
    {
        Debug.Log($"❌ WebRTC Connection STOPPED with ID: {connectionId}");
        if (_errors != null) _errors.text = $"Disconnected: {connectionId}";
    }
    
    // ====================================================================================
    // BACKEND API INTEGRATION
    // ====================================================================================
    
    [System.Serializable]
    private class SessionStartRequest
    {
        public string connectionId;
        public object metadata;
    }
    
    [System.Serializable]
    private class SessionStartResponse
    {
        public string sessionId;
        public string roomName;
        public string connectionId;
    }
    
    [System.Serializable]
    private class SessionEndResponse
    {
        public bool success;
        public int duration;
    }
    
    /// <summary>
    /// Call backend API to create a new streaming session
    /// </summary>
    private IEnumerator CreateStreamSession(string connectionId)
    {
        if (string.IsNullOrEmpty(backendUrl) || string.IsNullOrEmpty(authToken))
        {
            Debug.LogWarning("Backend URL or auth token not configured, skipping session creation");
            yield break;
        }
        
        string url = $"{backendUrl}/api/sessions/start";
        
        var requestData = new SessionStartRequest
        {
            connectionId = connectionId,
            metadata = new { 
                platform = Application.platform.ToString(),
                version = Application.version,
                deviceModel = SystemInfo.deviceModel
            }
        };
        
        string json = JsonUtility.ToJson(requestData);
        
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var response = JsonUtility.FromJson<SessionStartResponse>(request.downloadHandler.text);
                    currentSessionId = response.sessionId;
                    Debug.Log($"✅ Stream session created: {currentSessionId}");
                    Debug.Log($"   Room: {response.roomName}");
                    
                    if (_errors != null) _errors.text = $"Session: {currentSessionId}";
                }
                catch (Exception e)
                {
                    Debug.LogError($"Failed to parse session start response: {e.Message}");
                }
            }
            else
            {
                Debug.LogError($"❌ Failed to create stream session: {request.error}");
                Debug.LogError($"   Response: {request.downloadHandler?.text}");
                if (_errors != null) _errors.text = "Session creation failed";
            }
        }
    }
    
    /// <summary>
    /// Call backend API to end the streaming session
    /// </summary>
    private IEnumerator EndStreamSession(string sessionId)
    {
        if (string.IsNullOrEmpty(backendUrl) || string.IsNullOrEmpty(authToken))
        {
            yield break;
        }
        
        string url = $"{backendUrl}/api/sessions/end/{sessionId}";
        
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
                    var response = JsonUtility.FromJson<SessionEndResponse>(request.downloadHandler.text);
                    Debug.Log($"✅ Stream session ended: {sessionId}");
                    Debug.Log($"   Duration: {response.duration} seconds");
                }
                catch (Exception e)
                {
                    Debug.LogError($"Failed to parse session end response: {e.Message}");
                }
            }
            else
            {
                Debug.LogError($"❌ Failed to end stream session: {request.error}");
            }
        }
        
        // Clear session ID
        currentSessionId = null;
    }
    
    /// <summary>
    /// Set auth token programmatically (for integration with main app)
    /// </summary>
    public void SetAuthToken(string token)
    {
        authToken = token;
        PlayerPrefs.SetString("AuthToken", token);
        PlayerPrefs.Save();
        Debug.Log("✅ Auth token configured");
    }
    
    /// <summary>
    /// Get current session info
    /// </summary>
    public string GetCurrentSessionId()
    {
        return currentSessionId;
    }
    
    /// <summary>
    /// Check if currently streaming
    /// </summary>
    public bool IsCurrentlyStreaming()
    {
        return isStreaming;
    }
}
