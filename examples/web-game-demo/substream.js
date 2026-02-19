/**
 * Substream Web Integration (standalone, zero-dependency)
 *
 * Drop this script + the IVS SDK script tag into any HTML page to add
 * live streaming to a <canvas> game. No npm install, no build step.
 *
 * Usage:
 *
 *   <script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
 *   <script src="substream.js"></script>
 *   <script>
 *     // Start streaming your canvas
 *     const session = await Substream.startStream({
 *       canvas: document.getElementById('game-canvas'),
 *       backendUrl: 'https://substream-sdk-production.up.railway.app',
 *       childId: 'your-child-id',
 *       authToken: 'your-auth-token',
 *     });
 *
 *     console.log('Viewer URL:', session.viewerUrl);
 *
 *     // Stop streaming
 *     await session.stop();
 *   </script>
 */

window.Substream = (function () {
  'use strict';

  /**
   * Start streaming a canvas element.
   *
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas       - The canvas to stream
   * @param {string}           opts.backendUrl    - Substream backend URL
   * @param {string}           opts.childId       - Player/child ID
   * @param {string}           opts.authToken     - Auth token
   * @param {number}           [opts.fps=30]      - Capture frame rate
   * @param {function}         [opts.onLive]      - Called when stream goes live
   * @param {function}         [opts.onError]     - Called on error
   * @param {function}         [opts.onStopped]   - Called when stream stops
   * @returns {Promise<{streamId, viewerUrl, isLive, stop}>}
   */
  async function startStream(opts) {
    if (!opts.canvas || !(opts.canvas instanceof HTMLCanvasElement)) {
      throw new Error('Substream: opts.canvas must be an HTMLCanvasElement');
    }
    if (!opts.backendUrl) throw new Error('Substream: opts.backendUrl is required');
    if (!opts.childId) throw new Error('Substream: opts.childId is required');
    if (!opts.authToken) throw new Error('Substream: opts.authToken is required');

    var fps = opts.fps || 30;
    var backendUrl = opts.backendUrl.replace(/\/$/, '');

    // 1. Get publish token from backend
    var resp = await fetch(backendUrl + '/api/streams/web-publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + opts.authToken,
      },
      body: JSON.stringify({ childId: opts.childId }),
    });

    if (!resp.ok) {
      var errBody = await resp.json().catch(function () { return {}; });
      throw new Error(errBody.error || 'Backend returned HTTP ' + resp.status);
    }

    var info = await resp.json();

    // 2. Capture canvas
    var stream = opts.canvas.captureStream(fps);

    // 3. Publish via IVS
    if (typeof IVSBroadcastClient === 'undefined' || !IVSBroadcastClient.Stage) {
      throw new Error(
        'Substream: IVS Web Broadcast SDK not found. ' +
        'Add <script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script> before this script.'
      );
    }

    var Stage = IVSBroadcastClient.Stage;
    var LocalStageStream = IVSBroadcastClient.LocalStageStream;
    var SubscribeType = IVSBroadcastClient.SubscribeType;
    var StageEvents = IVSBroadcastClient.StageEvents;

    var localStreams = stream.getTracks().map(function (t) {
      return new LocalStageStream(t);
    });

    var strategy = {
      stageStreamsToPublish: function () { return localStreams; },
      shouldPublishParticipant: function () { return true; },
      shouldSubscribeToParticipant: function () { return SubscribeType.NONE; },
    };

    var stage = new Stage(info.publishToken, strategy);
    var isLive = false;

    stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, function (state) {
      if (state === 'connected') {
        isLive = true;
        if (opts.onLive) opts.onLive({ streamId: info.streamId, viewerUrl: info.viewerUrl });
      } else if (state === 'disconnected') {
        isLive = false;
      }
    });

    await stage.join();

    // 4. Return session handle
    return {
      streamId: info.streamId,
      viewerUrl: info.viewerUrl,
      get isLive() { return isLive; },
      stop: async function () {
        isLive = false;
        stream.getTracks().forEach(function (t) { t.stop(); });
        try { stage.leave(); } catch (e) { /* ok */ }
        try {
          await fetch(backendUrl + '/api/streams/web-publish', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + opts.authToken,
            },
            body: JSON.stringify({ streamId: info.streamId }),
          });
        } catch (e) { /* non-critical */ }
        if (opts.onStopped) opts.onStopped();
      },
    };
  }

  return { startStream: startStream };
})();
