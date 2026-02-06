using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.Networking;
using Unity.WebRTC;

namespace Substream.Streaming
{
    /// <summary>
    /// WHIP (WebRTC-HTTP Ingestion Protocol) client for Unity.
    /// Implements the WHIP protocol to publish WebRTC streams to IVS Real-Time.
    /// 
    /// Reference: https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/rt-stream-ingest.html
    /// WHIP RFC: https://www.rfc-editor.org/rfc/rfc9725.html
    /// </summary>
    public class WhipClient
    {
        // ============================================
        // TYPES
        // ============================================
        
        /// <summary>
        /// Result of WHIP POST (offer) request
        /// </summary>
        public class WhipSessionInfo
        {
            public string SessionUrl;      // Location header - for PATCH/DELETE
            public string ETag;            // Required for PATCH requests
            public string AnswerSdp;       // Response body - SDP answer
            public RTCIceServer[] IceServers; // Parsed from Link headers
        }
        
        /// <summary>
        /// Callback for async WHIP operations
        /// </summary>
        public delegate void OnWhipSuccess(WhipSessionInfo session);
        public delegate void OnWhipError(string error);
        public delegate void OnWhipComplete();
        
        // ============================================
        // CONSTANTS
        // ============================================
        
        /// <summary>
        /// AWS IVS global WHIP endpoint - handles 307 redirects to regional endpoints
        /// </summary>
        public const string GlobalWhipEndpoint = "https://global.whip.live-video.net";
        
        // ============================================
        // POST OFFER - Initial WHIP Connection
        // ============================================
        
        /// <summary>
        /// Send SDP offer to WHIP endpoint.
        /// Handles 307 redirects automatically (required by AWS IVS).
        /// </summary>
        /// <param name="mono">MonoBehaviour for coroutine</param>
        /// <param name="whipUrl">WHIP endpoint URL</param>
        /// <param name="bearerToken">IVS participant token</param>
        /// <param name="offerSdp">Local SDP offer</param>
        /// <param name="onSuccess">Called with session info on success</param>
        /// <param name="onError">Called with error message on failure</param>
        public static void PostOffer(
            MonoBehaviour mono,
            string whipUrl,
            string bearerToken,
            string offerSdp,
            OnWhipSuccess onSuccess,
            OnWhipError onError)
        {
            mono.StartCoroutine(PostOfferCoroutine(whipUrl, bearerToken, offerSdp, onSuccess, onError));
        }
        
        private static IEnumerator PostOfferCoroutine(
            string whipUrl,
            string bearerToken,
            string offerSdp,
            OnWhipSuccess onSuccess,
            OnWhipError onError)
        {
            Debug.Log($"[WHIP] POST offer to {whipUrl}");
            
            yield return SendPostRequest(whipUrl, bearerToken, offerSdp, (code, headers, body) =>
            {
                // Handle 307 redirect (AWS global endpoint redirects to regional)
                if (code == 307)
                {
                    string redirectUrl = GetHeader(headers, "Location");
                    if (string.IsNullOrEmpty(redirectUrl))
                    {
                        onError("WHIP 307 redirect without Location header");
                        return;
                    }
                    
                    Debug.Log($"[WHIP] Following 307 redirect to {redirectUrl}");
                    
                    // Re-POST to redirect URL with same headers/body
                    // IMPORTANT: Authorization header must be preserved on redirect
                    CoroutineRunner.Instance.StartCoroutine(
                        SendPostRequest(redirectUrl, bearerToken, offerSdp, (code2, headers2, body2) =>
                        {
                            ParseWhip201Response(code2, headers2, body2, onSuccess, onError);
                        }, onError)
                    );
                    return;
                }
                
                ParseWhip201Response(code, headers, body, onSuccess, onError);
            }, onError);
        }
        
