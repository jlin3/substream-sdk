using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.Events;
using Unity.WebRTC;
using TMPro;

namespace Substream.Streaming
{
    /// <summary>
    /// WHIP Stream Control - WebRTC streaming to AWS IVS via WHIP protocol.
    /// 
    /// This is the "no FFmpeg" path for streaming from Unity to IVS.
    /// Uses standard WebRTC with WHIP (WebRTC-HTTP Ingestion Protocol).
    /// 
    /// Usage:
    /// 1. Add this component to a GameObject
    /// 2. Configure Backend URL, Child ID, and Auth Token
    /// 3. Press U to toggle streaming (or call StartStreaming()/StopStreaming())
    /// 
    /// Requirements:
    /// - Unity WebRTC package (com.unity.webrtc@3.0.0-pre.7 or later)
    /// - Backend with WHIP endpoint (/api/streams/whip)
    /// </summary>
    public class WhipStreamControl : MonoBehaviour
    {
        // ============================================
        // INSPECTOR SETTINGS
        // ============================================
        
        [Header("Backend Configuration")]
        [Tooltip("Backend API URL (e.g., https://your-backend.up.railway.app)")]
        public string backendUrl = "https://substream-sdk-production.up.railway.app";
        
        [Tooltip("Child ID for this streamer")]
        public string childId = "demo-child-001";
        
        [Tooltip("Auth token for API calls")]
        public string authToken = "demo-token";
        
        [Header("Video Settings (IVS Constraints)")]
        [Tooltip("Stream width (max 1280 for IVS WHIP)")]
        [Range(320, 1280)]
        public int streamWidth = 1280;
        
        [Tooltip("Stream height (max 720 for IVS WHIP)")]
        [Range(180, 720)]
        public int streamHeight = 720;
        
        [Tooltip("Target framerate (max 30 for stability)")]
        [Range(15, 30)]
        public int streamFramerate = 30;
        
        [Tooltip("Target bitrate in bps (2.5 Mbps recommended for 720p)")]
        [Range(500000, 8500000)]
        public int streamBitrateBps = 2500000;
        
        [Tooltip("IDR/Keyframe interval in seconds (IVS requires 2)")]
        [Range(1, 4)]
        public int keyframeIntervalSeconds = 2;
        
        [Header("Camera Source")]
        [Tooltip("Camera to stream (leave null for main camera)")]
        public Camera sourceCamera;
        
        [Tooltip("Render texture to stream (alternative to camera)")]
        public RenderTexture sourceTexture;
        
        [Header("UI References (Optional)")]
        public TMP_Text statusText;
        public TMP_Text errorText;
        
        [Header("Events")]
        public UnityEvent OnStreamStarted;
        public UnityEvent OnStreamStopped;
        public UnityEvent<string> OnStreamError;
        
        // ============================================
        // STATE
        // ============================================
        
        private bool _isStreaming = false;
        private string _currentStreamId;
        private string _whipSessionUrl;
        private string _whipETag;
        private string _publishToken;
        
        // WebRTC
        private RTCPeerConnection _peerConnection;
        private MediaStream _mediaStream;
        private VideoStreamTrack _videoTrack;
        private AudioStreamTrack _audioTrack;
        private Camera _streamCamera;
        private RenderTexture _streamTexture;
        private bool _needsTextureBlit = false;
        private RenderTexture _sourceTextureForBlit;
        
        // ICE gathering
        private List<RTCIceCandidate> _pendingCandidates = new List<RTCIceCandidate>();
        private bool _iceGatheringComplete = false;
        private Coroutine _icePatchCoroutine;
        
        // ============================================
        // PUBLIC PROPERTIES
        // ============================================
        
        public bool IsStreaming => _isStreaming;
        public string CurrentStreamId => _currentStreamId;
        
        // ============================================
        // LIFECYCLE
        // ============================================
        
        void Start()
        {
            // Load config from PlayerPrefs if not set
            LoadSavedConfig();
            
            // Setup camera for streaming
            SetupStreamCamera();
            
            UpdateStatus("Ready to stream (WHIP)");
        }
        
