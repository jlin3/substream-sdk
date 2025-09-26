using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Unity.RenderStreaming;
using TMPro;
using UnityEngine.Events;

public class RenderStreamControl : MonoBehaviour
{
    public TMP_Text _errors;
    private SignalingManager signalingManager;
    private List<MonoBehaviour> autoAudioFilters = new List<MonoBehaviour>();
    private bool isStreaming = false;

    // Stream camera setup (1920x1080, single eye)
    private Camera streamCamera;
    private RenderTexture streamTexture;
    private VideoStreamSender videoStreamSender;
    private AudioStreamSender audioStreamSender;
    private Broadcast broadcast;
    public GameObject _recordingText;

    public UnityEvent OnStartStreaming;
    public UnityEvent OnStopStreaming;
    
    // Log filtering to prevent Railway rate limiting (500+ logs/sec)
    private static bool logFilterInitialized = false;
    
    void Awake()
    {
        if (!logFilterInitialized)
        {
            // Reduce Unity's internal logging to prevent Railway rate limiting
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            Application.SetStackTraceLogType(LogType.Warning, StackTraceLogType.ScriptOnly);
            
#if !UNITY_EDITOR
            // In builds, only show errors and warnings to reduce log spam
            Debug.unityLogger.filterLogType = LogType.Warning;
            Debug.Log("Log filtering enabled - Railway rate limit protection active");
#else
            Debug.Log("Log filtering initialized - Railway rate limit protection (Editor: full logging)");
#endif
            
            logFilterInitialized = true;
        }
    }
    
    void Start()
    {
        signalingManager = FindObjectOfType<SignalingManager>();
        if (signalingManager == null)
        {
            // Create SignalingManager automatically since automatic streaming is disabled
            GameObject signalingObj = new GameObject("SignalingManager");
            signalingManager = signalingObj.AddComponent<SignalingManager>();
            signalingManager.runOnAwake = false; // Manual control via our script
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
        // Find and disable any AutomaticStreaming components
        var automaticStreamingComponents = FindObjectsOfType<MonoBehaviour>()
            .Where(mb => mb.GetType().FullName == "Unity.RenderStreaming.AutomaticStreaming")
            .ToArray();
        
        foreach (var component in automaticStreamingComponents)
        {
            component.enabled = false;
#if UNITY_EDITOR
            Debug.Log("Disabled AutomaticStreaming component that was causing resolution error");
#endif
        }

        // Also disable any existing VideoStreamSender components that use Screen source
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
        
        // Add broadcast to SignalingManager
        signalingManager.AddSignalingHandler(broadcast);
        
        // Disable until streaming starts
        streamCamera.enabled = false;
        videoStreamSender.enabled = false;
        audioStreamSender.enabled = false;
        
#if UNITY_EDITOR
        Debug.Log("Stream camera setup complete: 1920x1080 following player head (VR gameplay unaffected)");
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
        // Enable 1080p stream camera
        if (streamCamera != null) streamCamera.enabled = true;
        if (videoStreamSender != null) videoStreamSender.enabled = true;
        if (audioStreamSender != null) audioStreamSender.enabled = true;

        SetAutoFiltersSender();
        signalingManager.Run();
        isStreaming = true;
#if UNITY_EDITOR
        Debug.Log("Render Streaming started at 1920x1080.");
#endif
        
        OnStartStreaming.Invoke();
        
    }

    private void StopStreaming()
    {
        OnStopStreaming.Invoke();
        StartCoroutine(StopStreamingCoroutine());
    }

    private IEnumerator StopStreamingCoroutine()
    {
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
        MonoBehaviour[] allMB = FindObjectsOfType<MonoBehaviour>(true);
        foreach (var mb in allMB)
        {
            if (mb.GetType().FullName == "Unity.RenderStreaming.AutomaticStreaming+AutoAudioFilter")
                autoAudioFilters.Add(mb);
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
        
        try
        {
            // Try advanced settings for both Editor and Quest (with error handling)
#if UNITY_EDITOR
            Debug.Log("Applying advanced video stream settings (Editor)");
#endif
            
            // Set 30 FPS target (safe on Quest)
            videoStreamSender.SetFrameRate(30f);
            
            // Set higher bitrate for better quality (3-8 Mbps - Quest compatible)
            videoStreamSender.SetBitrate(3000, 8000); // 3-8 Mbps for high quality
            
            // Ensure no resolution downscaling (safe on Quest)
            videoStreamSender.SetScaleResolutionDown(1.0f); // 1.0 = no downscaling
            
            // Try resolution setting (may not work on older Quest versions)
            try 
            {
                videoStreamSender.SetTextureSize(new Vector2Int(1920, 1080));
#if UNITY_EDITOR
                Debug.Log("Set video: 1920x1080, 30fps, 3-8Mbps bitrate, no downscaling");
#endif
            }
            catch (System.Exception)
            {
                // Resolution setting failed - Quest will use texture size automatically
#if UNITY_EDITOR
                Debug.Log("Resolution setting failed - using texture size (1920x1080) automatically");
#endif
            }
            
        }
        catch (System.Exception e)
        {
#if UNITY_EDITOR
            Debug.LogWarning($"Advanced video settings partially failed: {e.Message}");
            Debug.Log("Falling back to basic configuration");
#endif
            // Basic settings that should work on all platforms
            try 
            {
                videoStreamSender.SetFrameRate(30f);
                videoStreamSender.SetScaleResolutionDown(1.0f);
            }
            catch
            {
                // Even basic settings failed - use defaults
            }
        }
    }

    void OnDestroy()
    {
        if (streamTexture != null)
        {
            streamTexture.Release();
            DestroyImmediate(streamTexture);
        }
    }
}