        private static IEnumerator SendPostRequest(
            string url,
            string bearerToken,
            string offerSdp,
            Action<long, Dictionary<string, string>, string> onDone,
            OnWhipError onError)
        {
            byte[] bodyBytes = Encoding.UTF8.GetBytes(offerSdp);
            
            using (var request = new UnityWebRequest(url, "POST"))
            {
                request.uploadHandler = new UploadHandlerRaw(bodyBytes);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/sdp");
                request.SetRequestHeader("Authorization", $"Bearer {bearerToken}");
                
                // Allow Unity to auto-follow redirects. AWS IVS global WHIP endpoint
                // returns 307 to a regional endpoint. Despite Unity stripping the
                // Authorization header on redirect, IVS validates auth from the
                // Bearer token in the initial request context.
                request.redirectLimit = 5;
                
                yield return request.SendWebRequest();
                
                // Handle network errors
                if (request.result == UnityWebRequest.Result.ConnectionError)
                {
                    onError($"WHIP connection error: {request.error}");
                    yield break;
                }
                
                // Get response headers
                var headers = request.GetResponseHeaders() ?? new Dictionary<string, string>();
                string body = request.downloadHandler?.text ?? "";
                
                onDone(request.responseCode, headers, body);
            }
        }
        
        private static void ParseWhip201Response(
            long code,
            Dictionary<string, string> headers,
            string body,
            OnWhipSuccess onSuccess,
            OnWhipError onError)
        {
            // WHIP expects 201 Created on success
            if (code != 201)
            {
                onError($"WHIP POST expected 201, got {code}. Body: {body}");
                return;
            }
            
            // Log all response headers for debugging
            Debug.Log($"[WHIP] 201 Response headers ({headers.Count}):");
            foreach (var kvp in headers)
            {
                Debug.Log($"[WHIP]   {kvp.Key}: {kvp.Value}");
            }
            
            // Extract required headers
            string sessionUrl = GetHeader(headers, "Location");
            string etag = GetHeader(headers, "ETag");
            
            if (string.IsNullOrEmpty(sessionUrl))
            {
                onError("WHIP 201 response missing Location header");
                return;
            }
            
            // ETag is used for PATCH ICE candidates. Unity's UnityWebRequest may
            // strip this header. If missing, we'll use wildcard "If-Match: *" for PATCH.
            if (string.IsNullOrEmpty(etag))
            {
                Debug.LogWarning("[WHIP] ETag header not found in response. " +
                    "Unity may strip this header. Using wildcard for ICE PATCH.");
                etag = "*"; // WHIP/HTTP wildcard match
            }
            
            // Parse ICE servers from Link headers
            RTCIceServer[] iceServers = ParseIceServersFromLinks(headers);
            
            Debug.Log($"[WHIP] Connected! Session: {sessionUrl}, ETag: {etag}, ICE servers: {iceServers.Length}");
            
            onSuccess(new WhipSessionInfo
            {
                SessionUrl = sessionUrl,
                ETag = etag,
                AnswerSdp = body,
                IceServers = iceServers
            });
        }
        
        // ============================================
        // PATCH ICE CANDIDATES - Trickle ICE
        // ============================================
        
        /// <summary>
        /// Send ICE candidates to WHIP session via PATCH.
        /// Per WHIP RFC, uses application/trickle-ice-sdpfrag content type.
        /// </summary>
        /// <param name="mono">MonoBehaviour for coroutine</param>
        /// <param name="sessionUrl">WHIP session URL from Location header</param>
        /// <param name="bearerToken">IVS participant token</param>
        /// <param name="etag">ETag from initial response</param>
        /// <param name="sdpFrag">SDP fragment containing ICE candidates</param>
        /// <param name="onSuccess">Called on success</param>
        /// <param name="onError">Called with error message on failure</param>
        public static void PatchIceCandidates(
            MonoBehaviour mono,
            string sessionUrl,
            string bearerToken,
            string etag,
            string sdpFrag,
            OnWhipComplete onSuccess,
            OnWhipError onError)
        {
            mono.StartCoroutine(PatchIceCandidatesCoroutine(sessionUrl, bearerToken, etag, sdpFrag, onSuccess, onError));
        }
        