        void Update()
        {
            // Toggle streaming with U key
            if (Input.GetKeyDown(KeyCode.U))
            {
                ToggleStreaming();
            }
            
            // Blit source texture to stream texture if format conversion is needed
            if (_needsTextureBlit && _isStreaming && _sourceTextureForBlit != null && _streamTexture != null)
            {
                Graphics.Blit(_sourceTextureForBlit, _streamTexture);
            }
        }
        
        void OnDestroy()
        {
            if (_isStreaming)
            {
                StopStreamingImmediate();
            }
            
            CleanupWebRTC();
            
            if (_streamTexture != null)
            {
                _streamTexture.Release();
                Destroy(_streamTexture);
            }
        }
        
        // ============================================
        // PUBLIC API
        // ============================================
        
        public void ToggleStreaming()
        {
            if (_isStreaming)
                StopStreaming();
            else
                StartStreaming();
        }
        
        public void StartStreaming()
        {
            if (_isStreaming)
            {
                Debug.LogWarning("[WHIP] Already streaming");
                return;
            }
            
            StartCoroutine(StartStreamingCoroutine());
        }
        
        public void StopStreaming()
        {
            if (!_isStreaming)
            {
                Debug.LogWarning("[WHIP] Not currently streaming");
                return;
            }
            
            StartCoroutine(StopStreamingCoroutine());
        }
        
        public void SetConfig(string backendUrl, string childId, string authToken)
        {
            this.backendUrl = backendUrl;
            this.childId = childId;
            this.authToken = authToken;
            SaveConfig();
        }
        
        // ============================================
        // STREAMING FLOW
        // ============================================
        
        private IEnumerator StartStreamingCoroutine()
        {
            UpdateStatus("Starting WHIP stream...");
            
            // Step 1: Request WHIP credentials from backend
            yield return RequestWhipCredentials();
            
            if (string.IsNullOrEmpty(_publishToken))
            {
                ShowError("Failed to get WHIP credentials");
                yield break;
            }
            
            UpdateStatus("Connecting to IVS...");
            
            // Step 2: Setup WebRTC peer connection
            try
            {
                SetupPeerConnection();
                SetupMediaTracks();
            }
            catch (Exception e)
            {
                ShowError($"WebRTC setup failed: {e.Message}");
                CleanupWebRTC();
                yield break;
            }
            
            // Step 3: Create offer
            var offerOp = _peerConnection.CreateOffer();
            yield return offerOp;
            
            if (offerOp.IsError)
            {
                ShowError($"Failed to create offer: {offerOp.Error.message}");
                CleanupWebRTC();
                yield break;
            }
            
            var offer = offerOp.Desc;
            
            // Modify SDP for IVS compliance (H.264 baseline, bitrate constraints)
            offer.sdp = ModifySdpForIvs(offer.sdp);
            
            // Step 4: Set local description (starts ICE gathering)
            var setLocalOp = _peerConnection.SetLocalDescription(ref offer);
            yield return setLocalOp;
            
            if (setLocalOp.IsError)
            {
                ShowError($"Failed to set local description: {setLocalOp.Error.message}");
                CleanupWebRTC();
                yield break;
            }
            
            UpdateStatus("Connecting to WHIP...");
            
            // Step 5: Send offer to WHIP endpoint
            bool whipSuccess = false;
            string whipError = null;
            WhipClient.WhipSessionInfo sessionInfo = null;
            
            WhipClient.PostOffer(
                this,
                WhipClient.GlobalWhipEndpoint,
                _publishToken,
                offer.sdp,
                (info) => {
                    sessionInfo = info;
                    whipSuccess = true;
                },
                (error) => {
                    whipError = error;
                }
            );
            
            // Wait for WHIP response
            float timeout = 15f;
            while (!whipSuccess && whipError == null && timeout > 0)
            {
                yield return null;
                timeout -= Time.deltaTime;
            }
            
            if (!whipSuccess)
            {
                ShowError(whipError ?? "WHIP connection timeout");
                CleanupWebRTC();
                yield break;
            }
            
            _whipSessionUrl = sessionInfo.SessionUrl;
            _whipETag = sessionInfo.ETag;
            
            // Step 6: Apply ICE servers from WHIP response
            if (sessionInfo.IceServers != null && sessionInfo.IceServers.Length > 0)
            {
                var config = _peerConnection.GetConfiguration();
                var newServers = new List<RTCIceServer>(config.iceServers);
                newServers.AddRange(sessionInfo.IceServers);
                config.iceServers = newServers.ToArray();
                _peerConnection.SetConfiguration(ref config);
                Debug.Log($"[WHIP] Applied {sessionInfo.IceServers.Length} ICE servers from WHIP");
            }
            
            // Step 7: Set remote description (SDP answer)
            var answer = new RTCSessionDescription
            {
                type = RTCSdpType.Answer,
                sdp = sessionInfo.AnswerSdp
            };
            
            var setRemoteOp = _peerConnection.SetRemoteDescription(ref answer);
            yield return setRemoteOp;
            
            if (setRemoteOp.IsError)
            {
                ShowError($"Failed to set remote description: {setRemoteOp.Error.message}");
                CleanupWebRTC();
                yield break;
            }
            
            // Step 8: Send ICE candidates via PATCH
            yield return SendIceCandidates();
            
            _isStreaming = true;
            UpdateStatus("🔴 LIVE (WHIP)");
            Debug.Log($"[WHIP] Streaming started. Stream ID: {_currentStreamId}");
            
            OnStreamStarted?.Invoke();
        }
        
