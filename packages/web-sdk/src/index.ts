/**
 * Substream Web SDK
 * 
 * Enables any HTML5 canvas game to stream to parents via IVS Real-Time.
 * Works with all game engines that render to <canvas>: Unity WebGL,
 * Phaser, Cocos, Construct, Three.js, PixiJS, etc.
 * 
 * Usage:
 *   import { SubstreamSDK } from '@substream/web-sdk';
 * 
 *   const stream = await SubstreamSDK.startStream({
 *     backendUrl: 'https://your-backend.up.railway.app',
 *     canvasElement: document.getElementById('game-canvas'),
 *     childId: 'child-123',
 *     authToken: 'jwt-token',
 *   });
 * 
 *   // Get the viewer URL to share with parents
 *   console.log(stream.viewerUrl);
 * 
 *   // Stop streaming
 *   stream.stop();
 */

// ============================================
// TYPES
// ============================================

export interface SubstreamConfig {
  /** Backend API URL (e.g., https://substream-sdk-production.up.railway.app) */
  backendUrl: string;
  /** The canvas element to capture and stream */
  canvasElement: HTMLCanvasElement;
  /** Child/player ID */
  childId: string;
  /** Auth token for API calls */
  authToken: string;
  /** Capture frame rate (default: 30) */
  fps?: number;
  /** Include audio from an AudioContext (optional) */
  audioContext?: AudioContext;
  /** Called when stream goes live */
  onLive?: (info: { streamId: string; viewerUrl: string }) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when stream stops */
  onStopped?: () => void;
}

export interface SubstreamSession {
  /** Unique stream ID */
  streamId: string;
  /** URL for parents to view the stream */
  viewerUrl: string;
  /** Stop streaming */
  stop: () => Promise<void>;
  /** Whether the stream is currently live */
  isLive: boolean;
}

interface WebPublishResponse {
  streamId: string;
  stageArn: string;
  publishToken: string;
  participantId: string;
  expiresAt: string;
  region: string;
  viewerUrl: string;
}

// ============================================
// SDK
// ============================================

export class SubstreamSDK {
  /**
   * Start streaming a canvas element to parents via IVS.
   * 
   * @param config - Stream configuration
   * @returns A session object with stream info and stop() method
   */
  static async startStream(config: SubstreamConfig): Promise<SubstreamSession> {
    const {
      backendUrl,
      canvasElement,
      childId,
      authToken,
      fps = 30,
      audioContext,
      onLive,
      onError,
      onStopped,
    } = config;

    // Validate inputs
    if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
      throw new Error('SubstreamSDK: canvasElement must be an HTMLCanvasElement');
    }
    if (!backendUrl) throw new Error('SubstreamSDK: backendUrl is required');
    if (!childId) throw new Error('SubstreamSDK: childId is required');
    if (!authToken) throw new Error('SubstreamSDK: authToken is required');

    console.log('[Substream] Starting stream...');

    // Step 1: Request a publish token from the backend
    const publishInfo = await requestPublishToken(backendUrl, childId, authToken);
    console.log(`[Substream] Got stream ${publishInfo.streamId}, viewer: ${publishInfo.viewerUrl}`);

    // Step 2: Capture canvas as MediaStream
    const canvasStream = canvasElement.captureStream(fps);
    console.log(`[Substream] Canvas capture started at ${fps}fps, tracks: ${canvasStream.getTracks().length}`);

    // Step 3: Optionally add audio
    if (audioContext) {
      try {
        const dest = audioContext.createMediaStreamDestination();
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
          console.log('[Substream] Audio track added from AudioContext');
        }
      } catch (e) {
        console.warn('[Substream] Could not add audio:', e);
      }
    }

    // Step 4: Import IVS Web Broadcast SDK and publish
    const IVSModule = await import('amazon-ivs-web-broadcast');
    const { Stage, LocalStageStream, SubscribeType, StageEvents } = IVSModule as any;

    // Wrap tracks as LocalStageStream instances
    const localStreams = canvasStream.getTracks().map(
      (track: MediaStreamTrack) => new LocalStageStream(track)
    );
    console.log(`[Substream] Created ${localStreams.length} LocalStageStream(s)`);

    // Create publish-only strategy
    const strategy = {
      stageStreamsToPublish: () => localStreams,
      shouldPublishParticipant: () => true,
      shouldSubscribeToParticipant: () => SubscribeType.NONE,
    };

    // Create and join stage
    const stage = new Stage(publishInfo.publishToken, strategy);
    let isLive = false;

    stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, (...args: unknown[]) => {
      const state = args[0] as string;
      console.log(`[Substream] Connection state: ${state}`);
      if (state === 'connected') {
        isLive = true;
        onLive?.({ streamId: publishInfo.streamId, viewerUrl: publishInfo.viewerUrl });
      } else if (state === 'disconnected') {
        isLive = false;
      }
    });

    stage.on(StageEvents.STAGE_PARTICIPANT_JOINED, (...args: unknown[]) => {
      const info = args[0] as { id: string; isLocal: boolean };
      console.log(`[Substream] Participant joined: ${info.id} (local: ${info.isLocal})`);
    });

    console.log('[Substream] Joining stage...');
    await stage.join();
    console.log('[Substream] Joined stage, publishing...');

    // Build session object
    const session: SubstreamSession = {
      streamId: publishInfo.streamId,
      viewerUrl: publishInfo.viewerUrl,
      get isLive() { return isLive; },
      stop: async () => {
        console.log('[Substream] Stopping stream...');
        isLive = false;

        // Stop all tracks
        canvasStream.getTracks().forEach(t => t.stop());

        // Leave the stage
        try { stage.leave(); } catch (e) { /* ignore */ }

        // Notify backend
        try {
          await fetch(`${backendUrl}/api/streams/web-publish`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ streamId: publishInfo.streamId }),
          });
        } catch (e) {
          console.warn('[Substream] Failed to notify backend of stop:', e);
        }

        console.log('[Substream] Stream stopped');
        onStopped?.();
      },
    };

    return session;
  }
}

// ============================================
// HELPERS
// ============================================

async function requestPublishToken(
  backendUrl: string,
  childId: string,
  authToken: string,
): Promise<WebPublishResponse> {
  const response = await fetch(`${backendUrl}/api/streams/web-publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ childId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `SubstreamSDK: Failed to start stream (HTTP ${response.status}): ${errorData.error || 'Unknown error'}`
    );
  }

  return response.json();
}

// Default export for convenience
export default SubstreamSDK;