        private static IEnumerator PatchIceCandidatesCoroutine(
            string sessionUrl,
            string bearerToken,
            string etag,
            string sdpFrag,
            OnWhipComplete onSuccess,
            OnWhipError onError)
        {
            Debug.Log($"[WHIP] PATCH ICE candidates to {sessionUrl}");
            
            byte[] bodyBytes = Encoding.UTF8.GetBytes(sdpFrag);
            
            using (var request = new UnityWebRequest(sessionUrl, "PATCH"))
            {
                request.uploadHandler = new UploadHandlerRaw(bodyBytes);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/trickle-ice-sdpfrag");
                request.SetRequestHeader("If-Match", etag);
                request.SetRequestHeader("Authorization", $"Bearer {bearerToken}");
                
                yield return request.SendWebRequest();
                
                if (request.result != UnityWebRequest.Result.Success)
                {
                    onError($"WHIP PATCH failed: {request.error}, HTTP {request.responseCode}");
                    yield break;
                }
                
                // WHIP RFC allows 200 OK (server has new candidates) or 204 No Content
                if (request.responseCode != 200 && request.responseCode != 204)
                {
                    onError($"WHIP PATCH expected 200/204, got {request.responseCode}. Body: {request.downloadHandler?.text}");
                    yield break;
                }
                
                Debug.Log("[WHIP] ICE candidates sent successfully");
                onSuccess();
            }
        }
        
        // ============================================
        // DELETE SESSION - End Stream
        // ============================================
        
        /// <summary>
        /// End WHIP session by sending DELETE to session URL.
        /// </summary>
        /// <param name="mono">MonoBehaviour for coroutine</param>
        /// <param name="sessionUrl">WHIP session URL from Location header</param>
        /// <param name="bearerToken">IVS participant token</param>
        /// <param name="onSuccess">Called on success</param>
        /// <param name="onError">Called with error message on failure</param>
        public static void DeleteSession(
            MonoBehaviour mono,
            string sessionUrl,
            string bearerToken,
            OnWhipComplete onSuccess,
            OnWhipError onError)
        {
            mono.StartCoroutine(DeleteSessionCoroutine(sessionUrl, bearerToken, onSuccess, onError));
        }
        
        private static IEnumerator DeleteSessionCoroutine(
            string sessionUrl,
            string bearerToken,
            OnWhipComplete onSuccess,
            OnWhipError onError)
        {
            Debug.Log($"[WHIP] DELETE session {sessionUrl}");
            
            using (var request = new UnityWebRequest(sessionUrl, "DELETE"))
            {
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Authorization", $"Bearer {bearerToken}");
                
                yield return request.SendWebRequest();
                
                if (request.result != UnityWebRequest.Result.Success && request.responseCode != 200 && request.responseCode != 204)
                {
                    onError($"WHIP DELETE failed: {request.error}, HTTP {request.responseCode}");
                    yield break;
                }
                
                Debug.Log("[WHIP] Session deleted successfully");
                onSuccess();
            }
        }
        
        // ============================================
        // HELPERS
        // ============================================
        
        /// <summary>
        /// Get header value (case-insensitive).
        /// Unity's GetResponseHeaders() may use different casing.
        /// </summary>
        private static string GetHeader(Dictionary<string, string> headers, string key)
        {
            // Try exact match first
            if (headers.TryGetValue(key, out string value))
                return value;
            
            // Try uppercase
            if (headers.TryGetValue(key.ToUpper(), out value))
                return value;
            
            // Try lowercase
            if (headers.TryGetValue(key.ToLower(), out value))
                return value;
            
            // Case-insensitive search
            foreach (var kvp in headers)
            {
                if (kvp.Key.Equals(key, StringComparison.OrdinalIgnoreCase))
                    return kvp.Value;
            }
            
            return null;
        }
        