        private IEnumerator StopStreamingCoroutine()
        {
            UpdateStatus("Stopping stream...");
            
            // Stop ICE patch coroutine
            if (_icePatchCoroutine != null)
            {
                StopCoroutine(_icePatchCoroutine);
                _icePatchCoroutine = null;
            }
            
            // Send DELETE to WHIP session
            if (!string.IsNullOrEmpty(_whipSessionUrl))
            {
                bool deleteComplete = false;
                
                WhipClient.DeleteSession(
                    this,
                    _whipSessionUrl,
                    _publishToken,
                    () => deleteComplete = true,
                    (error) => {
                        Debug.LogWarning($"[WHIP] DELETE failed: {error}");
                        deleteComplete = true;
                    }
                );
                
                // Wait for delete (with timeout)
                float timeout = 5f;
                while (!deleteComplete && timeout > 0)
                {
                    yield return null;
                    timeout -= Time.deltaTime;
                }
            }
            
            // Notify backend
            if (!string.IsNullOrEmpty(_currentStreamId))
            {
                yield return NotifyBackendStreamEnded();
            }
            
            // Cleanup WebRTC
            CleanupWebRTC();
            
            _isStreaming = false;
            _currentStreamId = null;
            _whipSessionUrl = null;
            _whipETag = null;
            _publishToken = null;
            
            UpdateStatus("Stream stopped");
            Debug.Log("[WHIP] Streaming stopped");
            
            OnStreamStopped?.Invoke();
        }
        
        private void StopStreamingImmediate()
        {
            if (_icePatchCoroutine != null)
            {
                StopCoroutine(_icePatchCoroutine);
                _icePatchCoroutine = null;
            }
            
            CleanupWebRTC();
            
            _isStreaming = false;
            _currentStreamId = null;
            _whipSessionUrl = null;
            _whipETag = null;
            _publishToken = null;
        }
        
        // ============================================
        // BACKEND API
        // ============================================
        
        private IEnumerator RequestWhipCredentials()
        {
            string url = $"{backendUrl}/api/streams/whip";
            
            var requestBody = new WhipStartRequest { childId = this.childId };
            string json = JsonUtility.ToJson(requestBody);
            
            using (var request = new UnityWebRequest(url, "POST"))
            {
                byte[] bodyBytes = System.Text.Encoding.UTF8.GetBytes(json);
                request.uploadHandler = new UploadHandlerRaw(bodyBytes);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");
                request.SetRequestHeader("Authorization", $"Bearer {authToken}");
                
                yield return request.SendWebRequest();
                
                if (request.result != UnityWebRequest.Result.Success)
                {
                    Debug.LogError($"[WHIP] Failed to get credentials: {request.error}");
                    Debug.LogError($"[WHIP] Response: {request.downloadHandler?.text}");
                    yield break;
                }
                
                try
                {
                    var response = JsonUtility.FromJson<WhipStartResponse>(request.downloadHandler.text);
                    _currentStreamId = response.streamId;
                    _publishToken = response.publishToken;
                    
                    Debug.Log($"[WHIP] Got credentials. Stream: {_currentStreamId}");
                    Debug.Log($"[WHIP] WHIP URL: {response.whipUrl}");
                }
                catch (Exception e)
                {
                    Debug.LogError($"[WHIP] Failed to parse response: {e.Message}");
                }
            }
        }
        
