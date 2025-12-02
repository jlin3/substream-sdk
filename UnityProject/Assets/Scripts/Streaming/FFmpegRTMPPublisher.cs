using System;
using System.Collections;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Rendering;

namespace Substream.Streaming
{
    /// <summary>
    /// FFmpeg-based RTMP publisher for Unity.
    /// Captures RenderTexture and streams via native FFmpeg library.
    /// </summary>
    public class FFmpegRTMPPublisher : IDisposable
    {
        // ==========================================
        // CONFIGURATION
        // ==========================================

        public int Width { get; private set; }
        public int Height { get; private set; }
        public int FrameRate { get; private set; }
        public int Bitrate { get; private set; }
        public int KeyframeInterval { get; private set; }

        // ==========================================
        // STATE
        // ==========================================

        public bool IsInitialized { get; private set; }
        public bool IsConnected { get; private set; }
        public bool IsStreaming { get; private set; }
        public string LastError { get; private set; }

        // Statistics
        public long BytesSent => NativeFFmpegBridge.rtmp_get_bytes_sent();
        public int FramesSent => NativeFFmpegBridge.rtmp_get_frames_sent();
        public int DroppedFrames => NativeFFmpegBridge.rtmp_get_dropped_frames();

        // ==========================================
        // PRIVATE FIELDS
        // ==========================================

        private RenderTexture _sourceTexture;
        private Texture2D _readbackTexture;
        private byte[] _pixelBuffer;
        private GCHandle _pixelBufferHandle;
        private IntPtr _pixelBufferPtr;
        
        private float[] _audioBuffer;
        private int _audioBufferSize;
        private long _startTime;
        private long _frameCount;
        
        private bool _disposed;
        private bool _asyncReadbackSupported;

        // ==========================================
        // INITIALIZATION
        // ==========================================

        /// <summary>
        /// Initialize the RTMP publisher.
        /// </summary>
        public bool Initialize(int width, int height, int fps, int bitrateKbps, int keyframeInterval = 2)
        {
            if (IsInitialized)
            {
                Debug.LogWarning("[FFmpegRTMP] Already initialized");
                return true;
            }

            // Check if native library is available
            if (!NativeFFmpegBridge.IsAvailable())
            {
                LastError = "Native FFmpeg library not available";
                Debug.LogError($"[FFmpegRTMP] {LastError}");
                return false;
            }

            Width = width;
            Height = height;
            FrameRate = fps;
            Bitrate = bitrateKbps;
            KeyframeInterval = keyframeInterval;

            // Initialize native library
            int result = NativeFFmpegBridge.rtmp_init_simple(
                width, height, fps, bitrateKbps, keyframeInterval,
                44100, 2, 128 // Audio defaults
            );

            if (result != NativeFFmpegBridge.RTMP_SUCCESS)
            {
                LastError = NativeFFmpegBridge.GetError();
                Debug.LogError($"[FFmpegRTMP] Init failed: {LastError}");
                return false;
            }

            // Create readback texture for GPU -> CPU transfer
            _readbackTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            
            // Allocate pixel buffer and pin it
            _pixelBuffer = new byte[width * height * 4];
            _pixelBufferHandle = GCHandle.Alloc(_pixelBuffer, GCHandleType.Pinned);
            _pixelBufferPtr = _pixelBufferHandle.AddrOfPinnedObject();

            // Check async readback support
            _asyncReadbackSupported = SystemInfo.supportsAsyncGPUReadback;
            
            Debug.Log($"[FFmpegRTMP] Initialized: {width}x{height} @ {fps}fps, {bitrateKbps}kbps");
            Debug.Log($"[FFmpegRTMP] Async GPU readback: {(_asyncReadbackSupported ? "supported" : "not supported")}");

            IsInitialized = true;
            return true;
        }

        /// <summary>
        /// Set the source RenderTexture to capture from.
        /// </summary>
        public void SetSourceTexture(RenderTexture texture)
        {
            _sourceTexture = texture;
        }

        // ==========================================
        // CONNECTION
        // ==========================================

        /// <summary>
        /// Connect to RTMPS server.
        /// </summary>
        /// <param name="rtmpUrl">Full RTMP URL including stream key</param>
        public bool Connect(string rtmpUrl)
        {
            if (!IsInitialized)
            {
                LastError = "Not initialized";
                return false;
            }

            if (IsConnected)
            {
                Debug.LogWarning("[FFmpegRTMP] Already connected");
                return true;
            }

            Debug.Log($"[FFmpegRTMP] Connecting to: {rtmpUrl.Substring(0, Math.Min(50, rtmpUrl.Length))}...");

            int result = NativeFFmpegBridge.rtmp_connect(rtmpUrl);
            if (result != NativeFFmpegBridge.RTMP_SUCCESS)
            {
                LastError = NativeFFmpegBridge.GetError();
                Debug.LogError($"[FFmpegRTMP] Connect failed: {LastError}");
                return false;
            }

            IsConnected = true;
            Debug.Log("[FFmpegRTMP] Connected successfully");
            return true;
        }