        /// <summary>
        /// Parse ICE servers from WHIP Link headers.
        /// Format: Link: <stun:stun.example.com>; rel="ice-server"
        /// Format: Link: <turn:turn.example.com>; rel="ice-server"; username="user"; credential="pass"
        /// </summary>
        private static RTCIceServer[] ParseIceServersFromLinks(Dictionary<string, string> headers)
        {
            string linkHeader = GetHeader(headers, "Link");
            if (string.IsNullOrEmpty(linkHeader))
                return Array.Empty<RTCIceServer>();
            
            var servers = new List<RTCIceServer>();
            
            // Link header can have multiple values separated by commas
            // Each link value: <url>; param1=value1; param2=value2
            string[] links = linkHeader.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            
            foreach (string link in links)
            {
                string trimmed = link.Trim();
                
                // Only process ice-server links
                if (!trimmed.Contains("rel=\"ice-server\""))
                    continue;
                
                // Extract URL from <...>
                var urlMatch = Regex.Match(trimmed, @"<([^>]+)>");
                if (!urlMatch.Success)
                    continue;
                
                string url = urlMatch.Groups[1].Value;
                
                // Extract username and credential if present
                var userMatch = Regex.Match(trimmed, @"username=""([^""]+)""");
                var credMatch = Regex.Match(trimmed, @"credential=""([^""]+)""");
                
                var server = new RTCIceServer
                {
                    urls = new[] { url },
                    username = userMatch.Success ? userMatch.Groups[1].Value : null,
                    credential = credMatch.Success ? credMatch.Groups[1].Value : null
                };
                
                servers.Add(server);
                Debug.Log($"[WHIP] Parsed ICE server: {url}");
            }
            
            return servers.ToArray();
        }
        
        // ============================================
        // SDP FRAGMENT BUILDER
        // ============================================
        
        /// <summary>
        /// Build SDP fragment for ICE trickle PATCH request.
        /// Per WHIP RFC, the fragment should contain:
        /// - a=ice-ufrag
        /// - a=ice-pwd
        /// - a=mid for each media section
        /// - a=candidate lines
        /// - a=end-of-candidates when gathering is complete
        /// </summary>
        /// <param name="localSdp">Local SDP (from offer)</param>
        /// <param name="candidates">List of ICE candidates</param>
        /// <param name="isComplete">Whether gathering is complete</param>
        public static string BuildSdpFragment(
            string localSdp,
            List<RTCIceCandidate> candidates,
            bool isComplete = false)
        {
            var sb = new StringBuilder();
            
            // Extract ice-ufrag and ice-pwd from local SDP
            string iceUfrag = ExtractSdpAttribute(localSdp, "ice-ufrag");
            string icePwd = ExtractSdpAttribute(localSdp, "ice-pwd");
            
            if (!string.IsNullOrEmpty(iceUfrag))
                sb.AppendLine($"a=ice-ufrag:{iceUfrag}");
            if (!string.IsNullOrEmpty(icePwd))
                sb.AppendLine($"a=ice-pwd:{icePwd}");
            
            // Group candidates by mid (avoid duplicate a=mid lines per RFC 8840)
            var candidatesByMid = new Dictionary<string, List<RTCIceCandidate>>();
            foreach (var candidate in candidates)
            {
                string mid = candidate.SdpMid ?? "0";
                if (!candidatesByMid.ContainsKey(mid))
                    candidatesByMid[mid] = new List<RTCIceCandidate>();
                candidatesByMid[mid].Add(candidate);
            }
            
            foreach (var kvp in candidatesByMid)
            {
                sb.AppendLine($"m=video 9 UDP/TLS/RTP/SAVPF 0");
                sb.AppendLine($"a=mid:{kvp.Key}");
                foreach (var candidate in kvp.Value)
                {
                    sb.AppendLine($"a={candidate.Candidate}");
                }
            }
            
            // Signal end of candidates if gathering is complete
            if (isComplete)
                sb.AppendLine("a=end-of-candidates");
            
            return sb.ToString();
        }
        
        private static string ExtractSdpAttribute(string sdp, string attribute)
        {
            var match = Regex.Match(sdp, $@"a={attribute}:([^\r\n]+)");
            return match.Success ? match.Groups[1].Value : null;
        }
    }
    
    // ============================================
    // COROUTINE RUNNER SINGLETON
    // For running coroutines from static methods
    // ============================================
    
    public class CoroutineRunner : MonoBehaviour
    {
        private static CoroutineRunner _instance;
        
        public static CoroutineRunner Instance
        {
            get
            {
                if (_instance == null)
                {
                    var go = new GameObject("WhipCoroutineRunner");
                    _instance = go.AddComponent<CoroutineRunner>();
                    DontDestroyOnLoad(go);
                }
                return _instance;
            }
        }
    }
}