        private IEnumerator NotifyBackendStreamEnded()
        {
            string url = $"{backendUrl}/api/streams/whip";
            
            var requestBody = new WhipStopRequest { streamId = _currentStreamId };
            string json = JsonUtility.ToJson(requestBody);
            
            using (var request = new UnityWebRequest(url, "DELETE"))
            {
                byte[] bodyBytes = System.Text.Encoding.UTF8.GetBytes(json);
                request.uploadHandler = new UploadHandlerRaw(bodyBytes);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");
                request.SetRequestHeader("Authorization", $"Bearer {authToken}");
                
                yield return request.SendWebRequest();
                
                // Don't fail if backend notification fails
                if (request.result != UnityWebRequest.Result.Success)
                {
                    Debug.LogWarning($"[WHIP] Failed to notify backend of stream end: {request.error}");
                }
            }
        }
        
        // ============================================
        // WEBRTC SETUP
        // ============================================
        
        private void SetupPeerConnection()
        {
            // ICE configuration with public STUN servers
            var config = new RTCConfiguration
            {
                iceServers = new[]
                {
                    new RTCIceServer { urls = new[] { "stun:stun.l.google.com:19302" } },
                    new RTCIceServer { urls = new[] { "stun:stun1.l.google.com:19302" } },
                }
            };
            
            _peerConnection = new RTCPeerConnection(ref config);
            
            // Configure codec preferences for IVS compliance (H.264 baseline, no B-frames)
            ConfigureCodecPreferences();
            
            // Handle ICE candidates
            _peerConnection.OnIceCandidate = (candidate) =>
            {
                if (candidate != null)
                {
                    _pendingCandidates.Add(candidate);
                    Debug.Log($"[WHIP] ICE candidate: {candidate.Candidate}");
                }
            };
            
            _peerConnection.OnIceGatheringStateChange = (state) =>
            {
                Debug.Log($"[WHIP] ICE gathering state: {state}");
                if (state == RTCIceGatheringState.Complete)
                {
                    _iceGatheringComplete = true;
                }
            };
            
            _peerConnection.OnConnectionStateChange = (state) =>
            {
                Debug.Log($"[WHIP] Connection state: {state}");
                
                if (state == RTCPeerConnectionState.Connected)
                {
                    UpdateStatus("🔴 LIVE (WHIP)");
                }
                else if (state == RTCPeerConnectionState.Failed)
                {
                    ShowError("WebRTC connection failed");
                    StopStreaming();
                }
                else if (state == RTCPeerConnectionState.Disconnected)
                {
                    UpdateStatus("Reconnecting...");
                }
            };
        }
        
        /// <summary>
        /// Configures codec preferences for IVS Real-Time compliance.
        /// IVS WHIP requires:
        /// - H.264 Baseline profile
        /// - No B-frames (baseline inherently has none)
        /// - Max 720p resolution
        /// - IDR frames every 2 seconds
        /// </summary>
        private void ConfigureCodecPreferences()
        {
            // Get available codecs and prioritize H.264
            var senders = _peerConnection.GetTransceivers();
            foreach (var transceiver in senders)
            {
                if (transceiver.Receiver.Track.Kind == TrackKind.Video)
                {
                    var codecs = RTCRtpSender.GetCapabilities(TrackKind.Video).codecs;
                    var h264Codecs = new List<RTCRtpCodecCapability>();
                    
                    foreach (var codec in codecs)
                    {
                        // Prefer H.264 baseline profile for IVS compatibility
                        if (codec.mimeType == "video/H264")
                        {
                            // Check for baseline profile (profile-level-id starts with 42)
                            if (codec.sdpFmtpLine?.Contains("profile-level-id=42") == true)
                            {
                                h264Codecs.Insert(0, codec); // Prioritize baseline
                            }
                            else
                            {
                                h264Codecs.Add(codec);
                            }
                        }
                    }
                    
                    if (h264Codecs.Count > 0)
                    {
                        transceiver.SetCodecPreferences(h264Codecs.ToArray());
                        Debug.Log($"[WHIP] Set H.264 codec preferences ({h264Codecs.Count} variants)");
                    }
                    else
                    {
                        Debug.LogWarning("[WHIP] H.264 codec not found - IVS may reject stream");
                    }
                }
            }
        }
        
