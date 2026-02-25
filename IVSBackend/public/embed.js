/**
 * Substream Embeddable Viewer Widget
 *
 * Usage:
 *   <div id="substream-player"
 *        data-stream-id="<streamId>"
 *        data-backend-url="https://your-backend.up.railway.app"
 *        data-auth-token="<viewer token>"
 *        data-theme="dark">
 *   </div>
 *   <script src="https://your-backend.up.railway.app/embed.js"></script>
 *
 * Renders a self-contained video player with chat, reactions, and viewer count.
 * Customizable via CSS variables on the container element.
 */

(function () {
  'use strict';

  var STYLE = [
    ':host, .ss-embed { --ss-bg: #0f0f0f; --ss-text: #e5e5e5; --ss-accent: #8b5cf6; --ss-surface: #1a1a2e; --ss-border: #2a2a3e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
    '.ss-embed { background: var(--ss-bg); color: var(--ss-text); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; position: relative; width: 100%; max-width: 100%; }',
    '.ss-embed[data-theme="light"] { --ss-bg: #ffffff; --ss-text: #1a1a1a; --ss-surface: #f5f5f5; --ss-border: #e0e0e0; }',
    '.ss-video-wrap { position: relative; width: 100%; padding-top: 56.25%; background: #000; }',
    '.ss-video-wrap video, .ss-video-wrap canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }',
    '.ss-topbar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: linear-gradient(180deg, rgba(0,0,0,.6) 0%, transparent 100%); z-index: 2; }',
    '.ss-live-badge { background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: .5px; animation: ss-pulse 2s infinite; }',
    '@keyframes ss-pulse { 0%,100% { opacity:1; } 50% { opacity:.7; } }',
    '.ss-viewers { font-size: 13px; opacity: .9; display: flex; align-items: center; gap: 4px; }',
    '.ss-viewers svg { width: 14px; height: 14px; fill: currentColor; }',
    '.ss-engagement { display: flex; border-top: 1px solid var(--ss-border); }',
    '.ss-reactions-bar { display: flex; gap: 2px; padding: 8px 12px; align-items: center; flex-shrink: 0; }',
    '.ss-reaction-btn { background: none; border: 1px solid var(--ss-border); border-radius: 20px; padding: 4px 10px; font-size: 18px; cursor: pointer; transition: transform .15s, background .15s; }',
    '.ss-reaction-btn:hover { transform: scale(1.2); background: var(--ss-surface); }',
    '.ss-reaction-btn:active { transform: scale(.9); }',
    '.ss-chat { flex: 1; display: flex; flex-direction: column; min-height: 0; max-height: 200px; border-left: 1px solid var(--ss-border); }',
    '.ss-chat-messages { flex: 1; overflow-y: auto; padding: 8px 12px; font-size: 13px; }',
    '.ss-chat-messages p { margin: 2px 0; }',
    '.ss-chat-messages .ss-author { color: var(--ss-accent); font-weight: 600; }',
    '.ss-chat-input { display: flex; border-top: 1px solid var(--ss-border); }',
    '.ss-chat-input input { flex: 1; padding: 8px 12px; background: var(--ss-surface); color: var(--ss-text); border: none; outline: none; font-size: 13px; }',
    '.ss-chat-input button { padding: 8px 14px; background: var(--ss-accent); color: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 13px; }',
    '.ss-floating-reaction { position: absolute; bottom: 60px; font-size: 24px; animation: ss-float 2s ease-out forwards; pointer-events: none; z-index: 10; }',
    '@keyframes ss-float { 0% { opacity:1; transform:translateY(0) scale(1); } 100% { opacity:0; transform:translateY(-120px) scale(1.3); } }',
    '.ss-offline { display: flex; align-items: center; justify-content: center; position: absolute; inset: 0; background: var(--ss-bg); color: var(--ss-text); font-size: 16px; opacity: .7; }',
  ].join('\n');

  function init() {
    var containers = document.querySelectorAll('[data-stream-id]');
    containers.forEach(function (el) {
      if (el.getAttribute('data-ss-initialized')) return;
      el.setAttribute('data-ss-initialized', '1');
      mount(el);
    });
  }

  function mount(container) {
    var streamId = container.getAttribute('data-stream-id');
    var backendUrl = container.getAttribute('data-backend-url') || '';
    var authToken = container.getAttribute('data-auth-token') || '';
    var theme = container.getAttribute('data-theme') || 'dark';

    // Inject styles
    if (!document.getElementById('ss-embed-styles')) {
      var style = document.createElement('style');
      style.id = 'ss-embed-styles';
      style.textContent = STYLE;
      document.head.appendChild(style);
    }

    var root = document.createElement('div');
    root.className = 'ss-embed';
    root.setAttribute('data-theme', theme);

    root.innerHTML = [
      '<div class="ss-video-wrap">',
      '  <canvas id="ss-canvas-' + streamId + '"></canvas>',
      '  <div class="ss-topbar">',
      '    <span class="ss-live-badge">LIVE</span>',
      '    <span class="ss-viewers" id="ss-vc-' + streamId + '">',
      '      <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
      '      <span>0</span>',
      '    </span>',
      '  </div>',
      '  <div class="ss-offline" id="ss-offline-' + streamId + '" style="display:none">Stream offline</div>',
      '</div>',
      '<div class="ss-engagement">',
      '  <div class="ss-reactions-bar" id="ss-reactions-' + streamId + '"></div>',
      '  <div class="ss-chat">',
      '    <div class="ss-chat-messages" id="ss-chat-' + streamId + '"></div>',
      '    <div class="ss-chat-input">',
      '      <input type="text" placeholder="Say something..." id="ss-chat-input-' + streamId + '" />',
      '      <button id="ss-chat-send-' + streamId + '">Send</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    container.appendChild(root);

    // Populate reaction buttons
    var reactions = ['❤️', '🔥', '👏', '😂', '😮', '🎮'];
    var reactionsBar = root.querySelector('#ss-reactions-' + streamId);
    reactions.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.className = 'ss-reaction-btn';
      btn.textContent = emoji;
      btn.onclick = function () {
        sendReaction(backendUrl, streamId, authToken, emoji);
        showFloatingReaction(root, emoji);
      };
      reactionsBar.appendChild(btn);
    });

    // Connect SSE for real-time updates
    connectSSE(backendUrl, streamId, root);

    // Connect IVS viewer (load player)
    connectViewer(backendUrl, streamId, authToken, root);
  }

  function connectSSE(backendUrl, streamId, root) {
    if (!backendUrl) return;
    var es = new EventSource(backendUrl + '/api/streams/' + streamId + '/events');

    es.addEventListener('viewerCount', function (e) {
      try {
        var data = JSON.parse(e.data);
        var el = root.querySelector('#ss-vc-' + streamId + ' span:last-child');
        if (el) el.textContent = String(data.viewerCount);
      } catch (err) { /* ignore */ }
    });

    es.addEventListener('reaction', function (e) {
      try {
        var data = JSON.parse(e.data);
        showFloatingReaction(root, data.emoji);
      } catch (err) { /* ignore */ }
    });
  }

  function showFloatingReaction(root, emoji) {
    var el = document.createElement('div');
    el.className = 'ss-floating-reaction';
    el.textContent = emoji;
    el.style.left = (20 + Math.random() * 60) + '%';
    var wrap = root.querySelector('.ss-video-wrap');
    if (wrap) {
      wrap.appendChild(el);
      setTimeout(function () { el.remove(); }, 2000);
    }
  }

  function sendReaction(backendUrl, streamId, authToken, emoji) {
    if (!backendUrl) return;
    fetch(backendUrl + '/api/streams/' + streamId + '/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
      body: JSON.stringify({ emoji: emoji }),
    }).catch(function () {});
  }

  function connectViewer(backendUrl, streamId, authToken, root) {
    if (!backendUrl || !authToken) return;

    fetch(backendUrl + '/api/streams/' + streamId + '/viewer', {
      headers: { Authorization: 'Bearer ' + authToken },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.subscribeToken) {
          loadIvsStage(data, streamId, root);
        } else {
          var offline = root.querySelector('#ss-offline-' + streamId);
          if (offline) offline.style.display = 'flex';
        }
      })
      .catch(function () {
        var offline = root.querySelector('#ss-offline-' + streamId);
        if (offline) offline.style.display = 'flex';
      });
  }

  function loadIvsStage(tokenData, streamId, root) {
    // Dynamically load IVS Web Broadcast SDK if not already loaded
    if (window.IVSBroadcastClient) {
      initStage(tokenData, streamId, root);
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js';
    script.onload = function () { initStage(tokenData, streamId, root); };
    document.head.appendChild(script);
  }

  function initStage(tokenData, streamId, root) {
    try {
      var IVS = window.IVSBroadcastClient;
      var stage = new IVS.Stage(tokenData.subscribeToken, {
        stageStreamsToPublish: function () { return []; },
        shouldPublishParticipant: function () { return false; },
        shouldSubscribeToParticipant: function () { return IVS.SubscribeType.AUDIO_VIDEO; },
      });

      stage.on(IVS.StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, function (participant, streams) {
        var canvas = root.querySelector('#ss-canvas-' + streamId);
        if (!canvas) return;
        streams.forEach(function (s) {
          if (s.mediaStreamTrack.kind === 'video') {
            var video = document.createElement('video');
            video.srcObject = new MediaStream([s.mediaStreamTrack]);
            video.autoplay = true;
            video.playsInline = true;
            video.muted = false;
            canvas.parentNode.insertBefore(video, canvas);
            canvas.style.display = 'none';
          }
          if (s.mediaStreamTrack.kind === 'audio') {
            var audio = document.createElement('audio');
            audio.srcObject = new MediaStream([s.mediaStreamTrack]);
            audio.autoplay = true;
            document.body.appendChild(audio);
          }
        });
      });

      stage.join();
    } catch (err) {
      console.error('[Substream Embed] Stage error:', err);
    }
  }

  // Auto-initialize on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for dynamic mounting
  window.SubstreamEmbed = { init: init };
})();
