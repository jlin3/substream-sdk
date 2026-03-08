/**
 * Substream Web SDK
 *
 * Enables any HTML5 canvas game to stream via IVS Real-Time.
 * Works with all game engines that render to <canvas>: Unity WebGL,
 * Phaser, Cocos, Construct, Three.js, PixiJS, etc.
 *
 * Usage:
 *   import { SubstreamSDK } from '@substream/web-sdk';
 *
 *   SubstreamSDK.captureAudio();
 *
 *   const stream = await SubstreamSDK.startStream({
 *     backendUrl: 'https://your-backend.up.railway.app',
 *     canvasElement: document.getElementById('game-canvas'),
 *     streamerId: 'player-456',
 *     authToken: 'sk_live_xxx or jwt',
 *   });
 *
 *   console.log(stream.viewerUrl);
 *   stream.stop();
 */

// ============================================
// TYPES
// ============================================

export interface SubstreamConfig {
  /** Backend API URL */
  backendUrl: string;
  /** The canvas element to capture and stream */
  canvasElement: HTMLCanvasElement;
  /** Streamer/player ID (preferred) */
  streamerId?: string;
  /** @deprecated Use streamerId instead */
  childId?: string;
  /** Auth token (API key or JWT) */
  authToken: string;
  /** Organization ID (associates the stream with an org on the dashboard) */
  orgId?: string;
  /** Display name for the streamer */
  streamerName?: string;
  /** Stream title (shown to viewers) */
  title?: string;
  /** Capture frame rate (default: 30) */
  fps?: number;
  /** Include captured audio in stream (default: true) */
  audio?: boolean;
  /** Called when stream goes live */
  onLive?: (info: { streamId: string; viewerUrl: string }) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when stream stops */
  onStopped?: () => void;
  /** Called when stream is reconnecting after a drop */
  onReconnecting?: () => void;
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
// AUDIO CAPTURE
//
// canvas.captureStream() only captures video.
// Game engines play audio via their own AudioContext routed to
// ctx.destination (speakers). We monkey-patch AudioNode.connect
// to tee audio destined for speakers into a MediaStream we can
// publish alongside the video.
// ============================================

let audioPatched = false;
const capturedAudioStreams: MediaStream[] = [];
let origConnect: typeof AudioNode.prototype.connect | null = null;

// ============================================
// SDK
// ============================================

export class SubstreamSDK {
  /**
   * Enable automatic audio capture by monkey-patching AudioNode.connect.
   * Call this BEFORE the game engine creates its AudioContext
   * (before Unity loader, before Phaser, etc.).
   *
   * Audio still plays through speakers normally.
   */
  static captureAudio(): void {
    if (audioPatched) return;
    audioPatched = true;

    origConnect = AudioNode.prototype.connect;
    const savedConnect = origConnect;

    (AudioNode.prototype as any).connect = function (
      dest: AudioNode | AudioParam,
      ...rest: unknown[]
    ): AudioNode | void {
      const result = (savedConnect as any).apply(this, [dest, ...rest]);

      if (
        dest instanceof AudioDestinationNode &&
        this.context &&
        !(this as any)._substreamTeed
      ) {
        try {
          const streamDest = (this.context as AudioContext).createMediaStreamDestination();
          (savedConnect as Function).call(this, streamDest);
          (this as any)._substreamTeed = true;

          const track = streamDest.stream.getAudioTracks()[0];
          if (track) {
            capturedAudioStreams.push(streamDest.stream);
            console.log('[Substream] Audio tee created for node connecting to destination');
          }
        } catch {
          // Some node types can't fan-out; safe to ignore
        }
      }

      return result;
    };
  }

  /**
   * Start streaming a canvas element to parents via IVS.
   */
  static async startStream(config: SubstreamConfig): Promise<SubstreamSession> {
    const {
      backendUrl,
      canvasElement,
      streamerId,
      childId,
      authToken,
      orgId,
      streamerName,
      title,
      fps = 30,
      audio = true,
      onLive,
      onError,
      onStopped,
    } = config;

    const resolvedStreamerId = streamerId || childId;

    if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
      throw new Error('SubstreamSDK: canvasElement must be an HTMLCanvasElement');
    }
    if (!backendUrl) throw new Error('SubstreamSDK: backendUrl is required');
    if (!resolvedStreamerId) throw new Error('SubstreamSDK: streamerId is required');
    if (!authToken) throw new Error('SubstreamSDK: authToken is required');

    console.log('[Substream] Starting stream...');

    const publishInfo = await requestPublishToken(backendUrl, resolvedStreamerId, authToken, {
      title,
      orgId,
      streamerName,
    });
    console.log(`[Substream] Got stream ${publishInfo.streamId}, viewer: ${publishInfo.viewerUrl}`);

    // Capture canvas (video only)
    const canvasStream = canvasElement.captureStream(fps);
    console.log(`[Substream] Canvas capture started at ${fps}fps, tracks: ${canvasStream.getTracks().length}`);

    // Merge captured audio tracks
    if (audio) {
      const audioStream = getCapturedAudioStream();
      if (audioStream) {
        for (const track of audioStream.getAudioTracks()) {
          canvasStream.addTrack(track);
        }
        console.log(`[Substream] Added ${audioStream.getAudioTracks().length} audio track(s)`);
      } else {
        console.log('[Substream] No captured audio tracks (call SubstreamSDK.captureAudio() before the game loads)');
      }
    }

    const IVSModule = await import('amazon-ivs-web-broadcast');
    const { Stage, LocalStageStream, SubscribeType, StageEvents } = IVSModule as any;

    const localStreams = canvasStream.getTracks().map(
      (track: MediaStreamTrack) => new LocalStageStream(track)
    );
    console.log(`[Substream] Publishing ${localStreams.length} track(s): ${canvasStream.getTracks().map(t => t.kind).join(', ')}`);

    const strategy = {
      stageStreamsToPublish: () => localStreams,
      shouldPublishParticipant: () => true,
      shouldSubscribeToParticipant: () => SubscribeType.NONE,
    };

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

    const session: SubstreamSession = {
      streamId: publishInfo.streamId,
      viewerUrl: publishInfo.viewerUrl,
      get isLive() { return isLive; },
      stop: async () => {
        console.log('[Substream] Stopping stream...');
        isLive = false;

        canvasStream.getTracks().forEach(t => t.stop());
        try { stage.leave(); } catch { /* ignore */ }

        try {
          await fetch(`${backendUrl}/api/streams/web-publish`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ streamId: publishInfo.streamId }),
          });
        } catch {
          console.warn('[Substream] Failed to notify backend of stop');
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

function getCapturedAudioStream(): MediaStream | null {
  if (capturedAudioStreams.length === 0) return null;

  const combined = new MediaStream();
  for (const s of capturedAudioStreams) {
    for (const track of s.getAudioTracks()) {
      if (track.readyState === 'live') {
        combined.addTrack(track);
      }
    }
  }
  return combined.getAudioTracks().length > 0 ? combined : null;
}

async function requestPublishToken(
  backendUrl: string,
  streamerId: string,
  authToken: string,
  opts?: { title?: string; orgId?: string; streamerName?: string },
): Promise<WebPublishResponse> {
  const response = await fetch(`${backendUrl}/api/streams/web-publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      streamerId,
      title: opts?.title,
      orgId: opts?.orgId,
      streamerName: opts?.streamerName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `SubstreamSDK: Failed to start stream (HTTP ${response.status}): ${errorData.error || 'Unknown error'}`
    );
  }

  return response.json();
}

export default SubstreamSDK;