        private void SetupMediaTracks()
        {
            _mediaStream = new MediaStream();
            
            // Video track from camera/texture with constrained resolution
            if (_streamTexture != null)
            {
                // Clamp resolution to IVS maximums
                int constrainedWidth = Mathf.Min(streamWidth, 1280);
                int constrainedHeight = Mathf.Min(streamHeight, 720);
                
                _videoTrack = new VideoStreamTrack(_streamTexture);
                _mediaStream.AddTrack(_videoTrack);
                
                // Add track to peer connection with sender for bitrate control
                var sender = _peerConnection.AddTrack(_videoTrack, _mediaStream);
                
                // Configure encoding parameters
                ConfigureVideoEncoding(sender);
                
                Debug.Log($"[WHIP] Added video track: {constrainedWidth}x{constrainedHeight}@{streamFramerate}fps");
            }
            
            // Audio track (optional - uses default audio source)
            // Note: Audio requires AudioListener or AudioSource setup
            // For now, we'll skip audio in this implementation
            
            Debug.Log("[WHIP] Media tracks configured");
        }
        
        /// <summary>
        /// Configures video encoding parameters for the RTP sender.
        /// Sets bitrate limits and other encoding constraints.
        /// </summary>
        private void ConfigureVideoEncoding(RTCRtpSender sender)
        {
            if (sender == null) return;
            
            var parameters = sender.GetParameters();
            if (parameters.encodings == null || parameters.encodings.Length == 0)
            {
                parameters.encodings = new RTCRtpEncodingParameters[1];
                parameters.encodings[0] = new RTCRtpEncodingParameters();
            }
            
            var encoding = parameters.encodings[0];
            
            // Set bitrate constraints
            encoding.maxBitrate = (ulong)streamBitrateBps;
            encoding.minBitrate = (ulong)(streamBitrateBps / 4); // Min 25% of max
            
            // Set framerate (though this is also controlled by capture)
            encoding.maxFramerate = (uint)streamFramerate;
            
            // Disable scalability modes that might use B-frames
            // encoding.scalabilityMode = "L1T1"; // Single layer, no temporal scalability
            
            sender.SetParameters(parameters);
            
            Debug.Log($"[WHIP] Video encoding configured: {streamBitrateBps / 1000}kbps max @ {streamFramerate}fps");
        }
        