        /// <summary>
        /// Disconnect from server.
        /// </summary>
        public void Disconnect()
        {
            if (!IsConnected) return;

            if (IsStreaming)
            {
                StopStreaming();
            }

            NativeFFmpegBridge.rtmp_disconnect();
            IsConnected = false;
            Debug.Log("[FFmpegRTMP] Disconnected");
        }

        // ==========================================
        // STREAMING
        // ==========================================

        /// <summary>
        /// Start streaming.
        /// </summary>
        public bool StartStreaming()
        {
            if (!IsConnected)
            {
                LastError = "Not connected";
                return false;
            }

            if (IsStreaming)
            {
                return true;
            }

            int result = NativeFFmpegBridge.rtmp_start_streaming();
            if (result != NativeFFmpegBridge.RTMP_SUCCESS)
            {
                LastError = NativeFFmpegBridge.GetError();
                Debug.LogError($"[FFmpegRTMP] Start streaming failed: {LastError}");
                return false;
            }

            _startTime = GetTimestampMs();
            _frameCount = 0;
            IsStreaming = true;
            
            Debug.Log("[FFmpegRTMP] Streaming started");
            return true;
        }

        /// <summary>
        /// Stop streaming.
        /// </summary>
        public void StopStreaming()
        {
            if (!IsStreaming) return;

            NativeFFmpegBridge.rtmp_stop_streaming();
            IsStreaming = false;
            
            Debug.Log($"[FFmpegRTMP] Streaming stopped. Sent {FramesSent} frames, {BytesSent / 1024}KB, dropped {DroppedFrames}");
        }

        /// <summary>
        /// Send the current frame from the source texture.
        /// Call this from Update() or a coroutine.
        /// </summary>
        public void SendFrame()
        {
            if (!IsStreaming || _sourceTexture == null) return;

            long pts = GetTimestampMs() - _startTime;
            
            if (_asyncReadbackSupported)
            {
                // Use async readback (non-blocking)
                AsyncGPUReadback.Request(_sourceTexture, 0, TextureFormat.RGBA32, (request) =>
                {
                    if (request.hasError)
                    {
                        Debug.LogWarning("[FFmpegRTMP] Async readback failed");
                        return;
                    }

                    if (!IsStreaming) return;

                    var data = request.GetData<byte>();
                    data.CopyTo(_pixelBuffer);
                    SendVideoFrame(pts);
                });
            }
            else
            {
                // Fallback: synchronous readback (blocking)
                RenderTexture.active = _sourceTexture;
                _readbackTexture.ReadPixels(new Rect(0, 0, Width, Height), 0, 0, false);
                _readbackTexture.Apply();
                RenderTexture.active = null;

                _readbackTexture.GetRawTextureData<byte>().CopyTo(_pixelBuffer);
                SendVideoFrame(pts);
            }
        }

        /// <summary>
        /// Send frame from custom RGBA data.
        /// </summary>
        public void SendFrame(byte[] rgbaData, long ptsMs)
        {
            if (!IsStreaming) return;
            
            if (rgbaData.Length != Width * Height * 4)
            {
                Debug.LogError($"[FFmpegRTMP] Invalid data size: expected {Width * Height * 4}, got {rgbaData.Length}");
                return;
            }

            int result = NativeFFmpegBridge.rtmp_send_video_frame(rgbaData, rgbaData.Length, ptsMs);
            if (result != NativeFFmpegBridge.RTMP_SUCCESS)
            {
                LastError = NativeFFmpegBridge.GetError();
                Debug.LogWarning($"[FFmpegRTMP] Send frame failed: {LastError}");
            }
        }

        private void SendVideoFrame(long pts)
        {
            int result = NativeFFmpegBridge.rtmp_send_video_frame(_pixelBufferPtr, _pixelBuffer.Length, pts);
            if (result != NativeFFmpegBridge.RTMP_SUCCESS)
            {
                // Don't spam logs for occasional failures
                if (DroppedFrames % 100 == 1)
                {
                    Debug.LogWarning($"[FFmpegRTMP] Frame send failed (dropped: {DroppedFrames})");
                }
            }
            else
            {
                _frameCount++;
            }
        }

        /// <summary>
        /// Send audio samples.
        /// </summary>
        public void SendAudio(float[] samples, int numSamples)
        {
            if (!IsStreaming) return;

            long pts = GetTimestampMs() - _startTime;
            NativeFFmpegBridge.rtmp_send_audio(samples, numSamples, pts);
        }

        // ==========================================
        // HELPERS
        // ==========================================

        private long GetTimestampMs()
        {
            return (long)(Time.realtimeSinceStartup * 1000);
        }

