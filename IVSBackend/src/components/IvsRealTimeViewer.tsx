'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * IVS Real-Time Viewer Component
 * 
 * Uses the Amazon IVS Web Broadcast SDK to subscribe to a stage
 * and display the publisher's video stream via canvas rendering.
 * 
 * Canvas rendering is used instead of direct <video> display to avoid
 * browser-specific video element rendering quirks.
 * 
 * @see https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/web-subscribe.html
 */

interface IvsRealTimeViewerProps {
  token: string;
  stageArn: string;
  participantId: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Type definitions for IVS SDK (loaded dynamically)
interface StageParticipantInfo {
  id: string;
  userId?: string;
  isLocal: boolean;
  attributes?: Record<string, string>;
  publishState?: 'published' | 'notPublished';
  subscribeState?: 'subscribed' | 'notSubscribed';
}

interface StageStream {
  streamType: 'video' | 'audio';
  mediaStreamTrack: MediaStreamTrack;
}

interface StageStrategy {
  stageStreamsToPublish(): StageStream[];
  shouldPublishParticipant(info: StageParticipantInfo): boolean;
  shouldSubscribeToParticipant(info: StageParticipantInfo): string;
}

interface StageEvents {
  STAGE_CONNECTION_STATE_CHANGED: string;
  STAGE_PARTICIPANT_JOINED: string;
  STAGE_PARTICIPANT_LEFT: string;
  STAGE_PARTICIPANT_STREAMS_ADDED: string;
  STAGE_PARTICIPANT_STREAMS_REMOVED: string;
  STAGE_PARTICIPANT_PUBLISH_STATE_CHANGED: string;
  STAGE_PARTICIPANT_SUBSCRIBE_STATE_CHANGED: string;
}

interface IVSBroadcastClient {
  Stage: new (token: string, strategy: StageStrategy) => {
    join(): Promise<void>;
    leave(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    refreshStrategy(): void;
  };
  StageEvents: StageEvents;
  SubscribeType: {
    AUDIO_VIDEO: string;
    AUDIO_ONLY: string;
    NONE: string;
  };
}

export default function IvsRealTimeViewer({ 
  token, 
  stageArn, 
  participantId 
}: IvsRealTimeViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const stageRef = useRef<{
    join(): Promise<void>;
    leave(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    refreshStrategy(): void;
  } | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [stats, setStats] = useState<{
    resolution?: string;
    fps?: number;
    pixelSample?: string; // Debug: center pixel color
  }>({});

  // Draw video frames to canvas (bypasses <video> element display issues)
  const startCanvasRenderer = useCallback(() => {
    const videoEl = videoRef.current;
    const canvas = canvasRef.current;
    if (!videoEl || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let frameCount = 0;
    let lastLogTime = Date.now();
    
    const drawFrame = () => {
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
        // Match canvas size to video
        if (canvas.width !== videoEl.videoWidth || canvas.height !== videoEl.videoHeight) {
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          console.log(`[IVS Viewer] Canvas resized to ${canvas.width}x${canvas.height}`);
        }
        
        // Draw video frame to canvas
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        frameCount++;
        
        // Log pixel sample every 5 seconds for diagnosis
        const now = Date.now();
        if (now - lastLogTime > 5000) {
          try {
            const cx = Math.floor(canvas.width / 2);
            const cy = Math.floor(canvas.height / 2);
            const pixel = ctx.getImageData(cx, cy, 1, 1).data;
            const pixelStr = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]})`;
            const isBlack = pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0;
            
            console.log(`[IVS Viewer] Canvas: ${frameCount} frames drawn, ` +
              `center pixel: ${pixelStr}, isBlack: ${isBlack}, ` +
              `video.currentTime: ${videoEl.currentTime.toFixed(1)}`);
            
            setStats(prev => ({
              ...prev,
              resolution: `${canvas.width}x${canvas.height}`,
              pixelSample: isBlack ? 'BLACK' : pixelStr,
            }));
          } catch (e) {
            // getImageData can fail with security errors on cross-origin content
            console.warn('[IVS Viewer] Could not sample pixel:', e);
          }
          lastLogTime = now;
          frameCount = 0;
        }
      }
      
      animFrameRef.current = requestAnimationFrame(drawFrame);
    };
    
    console.log('[IVS Viewer] Starting canvas renderer');
    drawFrame();
  }, []);

  // Stop canvas renderer
  const stopCanvasRenderer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  // Handle participant streams
  const handleStreamsAdded = useCallback((participant: StageParticipantInfo, streams: StageStream[]) => {
    console.log('[IVS Viewer] Streams added from participant:', participant.id, 
      'isLocal:', participant.isLocal, 
      'streams:', streams.length,
      'types:', streams.map(s => s.streamType));
    
    if (participant.isLocal) return;
    
    const videoEl = videoRef.current;
    if (!videoEl) {
      console.warn('[IVS Viewer] No video element ref');
      return;
    }

    const mediaStream = new MediaStream();
    
    streams.forEach((stream) => {
      console.log('[IVS Viewer] Adding track:', stream.streamType, 
        'enabled:', stream.mediaStreamTrack.enabled,
        'readyState:', stream.mediaStreamTrack.readyState,
        'muted:', stream.mediaStreamTrack.muted);
      mediaStream.addTrack(stream.mediaStreamTrack);
    });

    console.log('[IVS Viewer] MediaStream tracks:', mediaStream.getTracks().length);

    // Set stream on hidden video element (used for decoding; canvas renders visually)
    videoEl.srcObject = mediaStream;
    videoEl.muted = true;
    videoEl.play()
      .then(() => {
        setIsPlaying(true);
        console.log('[IVS Viewer] Video decoding started, launching canvas renderer');
        // Start drawing to canvas
        startCanvasRenderer();
      })
      .catch((err) => {
        console.error('[IVS Viewer] Autoplay failed:', err);
        setIsPlaying(false);
      });
  }, [startCanvasRenderer]);

  // Handle participant leaving
  const handleStreamsRemoved = useCallback((participant: StageParticipantInfo) => {
    console.log('[IVS Viewer] Streams removed from:', participant.id);
    if (participant.isLocal) return;
    
    stopCanvasRenderer();
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.srcObject = null;
      setIsPlaying(false);
    }
  }, [stopCanvasRenderer]);

  // Initialize IVS SDK and connect to stage
  useEffect(() => {
    let stage: {
      join(): Promise<void>;
      leave(): void;
      on(event: string, callback: (...args: unknown[]) => void): void;
      off(event: string, callback: (...args: unknown[]) => void): void;
      refreshStrategy(): void;
    } | null = null;
    let mounted = true;

    async function initializeStage() {
      try {
        setConnectionState('connecting');
        setError(null);

        const IVSModule = await import('amazon-ivs-web-broadcast') as unknown as IVSBroadcastClient;
        if (!mounted) return;

        console.log('[IVS Viewer] SDK loaded, SubscribeType:', JSON.stringify(IVSModule.SubscribeType));

        const strategy: StageStrategy = {
          stageStreamsToPublish: () => [],
          shouldPublishParticipant: () => false,
          shouldSubscribeToParticipant: (info) => {
            const subscribeType = info.isLocal 
              ? IVSModule.SubscribeType.NONE 
              : IVSModule.SubscribeType.AUDIO_VIDEO;
            console.log('[IVS Viewer] shouldSubscribe:', info.id, subscribeType);
            return subscribeType;
          },
        };

        stage = new IVSModule.Stage(token, strategy);

        stage.on(IVSModule.StageEvents.STAGE_CONNECTION_STATE_CHANGED, 
          (...args: unknown[]) => {
            const state = args[0] as string;
            console.log('[IVS Viewer] Connection state:', state);
            if (state === 'connected') setConnectionState('connected');
            else if (state === 'disconnected') setConnectionState('disconnected');
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_JOINED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            console.log('[IVS Viewer] Participant joined:', info.id, 'isLocal:', info.isLocal);
            if (!info.isLocal && stage) stage.refreshStrategy();
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_LEFT,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            console.log('[IVS Viewer] Participant left:', info.id);
            if (!info.isLocal) setError('Stream ended');
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_PUBLISH_STATE_CHANGED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            const pubState = args[1] as string;
            console.log('[IVS Viewer] Publish state:', info.id, pubState);
            if (!info.isLocal && stage) stage.refreshStrategy();
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_SUBSCRIBE_STATE_CHANGED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            const subState = args[1] as string;
            console.log('[IVS Viewer] Subscribe state:', info.id, subState);
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            const streams = args[1] as StageStream[];
            handleStreamsAdded(info, streams);
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            handleStreamsRemoved(info);
          }
        );

        console.log('[IVS Viewer] Joining stage...');
        await stage.join();
        console.log('[IVS Viewer] Joined stage');

        if (mounted) stageRef.current = stage;
      } catch (err) {
        console.error('[IVS Viewer] Failed to initialize:', err);
        if (mounted) {
          setConnectionState('error');
          setError(err instanceof Error ? err.message : 'Failed to connect');
        }
      }
    }

    initializeStage();

    return () => {
      mounted = false;
      stopCanvasRenderer();
      if (stage) { stage.leave(); }
    };
  }, [token, handleStreamsAdded, handleStreamsRemoved, stopCanvasRenderer]);

  const handlePlayClick = async () => {
    const videoEl = videoRef.current;
    if (!videoEl?.srcObject) return;
    try {
      videoEl.muted = false;
      setIsMuted(false);
      await videoEl.play();
      setIsPlaying(true);
      startCanvasRenderer();
    } catch {
      videoEl.muted = true;
      setIsMuted(true);
      try {
        await videoEl.play();
        setIsPlaying(true);
        startCanvasRenderer();
      } catch (e) {
        console.error('[IVS Viewer] Play failed:', e);
      }
    }
  };

  const handleMuteToggle = () => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.muted = !videoEl.muted;
      setIsMuted(videoEl.muted);
    }
  };

  return (
    <div style={styles.container}>
      {/* Video area */}
      <div style={styles.videoWrapper}>
        {/* Hidden video element - used for decoding only */}
        <video
          ref={videoRef}
          style={styles.hiddenVideo}
          autoPlay
          playsInline
          muted
        />
        
        {/* Canvas element - used for visual rendering */}
        <canvas
          ref={canvasRef}
          style={styles.canvas}
        />
        
        {/* Loading overlay */}
        {connectionState === 'connecting' && (
          <div style={styles.overlay}>
            <div style={styles.spinner} />
            <p>Connecting to stream...</p>
          </div>
        )}
        
        {/* Error overlay */}
        {connectionState === 'error' && (
          <div style={styles.overlay}>
            <p style={{ color: '#ef4444' }}>{error || 'Connection error'}</p>
          </div>
        )}
        
        {/* Play button */}
        {connectionState === 'connected' && !isPlaying && (
          <div style={styles.overlay}>
            <button onClick={handlePlayClick} style={styles.playButton}>
              ▶ Play
            </button>
          </div>
        )}
        
        {/* Stream ended */}
        {error === 'Stream ended' && (
          <div style={styles.overlay}>
            <p>The stream has ended</p>
          </div>
        )}
      </div>
      
      {/* Stats bar */}
      <div style={styles.statsBar}>
        {stats.resolution && <span>📺 {stats.resolution}</span>}
        {stats.pixelSample && (
          <span style={{ color: stats.pixelSample === 'BLACK' ? '#ef4444' : '#22c55e' }}>
            🎨 {stats.pixelSample === 'BLACK' ? 'Content is BLACK (Unity camera issue)' : stats.pixelSample}
          </span>
        )}
        {isPlaying && (
          <button onClick={handleMuteToggle} style={styles.muteButton}>
            {isMuted ? '🔇 Unmute' : '🔊 Sound On'}
          </button>
        )}
        <span style={{ 
          color: connectionState === 'connected' ? '#22c55e' : '#888',
          marginLeft: 'auto',
        }}>
          ● {connectionState === 'connected' ? 'Connected' : connectionState}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#000',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#111',
    minHeight: '300px',
    overflow: 'hidden',
  },
  hiddenVideo: {
    // Hidden: only used for decoding, canvas renders visually
    position: 'absolute',
    width: '1px',
    height: '1px',
    opacity: 0,
    pointerEvents: 'none' as const,
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    gap: '1rem',
    zIndex: 10,
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #333',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  playButton: {
    padding: '1rem 2rem',
    fontSize: '1.5rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  statsBar: {
    display: 'flex',
    gap: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#111',
    fontSize: '0.75rem',
    color: '#888',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  muteButton: {
    background: 'none',
    border: '1px solid #444',
    color: '#ccc',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
};