        /// <summary>
        /// Modifies SDP for IVS Real-Time compatibility.
        /// - Prioritizes H.264 baseline profile (profile-level-id 42e0xx or 42001f)
        /// - Sets appropriate bitrate constraints
        /// - Ensures proper keyframe interval settings
        /// </summary>
        private string ModifySdpForIvs(string sdp)
        {
            if (string.IsNullOrEmpty(sdp)) return sdp;
            
            var lines = sdp.Split('\n');
            var modifiedLines = new List<string>();
            bool inVideoSection = false;
            string videoPayloadType = null;
            
            foreach (var line in lines)
            {
                string modifiedLine = line;
                
                // Detect video m-line
                if (line.StartsWith("m=video"))
                {
                    inVideoSection = true;
                    // Extract first payload type (usually the preferred codec)
                    var parts = line.Split(' ');
                    if (parts.Length > 3)
                    {
                        videoPayloadType = parts[3]; // First payload type
                    }
                }
                else if (line.StartsWith("m="))
                {
                    inVideoSection = false;
                }
                
                // Add bitrate constraints to video section
                if (inVideoSection)
                {
                    // Check for H.264 fmtp line and ensure baseline profile
                    if (line.Contains("a=fmtp:") && line.Contains("H264"))
                    {
                        // Ensure profile-level-id is baseline (42 prefix)
                        // and add appropriate parameters
                        if (!line.Contains("profile-level-id=42"))
                        {
                            // Try to modify to baseline if possible
                            modifiedLine = line.Replace("profile-level-id=64", "profile-level-id=42");
                        }
                        
                        // Add keyframe interval if not present (x-google-max-keyframe-interval)
                        if (!line.Contains("x-google-"))
                        {
                            modifiedLine = modifiedLine.TrimEnd();
                            if (!modifiedLine.EndsWith(";")) modifiedLine += ";";
                            modifiedLine += $" x-google-max-keyframe-interval={keyframeIntervalSeconds * 1000}";
                        }
                    }
                    
                    // Add bandwidth constraint if we hit c= line in video
                    if (line.StartsWith("c=IN") && !modifiedLines.Any(l => l.Contains("b=AS:")))
                    {
                        modifiedLines.Add(modifiedLine);
                        // Add bandwidth constraint (AS = Application Specific, in kbps)
                        modifiedLines.Add($"b=AS:{streamBitrateBps / 1000}");
                        continue;
                    }
                }
                
                modifiedLines.Add(modifiedLine);
            }
            
            string result = string.Join("\n", modifiedLines);
            Debug.Log($"[WHIP] Modified SDP for IVS compatibility");
            return result;
        }
        
        private void CleanupWebRTC()
        {
            if (_videoTrack != null)
            {
                _videoTrack.Dispose();
                _videoTrack = null;
            }
            
            if (_audioTrack != null)
            {
                _audioTrack.Dispose();
                _audioTrack = null;
            }
            
            if (_mediaStream != null)
            {
                _mediaStream.Dispose();
                _mediaStream = null;
            }
            
            if (_peerConnection != null)
            {
                _peerConnection.Close();
                _peerConnection.Dispose();
                _peerConnection = null;
            }
            
            _pendingCandidates.Clear();
            _iceGatheringComplete = false;
        }
        
        // ============================================
        // ICE HANDLING
        // ============================================
        
        private IEnumerator SendIceCandidates()
        {
            // Wait for ICE gathering to complete or timeout
            float timeout = 10f;
            while (!_iceGatheringComplete && timeout > 0)
            {
                yield return new WaitForSeconds(0.5f);
                timeout -= 0.5f;
            }
            
            if (_pendingCandidates.Count == 0)
            {
                Debug.LogWarning("[WHIP] No ICE candidates gathered");
                yield break;
            }
            
            // Build SDP fragment
            string localSdp = _peerConnection.LocalDescription.sdp;
            string sdpFrag = WhipClient.BuildSdpFragment(localSdp, _pendingCandidates, _iceGatheringComplete);
            
            // Send via PATCH
            bool patchComplete = false;
            string patchError = null;
            
            WhipClient.PatchIceCandidates(
                this,
                _whipSessionUrl,
                _publishToken,
                _whipETag,
                sdpFrag,
                () => patchComplete = true,
                (error) => {
                    patchError = error;
                    patchComplete = true;
                }
            );
            
            // Wait for PATCH
            timeout = 10f;
            while (!patchComplete && timeout > 0)
            {
                yield return null;
                timeout -= Time.deltaTime;
            }
            
            if (!string.IsNullOrEmpty(patchError))
            {
                Debug.LogWarning($"[WHIP] ICE PATCH failed: {patchError}");
                // Don't fail the stream - connection might still work
            }
            
            _pendingCandidates.Clear();
        }
        
        // ============================================
        // CAMERA SETUP
        // ============================================
        