        // ==========================================
        // CLEANUP
        // ==========================================

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            Disconnect();
            
            if (IsInitialized)
            {
                NativeFFmpegBridge.rtmp_cleanup();
                IsInitialized = false;
            }

            if (_pixelBufferHandle.IsAllocated)
            {
                _pixelBufferHandle.Free();
            }

            if (_readbackTexture != null)
            {
                UnityEngine.Object.Destroy(_readbackTexture);
                _readbackTexture = null;
            }

            Debug.Log("[FFmpegRTMP] Disposed");
        }

        ~FFmpegRTMPPublisher()
        {
            Dispose();
        }
    }

    /// <summary>
    /// MonoBehaviour wrapper for FFmpegRTMPPublisher.
    /// Handles Unity lifecycle and provides inspector configuration.
    /// </summary>
    public class FFmpegRTMPPublisherBehaviour : MonoBehaviour
    {
        [Header("Configuration")]
        public int width = 1280;
        public int height = 720;
        public int frameRate = 30;
        public int bitrateKbps = 3500;
        public int keyframeInterval = 2;

        [Header("Source")]
        public RenderTexture sourceTexture;
        public Camera sourceCamera;

        [Header("Target")]
        public string rtmpUrl;

        [Header("Audio")]
        public bool captureAudio = true;
        public AudioListener audioListener;

        [Header("State")]
        [SerializeField] private bool _isStreaming;
        [SerializeField] private int _framesSent;
        [SerializeField] private int _droppedFrames;
        [SerializeField] private float _bitrateMbps;

        private FFmpegRTMPPublisher _publisher;
        private RenderTexture _cameraTexture;
        private AudioCapture _audioCapture;
        private float _lastStatsUpdate;

        void Start()
        {
            // Create camera render texture if needed
            if (sourceTexture == null && sourceCamera != null)
            {
                _cameraTexture = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
                sourceCamera.targetTexture = _cameraTexture;
                sourceTexture = _cameraTexture;
            }

            // Initialize publisher
            _publisher = new FFmpegRTMPPublisher();
            if (!_publisher.Initialize(width, height, frameRate, bitrateKbps, keyframeInterval))
            {
                Debug.LogError("[FFmpegRTMP] Failed to initialize publisher");
                enabled = false;
                return;
            }

            _publisher.SetSourceTexture(sourceTexture);

            // Set up audio capture
            if (captureAudio)
            {
                _audioCapture = gameObject.AddComponent<AudioCapture>();
                _audioCapture.OnAudioData += OnAudioData;
            }
        }

        void Update()
        {
            if (_publisher == null) return;

            _isStreaming = _publisher.IsStreaming;

            if (_isStreaming)
            {
                _publisher.SendFrame();
            }

            // Update stats every second
            if (Time.time - _lastStatsUpdate > 1f)
            {
                _framesSent = _publisher.FramesSent;
                _droppedFrames = _publisher.DroppedFrames;
                _bitrateMbps = (_publisher.BytesSent * 8f) / (Time.realtimeSinceStartup * 1000000f);
                _lastStatsUpdate = Time.time;
            }
        }

        void OnDestroy()
        {
            _publisher?.Dispose();
            
            if (_cameraTexture != null)
            {
                _cameraTexture.Release();
                Destroy(_cameraTexture);
            }
        }

        /// <summary>
        /// Connect and start streaming.
        /// </summary>
        public void StartStream()
        {
            if (_publisher == null || string.IsNullOrEmpty(rtmpUrl))
            {
                Debug.LogError("[FFmpegRTMP] Publisher not ready or URL not set");
                return;
            }

            if (_publisher.Connect(rtmpUrl))
            {
                _publisher.StartStreaming();
            }
        }

        /// <summary>
        /// Stop streaming and disconnect.
        /// </summary>
        public void StopStream()
        {
            _publisher?.Disconnect();
        }

        private void OnAudioData(float[] data, int channels)
        {
            if (_publisher != null && _publisher.IsStreaming)
            {
                _publisher.SendAudio(data, data.Length / channels);
            }
        }
    }

    /// <summary>
    /// Simple audio capture component using OnAudioFilterRead.
    /// </summary>
    public class AudioCapture : MonoBehaviour
    {
        public event Action<float[], int> OnAudioData;

        private int _sampleRate;
        private int _channels;

        void Start()
        {
            _sampleRate = AudioSettings.outputSampleRate;
            AudioSettings.GetDSPBufferSize(out int bufferLength, out int numBuffers);
            
            var config = AudioSettings.GetConfiguration();
            _channels = (int)config.speakerMode;
            if (_channels == 0) _channels = 2; // Default stereo
        }

        void OnAudioFilterRead(float[] data, int channels)
        {
            OnAudioData?.Invoke(data, channels);
        }
    }
}

