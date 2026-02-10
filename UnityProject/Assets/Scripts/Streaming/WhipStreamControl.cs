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
        
        [Tooltip("Use screen capture instead of dedicated camera (fallback for edge cases)")]
        public bool useScreenCapture = false;
        
        [Header("Audio")]
        [Tooltip("Enable audio streaming from the game's AudioListener")]
        public bool enableAudio = true;
        
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
        private string _whipUrl; // IVS-specific WHIP URL from backend
        
        // WebRTC
        private RTCPeerConnection _peerConnection;
        private MediaStream _mediaStream;
        private VideoStreamTrack _videoTrack;
        private AudioStreamTrack _audioTrack;
        private Camera _streamCamera;
        private RenderTexture _streamTexture;
        private bool _ownsStreamTexture = false; // Track if we created the texture
        private bool _needsTextureBlit = false;
        private RenderTexture _sourceTextureForBlit;
        private GameObject _streamCameraGo; // Track for cleanup
        
        // ICE gathering
        private List<RTCIceCandidate> _pendingCandidates = new List<RTCIceCandidate>();
        private bool _iceGatheringComplete = false;
        private Coroutine _icePatchCoroutine;
        
        // ============================================
        // PUBLIC PROPERTIES
        // ============================================
        
        public bool IsStreaming => _isStreaming;
        public string CurrentStreamId => _currentStreamId;
        
        /// <summary>Returns the current stream ID (same as CurrentStreamId property).</summary>
        public string GetCurrentStreamId() => _currentStreamId;
        
        /// <summary>Returns the full viewer URL for parents to watch this stream.</summary>
        public string GetViewerUrl()
        {
            if (string.IsNullOrEmpty(_currentStreamId)) return null;
            return $"{backendUrl}/viewer/{_currentStreamId}";
        }
        
        // ============================================
        // LIFECYCLE
        // ============================================
        
        void Start()
        {
            // REQUIRED: Unity WebRTC needs this coroutine to pump video frames
            StartCoroutine(WebRTC.Update());
            
            // Load config from PlayerPrefs if not set
            LoadSavedConfig();
            
            // NOTE: SetupStreamCamera() is called lazily in StartStreamingCoroutine()
            // because Camera.main may not be available yet during Start().
            
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
            
            // Stop screen capture coroutine
            if (_screenCaptureCoroutine != null)
            {
                StopCoroutine(_screenCaptureCoroutine);
                _screenCaptureCoroutine = null;
            }
            
            // Only destroy textures we created (not user's sourceTexture)
            if (_streamTexture != null && _ownsStreamTexture)
            {
                _streamTexture.Release();
                Destroy(_streamTexture);
            }
            
            // Destroy the stream camera if we created one
            if (_streamCameraGo != null)
            {
                Destroy(_streamCameraGo);
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
            
            // Step 0: Setup stream camera (deferred from Start() because Camera.main
            // may not be available during scene loading)
            if (_streamTexture == null)
            {
                SetupStreamCamera();
                
                if (_streamTexture == null)
                {
                    ShowError("Failed to setup stream camera/texture");
                    yield break;
                }
            }
            
            // Step 1: Request WHIP credentials from backend
            yield return RequestWhipCredentials();
            
            if (string.IsNullOrEmpty(_publishToken))
            {
                ShowError("Failed to get WHIP credentials");
                yield break;
            }
            
            UpdateStatus("Connecting to IVS...");
            
            // Step 2: Setup WebRTC peer connection and media tracks
            try
            {
                SetupPeerConnection();
                SetupMediaTracks();
                
                // Configure codec preferences AFTER tracks are added (transceivers exist now)
                ConfigureCodecPreferences();
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
            
            Debug.Log($"[WHIP] Local description set. Signaling state: {_peerConnection.SignalingState}");
            
            // Step 5: Wait for ICE gathering to complete (Full Gathering approach)
            // Per WHIP RFC 9725, we can send the offer with all candidates included,
            // eliminating the need for PATCH/ETag handling entirely.
            UpdateStatus("Gathering ICE candidates...");
            float iceTimeout = 10f;
            while (!_iceGatheringComplete && iceTimeout > 0)
            {
                yield return new WaitForSeconds(0.5f);
                iceTimeout -= 0.5f;
            }
            
            if (!_iceGatheringComplete)
            {
                Debug.LogWarning("[WHIP] ICE gathering timed out, proceeding with available candidates");
            }
            
            Debug.Log($"[WHIP] ICE gathering done. {_pendingCandidates.Count} candidates found");
            
            // Step 6: Read the complete local description (now contains all ICE candidates)
            string fullOfferSdp = _peerConnection.LocalDescription.sdp;
            
            UpdateStatus("Connecting to WHIP...");
            
            // Step 7: Send complete offer (with candidates) to WHIP endpoint
            bool whipSuccess = false;
            string whipError = null;
            WhipClient.WhipSessionInfo sessionInfo = null;
            
            // Use the IVS-specific WHIP URL from backend, fall back to global
            string whipEndpoint = !string.IsNullOrEmpty(_whipUrl) ? _whipUrl : WhipClient.GlobalWhipEndpoint;
            Debug.Log($"[WHIP] Sending SDP offer to: {whipEndpoint}");
            
            WhipClient.PostOffer(
                this,
                whipEndpoint,
                _publishToken,
                fullOfferSdp, // Full offer with all ICE candidates
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
            
            // Step 8: Set remote description (SDP answer from IVS)
            // Check signaling state first. After sending the full offer (with all ICE
            // candidates) to IVS via WHIP POST, IVS immediately starts its ICE agent.
            // In some cases, Unity's WebRTC layer may auto-complete the negotiation
            // before we explicitly call SetRemoteDescription, leaving the peer connection
            // in "stable" state. If that happens, the exchange already completed and we
            // can safely continue.
            var currentSignalingState = _peerConnection.SignalingState;
            Debug.Log($"[WHIP] Signaling state before SetRemoteDescription: {currentSignalingState}");
            
            if (currentSignalingState == RTCSignalingState.Stable)
            {
                Debug.LogWarning("[WHIP] Signaling state already stable - SDP exchange " +
                    "auto-completed (ICE connected before explicit SetRemoteDescription). " +
                    "Continuing normally.");
            }
            else
            {
                var answer = new RTCSessionDescription
                {
                    type = RTCSdpType.Answer,
                    sdp = sessionInfo.AnswerSdp
                };
                
                var setRemoteOp = _peerConnection.SetRemoteDescription(ref answer);
                yield return setRemoteOp;
                
                if (setRemoteOp.IsError)
                {
                    // If the state became stable during the async operation, treat as success
                    var postOpState = _peerConnection.SignalingState;
                    if (postOpState == RTCSignalingState.Stable)
                    {
                        Debug.LogWarning($"[WHIP] SetRemoteDescription reported error " +
                            $"({setRemoteOp.Error.message}) but signaling state is stable. " +
                            "Treating as success.");
                    }
                    else
                    {
                        ShowError($"Failed to set remote description: {setRemoteOp.Error.message}");
                        CleanupWebRTC();
                        yield break;
                    }
                }
            }
            
            // No PATCH needed - all candidates were in the offer (Full Gathering approach)
            Debug.Log("[WHIP] Full ICE gathering approach - no PATCH needed");
            _pendingCandidates.Clear();
            
            _isStreaming = true;
            UpdateStatus("🔴 LIVE (WHIP)");
            Debug.Log($"[WHIP] Streaming started. Stream ID: {_currentStreamId}");
            
            // Start periodic stats logging to verify frames are being sent
            StartCoroutine(LogWebRtcStats());
            
            OnStreamStarted?.Invoke();
        }
        
        /// <summary>
        /// Periodically logs WebRTC stats to verify video frames are being encoded and sent.
        /// Critical for diagnosing black-screen issues on the viewer.
        /// </summary>
        private IEnumerator LogWebRtcStats()
        {
            // Wait a moment for connection to stabilize
            yield return new WaitForSeconds(2f);
            
            while (_isStreaming && _peerConnection != null)
            {
                var statsOp = _peerConnection.GetStats();
                yield return statsOp;
                
                if (statsOp.Value != null)
                {
                    var report = statsOp.Value;
                    foreach (var stat in report.Stats)
                    {
                        // Log outbound video RTP stats
                        if (stat.Value.Type == RTCStatsType.OutboundRtp)
                        {
                            // Check if it's a video track
                            if (stat.Value.Dict.TryGetValue("kind", out var kind) && kind.ToString() == "video")
                            {
                                var d = stat.Value.Dict;
                                string framesEncoded = d.ContainsKey("framesEncoded") ? d["framesEncoded"].ToString() : "N/A";
                                string framesSent = d.ContainsKey("framesSent") ? d["framesSent"].ToString() : "N/A";
                                string bytesSent = d.ContainsKey("bytesSent") ? d["bytesSent"].ToString() : "N/A";
                                string qualityLimit = d.ContainsKey("qualityLimitationReason") ? d["qualityLimitationReason"].ToString() : "N/A";
                                string encoderImpl = d.ContainsKey("encoderImplementation") ? d["encoderImplementation"].ToString() : "N/A";
                                string nackCount = d.ContainsKey("nackCount") ? d["nackCount"].ToString() : "0";
                                string pliCount = d.ContainsKey("pliCount") ? d["pliCount"].ToString() : "0";
                                
                                Debug.Log($"[WHIP STATS] Video: framesEncoded={framesEncoded}, " +
                                    $"framesSent={framesSent}, bytesSent={bytesSent}, " +
                                    $"encoder={encoderImpl}, qualityLimit={qualityLimit}, " +
                                    $"nack={nackCount}, pli={pliCount}");
                            }
                        }
                        
                        // Log ICE candidate pair stats for connection health
                        if (stat.Value.Type == RTCStatsType.CandidatePair)
                        {
                            var d = stat.Value.Dict;
                            if (d.ContainsKey("state") && d["state"].ToString() == "succeeded")
                            {
                                string bytesS = d.ContainsKey("bytesSent") ? d["bytesSent"].ToString() : "0";
                                string bytesR = d.ContainsKey("bytesReceived") ? d["bytesReceived"].ToString() : "0";
                                string rtt = d.ContainsKey("currentRoundTripTime") ? d["currentRoundTripTime"].ToString() : "N/A";
                                Debug.Log($"[WHIP STATS] ICE pair: bytesSent={bytesS}, bytesRecv={bytesR}, rtt={rtt}");
                            }
                        }
                    }
                }
                
                // Also log RenderTexture state
                if (_streamTexture != null)
                {
                    Debug.Log($"[WHIP STATS] RenderTexture: {_streamTexture.width}x{_streamTexture.height}, " +
                        $"format={_streamTexture.format}, created={_streamTexture.IsCreated()}, " +
                        $"needsBlit={_needsTextureBlit}");
                }
                
                // Log video track state
                if (_videoTrack != null)
                {
                    Debug.Log($"[WHIP STATS] VideoTrack: enabled={_videoTrack.Enabled}, " +
                        $"readyState={_videoTrack.ReadyState}");
                }
                
                yield return new WaitForSeconds(5f);
            }
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
            _whipUrl = null;
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
            _whipUrl = null;
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
                    _whipUrl = response.whipUrl;
                    
                    Debug.Log($"[WHIP] Got credentials. Stream: {_currentStreamId}");
                    Debug.Log($"[WHIP] WHIP URL: {_whipUrl}");
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
            
            Debug.Log($"[WHIP] PeerConnection created. Initial signaling state: {_peerConnection.SignalingState}");
            
            // NOTE: ConfigureCodecPreferences() is called AFTER SetupMediaTracks()
            // in the streaming flow, so transceivers exist when we set preferences.
            
            // Track signaling state changes for debugging
            _peerConnection.OnNegotiationNeeded = () =>
            {
                Debug.Log($"[WHIP] Negotiation needed (signaling state: {_peerConnection.SignalingState})");
            };
            
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
            // Must be called AFTER SetupMediaTracks() so transceivers exist
            var transceivers = _peerConnection.GetTransceivers();
            
            if (transceivers == null || !transceivers.Any())
            {
                Debug.LogWarning("[WHIP] No transceivers found - codec preferences not set. " +
                    "Ensure ConfigureCodecPreferences is called after AddTrack.");
                return;
            }
            
            foreach (var transceiver in transceivers)
            {
                // Use Sender.Track (not Receiver.Track which may be null for send-only)
                if (transceiver.Sender?.Track?.Kind == TrackKind.Video)
                {
                    var capabilities = RTCRtpSender.GetCapabilities(TrackKind.Video);
                    if (capabilities?.codecs == null) continue;
                    
                    var h264Codecs = new List<RTCRtpCodecCapability>();
                    var supportCodecs = new List<RTCRtpCodecCapability>(); // RTX, RED, ULPFEC
                    
                    foreach (var codec in capabilities.codecs)
                    {
                        if (codec.mimeType == "video/H264")
                        {
                            // Prioritize Baseline/Constrained Baseline (profile-level-id=42xxxx)
                            if (codec.sdpFmtpLine?.Contains("profile-level-id=42") == true)
                            {
                                h264Codecs.Insert(0, codec);
                            }
                            else
                            {
                                h264Codecs.Add(codec);
                            }
                        }
                        else if (codec.mimeType == "video/rtx" || 
                                 codec.mimeType == "video/red" || 
                                 codec.mimeType == "video/ulpfec")
                        {
                            // Keep retransmission/FEC codecs for reliability
                            supportCodecs.Add(codec);
                        }
                    }
                    
                    if (h264Codecs.Count > 0)
                    {
                        // Combine H.264 + support codecs
                        var allCodecs = new List<RTCRtpCodecCapability>(h264Codecs);
                        allCodecs.AddRange(supportCodecs);
                        
                        transceiver.SetCodecPreferences(allCodecs.ToArray());
                        Debug.Log($"[WHIP] Set H.264 codec preferences ({h264Codecs.Count} H.264 + {supportCodecs.Count} support codecs)");
                    }
                    else
                    {
                        Debug.LogWarning("[WHIP] H.264 codec not found in capabilities - IVS may reject stream. " +
                            "Available codecs: " + string.Join(", ", capabilities.codecs.Select(c => c.mimeType)));
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
            
            // Audio track - uses AudioStreamTrack(AudioSource) constructor
            // which handles audio capture internally without OnAudioFilterRead,
            // avoiding thread issues and AudioSource/AudioListener conflicts.
            if (enableAudio)
            {
                var listener = FindObjectOfType<AudioListener>();
                if (listener != null)
                {
                    // Get or create an AudioSource on the AudioListener's GameObject
                    var audioSource = listener.GetComponent<AudioSource>();
                    if (audioSource == null)
                    {
                        audioSource = listener.gameObject.AddComponent<AudioSource>();
                        Debug.Log("[WHIP] Created AudioSource on AudioListener GameObject for streaming");
                    }
                    
                    // AudioStreamTrack(AudioSource) captures audio from the source
                    // without needing OnAudioFilterRead or manual SetData calls
                    _audioTrack = new AudioStreamTrack(audioSource);
                    _mediaStream.AddTrack(_audioTrack);
                    _peerConnection.AddTrack(_audioTrack, _mediaStream);
                    
                    Debug.Log("[WHIP] Audio track added from AudioSource");
                }
                else
                {
                    Debug.LogWarning("[WHIP] No AudioListener found in scene - audio will not be streamed. " +
                        "Add an AudioListener component to a GameObject (usually the Main Camera).");
                }
            }
            else
            {
                Debug.Log("[WHIP] Audio streaming disabled");
            }
            
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
            bool addedBandwidth = false;
            
            // First pass: find H.264 payload types from a=rtpmap lines
            var h264PayloadTypes = new HashSet<string>();
            foreach (var line in lines)
            {
                // a=rtpmap:96 H264/90000
                if (line.Contains("a=rtpmap:") && line.Contains("H264"))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(line, @"a=rtpmap:(\d+)\s+H264");
                    if (match.Success)
                    {
                        h264PayloadTypes.Add(match.Groups[1].Value);
                    }
                }
            }
            
            Debug.Log($"[WHIP] Found H.264 payload types: {string.Join(", ", h264PayloadTypes)}");
            
            // Second pass: modify SDP
            foreach (var line in lines)
            {
                string modifiedLine = line;
                
                // Detect video m-line
                if (line.StartsWith("m=video"))
                {
                    inVideoSection = true;
                    addedBandwidth = false;
                }
                else if (line.StartsWith("m="))
                {
                    inVideoSection = false;
                }
                
                if (inVideoSection)
                {
                    // Check for H.264 fmtp lines by payload type number
                    foreach (var pt in h264PayloadTypes)
                    {
                        if (line.Contains($"a=fmtp:{pt} ") || line.Contains($"a=fmtp:{pt}\t"))
                        {
                            // Replace High/Main profile with Baseline if present
                            // profile-level-id is 6 hex chars: PPCCLL (profile, constraints, level)
                            // 42xxxx = Baseline/Constrained Baseline
                            // 4Dxxxx = Main
                            // 64xxxx = High
                            if (System.Text.RegularExpressions.Regex.IsMatch(modifiedLine, @"profile-level-id=(4[Dd]|64)\w{4}"))
                            {
                                // Replace with Constrained Baseline Level 3.1 (42e01f)
                                modifiedLine = System.Text.RegularExpressions.Regex.Replace(
                                    modifiedLine, 
                                    @"profile-level-id=\w{6}", 
                                    "profile-level-id=42e01f");
                                Debug.Log($"[WHIP] Forced H.264 Baseline profile for PT {pt}");
                            }
                            
                            // Add keyframe interval if not present
                            if (!modifiedLine.Contains("x-google-"))
                            {
                                modifiedLine = modifiedLine.TrimEnd();
                                if (!modifiedLine.EndsWith(";")) modifiedLine += ";";
                                modifiedLine += $"x-google-max-keyframe-interval={keyframeIntervalSeconds * 1000}";
                            }
                            
                            break;
                        }
                    }
                    
                    // Add bandwidth constraint after c= line in video section
                    if (line.StartsWith("c=IN") && !addedBandwidth)
                    {
                        modifiedLines.Add(modifiedLine);
                        modifiedLines.Add($"b=AS:{streamBitrateBps / 1000}");
                        addedBandwidth = true;
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
            
            // Audio track is disposed above with _audioTrack.Dispose()
            
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
            
            // Reset texture blit state
            _needsTextureBlit = false;
            _sourceTextureForBlit = null;
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
        
        private Coroutine _screenCaptureCoroutine;
        
        private void SetupStreamCamera()
        {
            // Get the platform-appropriate texture format for WebRTC
            var supportedFormat = WebRTC.GetSupportedRenderTextureFormat(SystemInfo.graphicsDeviceType);
            Debug.Log($"[WHIP] Platform texture format: {supportedFormat} (GPU: {SystemInfo.graphicsDeviceType})");
            
            if (sourceTexture != null)
            {
                // User provided a specific texture - use it directly
                if (sourceTexture.format != supportedFormat)
                {
                    Debug.LogWarning($"[WHIP] Source texture format {sourceTexture.format} doesn't match " +
                        $"required {supportedFormat}. Creating compatible texture with blit.");
                    
                    int width = Mathf.Min(sourceTexture.width, 1280);
                    int height = Mathf.Min(sourceTexture.height, 720);
                    _streamTexture = new RenderTexture(width, height, 0, supportedFormat);
                    _streamTexture.Create();
                    _ownsStreamTexture = true;
                    
                    _needsTextureBlit = true;
                    _sourceTextureForBlit = sourceTexture;
                }
                else
                {
                    _streamTexture = sourceTexture;
                    _ownsStreamTexture = false;
                }
            }
            else if (useScreenCapture)
            {
                // FALLBACK: Screen capture mode (captures Game View)
                // Resolution depends on Game View window size - use dedicated camera for fixed resolution.
                int width = Mathf.Min(streamWidth, 1280);
                int height = Mathf.Min(streamHeight, 720);
                
                _streamTexture = new RenderTexture(width, height, 0, supportedFormat);
                _streamTexture.Create();
                _ownsStreamTexture = true;
                
                _screenCaptureCoroutine = StartCoroutine(ScreenCaptureLoop());
                
                Debug.Log($"[WHIP] Screen capture mode: {width}x{height} (Game View dependent)");
            }
            else
            {
                // DEFAULT: Dedicated stream camera at fixed resolution
                // Renders to a 1280x720 RenderTexture independent of Game View size.
                // CopyFrom() copies base Camera settings; CopyUrpCameraData() copies
                // URP-specific settings (renderer, post-processing, etc.) via reflection.
                _streamCamera = sourceCamera ?? Camera.main;
                
                if (_streamCamera == null)
                {
                    Debug.LogError("[WHIP] No camera found! Assign sourceCamera or ensure Camera.main exists.");
                    return;
                }
                
                int width = Mathf.Min(streamWidth, 1280);
                int height = Mathf.Min(streamHeight, 720);
                
                _streamTexture = new RenderTexture(width, height, 24, supportedFormat);
                _streamTexture.Create();
                _ownsStreamTexture = true;
                
                _streamCameraGo = new GameObject("WhipStreamCamera");
                var streamCam = _streamCameraGo.AddComponent<Camera>();
                streamCam.CopyFrom(_streamCamera);
                streamCam.targetTexture = _streamTexture;
                streamCam.enabled = true;
                // Render before the main camera so texture is ready for WebRTC
                streamCam.depth = _streamCamera.depth - 1;
                
                // URP fix: copy UniversalAdditionalCameraData settings
                CopyUrpCameraData(_streamCamera, streamCam);
                
                // Parent to source camera so it follows position/rotation
                _streamCameraGo.transform.SetParent(_streamCamera.transform);
                _streamCameraGo.transform.localPosition = Vector3.zero;
                _streamCameraGo.transform.localRotation = Quaternion.identity;
                
                Debug.Log($"[WHIP] Dedicated stream camera: {width}x{height} (fixed resolution, URP-compatible)");
            }
        }
        
        /// <summary>
        /// Copies URP-specific camera data from source to destination camera.
        /// Uses reflection to avoid a hard dependency on UnityEngine.Rendering.Universal,
        /// so the code compiles with any render pipeline (Built-in, URP, HDRP).
        /// Falls back gracefully if URP is not installed.
        /// </summary>
        private void CopyUrpCameraData(Camera source, Camera dest)
        {
            try
            {
                var sourceData = source.GetComponent("UniversalAdditionalCameraData");
                var destData = dest.GetComponent("UniversalAdditionalCameraData");
                
                if (sourceData == null || destData == null)
                {
                    Debug.Log("[WHIP] No UniversalAdditionalCameraData found (not URP or not yet added)");
                    return;
                }
                
                var type = sourceData.GetType();
                
                // Copy key URP camera properties via reflection
                string[] propertiesToCopy = new[]
                {
                    "renderType",
                    "scriptableRenderer",
                    "renderPostProcessing",
                    "antialiasing",
                    "antialiasingQuality",
                    "volumeLayerMask",
                    "requiresColorTexture",
                    "requiresDepthTexture",
                    "renderShadows",
                    "requiresColorOption",
                    "requiresDepthOption",
                };
                
                int copied = 0;
                foreach (var propName in propertiesToCopy)
                {
                    var prop = type.GetProperty(propName);
                    if (prop != null && prop.CanRead && prop.CanWrite)
                    {
                        prop.SetValue(destData, prop.GetValue(sourceData));
                        copied++;
                    }
                }
                
                Debug.Log($"[WHIP] Copied {copied} URP camera properties via reflection");
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"[WHIP] Could not copy URP camera data (non-fatal): {e.Message}");
            }
        }
        
        /// <summary>
        /// Captures the final screen output into the stream RenderTexture each frame.
        /// Only used when useScreenCapture is enabled (fallback mode).
        /// </summary>
        private IEnumerator ScreenCaptureLoop()
        {
            Debug.Log("[WHIP] Screen capture loop started");
            while (true)
            {
                yield return new WaitForEndOfFrame();
                
                if (_streamTexture != null && _streamTexture.IsCreated())
                {
                    ScreenCapture.CaptureScreenshotIntoRenderTexture(_streamTexture);
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