        private void SetupStreamCamera()
        {
            // Use provided texture or create one
            if (sourceTexture != null)
            {
                // Validate texture format - WebRTC requires BGRA
                if (sourceTexture.graphicsFormat != UnityEngine.Experimental.Rendering.GraphicsFormat.B8G8R8A8_UNorm)
                {
                    Debug.LogWarning($"[WHIP] Source texture format {sourceTexture.graphicsFormat} may not be supported. " +
                        "WebRTC requires B8G8R8A8_UNorm (BGRA). Creating compatible texture instead.");
                    
                    // Create a compatible texture and blit from source
                    int width = Mathf.Min(sourceTexture.width, 1280);
                    int height = Mathf.Min(sourceTexture.height, 720);
                    _streamTexture = new RenderTexture(width, height, 0, UnityEngine.Experimental.Rendering.GraphicsFormat.B8G8R8A8_UNorm);
                    _streamTexture.Create();
                    
                    // We'll need to blit each frame - set up a flag
                    _needsTextureBlit = true;
                    _sourceTextureForBlit = sourceTexture;
                }
                else
                {
                    _streamTexture = sourceTexture;
                }
            }
            else
            {
                // Create render texture for streaming
                // IVS max is 720p, but we allow configurable resolution
                int width = Mathf.Min(streamWidth, 1280);
                int height = Mathf.Min(streamHeight, 720);
                
                // IMPORTANT: Unity WebRTC requires B8G8R8A8_UNorm (BGRA) format
                // Using ARGB32/RGBA will cause "graphics format not supported" error
                _streamTexture = new RenderTexture(width, height, 24, UnityEngine.Experimental.Rendering.GraphicsFormat.B8G8R8A8_UNorm);
                _streamTexture.Create();
                
                // Setup camera if not using provided texture
                _streamCamera = sourceCamera ?? Camera.main;
                
                if (_streamCamera != null)
                {
                    // Create a dedicated stream camera that renders to our texture
                    var streamCamGo = new GameObject("WhipStreamCamera");
                    var streamCam = streamCamGo.AddComponent<Camera>();
                    streamCam.CopyFrom(_streamCamera);
                    streamCam.targetTexture = _streamTexture;
                    streamCam.enabled = true;
                    
                    // Parent to source camera so it follows
                    streamCamGo.transform.SetParent(_streamCamera.transform);
                    streamCamGo.transform.localPosition = Vector3.zero;
                    streamCamGo.transform.localRotation = Quaternion.identity;
                    
                    Debug.Log($"[WHIP] Stream camera setup: {width}x{height}");
                }
            }
        }
        
        // ============================================
        // CONFIG PERSISTENCE
        // ============================================
        
        private void LoadSavedConfig()
        {
            if (string.IsNullOrEmpty(authToken) || authToken == "demo-token")
            {
                string saved = PlayerPrefs.GetString("WhipAuthToken", "");
                if (!string.IsNullOrEmpty(saved)) authToken = saved;
            }
            
            if (string.IsNullOrEmpty(childId) || childId == "demo-child-001")
            {
                string saved = PlayerPrefs.GetString("WhipChildId", "");
                if (!string.IsNullOrEmpty(saved)) childId = saved;
            }
        }
        
        private void SaveConfig()
        {
            PlayerPrefs.SetString("WhipAuthToken", authToken);
            PlayerPrefs.SetString("WhipChildId", childId);
            PlayerPrefs.Save();
        }
        
        // ============================================
        // UI
        // ============================================
        
        private void UpdateStatus(string message)
        {
            Debug.Log($"[WHIP] Status: {message}");
            if (statusText != null)
                statusText.text = message;
        }
        
        private void ShowError(string message)
        {
            Debug.LogError($"[WHIP] Error: {message}");
            if (errorText != null)
                errorText.text = message;
            
            OnStreamError?.Invoke(message);
        }
        
        // ============================================
        // JSON TYPES
        // ============================================
        
        [Serializable]
        private class WhipStartRequest
        {
            public string childId;
        }
        
        [Serializable]
        private class WhipStartResponse
        {
            public string streamId;
            public string stageArn;
            public string whipUrl;
            public string publishToken;
            public string participantId;
            public string expiresAt;
            public string region;
        }
        
        [Serializable]
        private class WhipStopRequest
        {
            public string streamId;
        }
    }
}
