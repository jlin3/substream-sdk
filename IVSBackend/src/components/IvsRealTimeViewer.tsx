'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * IVS Real-Time Viewer Component
 * 
 * Uses the Amazon IVS Web Broadcast SDK to subscribe to a stage
 * and display the publisher's video stream.
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
  shouldSubscribeToParticipant(info: StageParticipantInfo): string; // Returns SubscribeType enum value
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
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [stats, setStats] = useState<{
    bitrate?: number;
    resolution?: string;
    fps?: number;
    trackState?: string;
  }>({});

  // Handle participant streams
  const handleStreamsAdded = useCallback((participant: StageParticipantInfo, streams: StageStream[]) => {
    console.log('[IVS Viewer] Streams added from participant:', participant.id, 
      'isLocal:', participant.isLocal, 
      'streams:', streams.length,
      'types:', streams.map(s => s.streamType));
    
    // Only handle remote participants (publisher)
    if (participant.isLocal) return;
    
    const videoEl = videoRef.current;
    if (!videoEl) {
      console.warn('[IVS Viewer] No video element ref');
      return;
    }

    // Create a MediaStream from the received tracks
    const mediaStream = new MediaStream();
    let hasVideo = false;
    
    streams.forEach((stream) => {
      console.log('[IVS Viewer] Adding track:', stream.streamType, 
        'enabled:', stream.mediaStreamTrack.enabled,
        'readyState:', stream.mediaStreamTrack.readyState,
        'muted:', stream.mediaStreamTrack.muted);
      mediaStream.addTrack(stream.mediaStreamTrack);
      
      // Track stats for video
      if (stream.streamType === 'video') {
        hasVideo = true;
        const track = stream.mediaStreamTrack;
        const settings = track.getSettings();
        console.log('[IVS Viewer] Video track settings:', JSON.stringify(settings));
        
        const width = settings.width;
        const height = settings.height;
        setStats(prev => ({
          ...prev,
          resolution: width && height ? `${width}x${height}` : 'Initializing...',
          fps: settings.frameRate,
        }));

        // Listen for track unmute event (fires when first frame arrives)
        track.onunmute = () => {
          console.log('[IVS Viewer] Video track UNMUTED - frames should be arriving now');
          const s = track.getSettings();
          console.log('[IVS Viewer] Track settings after unmute:', JSON.stringify(s));
          if (s.width && s.height) {
            setStats(prev => ({
              ...prev,
              resolution: `${s.width}x${s.height}`,
              fps: s.frameRate,
            }));
          }
        };
        
        track.onmute = () => {
          console.log('[IVS Viewer] Video track MUTED - frames stopped');
        };
        
        track.onended = () => {
          console.log('[IVS Viewer] Video track ENDED');
        };

        // Monitor track and video element for frames arriving
        const pollSettings = setInterval(() => {
          if (track.readyState === 'ended') {
            clearInterval(pollSettings);
            return;
          }
          const s = track.getSettings();
          const vid = videoRef.current;
          const vidW = vid?.videoWidth || 0;
          const vidH = vid?.videoHeight || 0;
          const vidReady = vid?.readyState || 0;
          const vidTime = vid?.currentTime?.toFixed(2) || '0';
          const trackMuted = track.muted;
          
          console.log(`[IVS Viewer] Poll: track.muted=${trackMuted}, ` +
            `track.readyState=${track.readyState}, ` +
            `settings=${s.width}x${s.height}, ` +
            `video.readyState=${vidReady}, ` +
            `video.dimensions=${vidW}x${vidH}, ` +
            `video.currentTime=${vidTime}`);
          
          if (s.width && s.height) {
            setStats(prev => ({
              ...prev,
              resolution: `${s.width}x${s.height}`,
              fps: s.frameRate,
            }));
          } else if (vidW > 0 && vidH > 0) {
            // Fall back to video element dimensions
            setStats(prev => ({
              ...prev,
              resolution: `${vidW}x${vidH}`,
            }));
          }
        }, 3000);

        // Clean up poll after 60s
        setTimeout(() => clearInterval(pollSettings), 60000);
      }
    });

    console.log('[IVS Viewer] MediaStream tracks:', mediaStream.getTracks().length, 'hasVideo:', hasVideo);

    // Set the stream on the video element
    videoEl.srcObject = mediaStream;
    
    // Start muted for autoplay compliance, then unmute
    videoEl.muted = true;
    videoEl.play()
      .then(() => {
        setIsPlaying(true);
        console.log('[IVS Viewer] Video playback started (muted for autoplay)');
      })
      .catch((err) => {
        console.error('[IVS Viewer] Autoplay failed even muted:', err);
        setIsPlaying(false);
      });
  }, []);

  // Handle participant leaving (stream ended)
  const handleStreamsRemoved = useCallback((participant: StageParticipantInfo) => {
    console.log('[IVS Viewer] Streams removed from:', participant.id);
    
    if (participant.isLocal) return;
    
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.srcObject = null;
      setIsPlaying(false);
    }
  }, []);

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

        // Dynamically import the IVS Web Broadcast SDK
        // This is required because it uses browser-only APIs
        const IVSModule = await import('amazon-ivs-web-broadcast') as unknown as IVSBroadcastClient;
        
        if (!mounted) return;

        console.log('[IVS Viewer] SDK loaded, SubscribeType values:', JSON.stringify(IVSModule.SubscribeType));

        // Create stage strategy (subscribe-only, no publishing)
        // IMPORTANT: shouldSubscribeToParticipant must return SubscribeType enum, NOT boolean
        const strategy: StageStrategy = {
          stageStreamsToPublish: () => [], // We don't publish anything
          shouldPublishParticipant: () => false, // Never publish
          shouldSubscribeToParticipant: (info) => {
            const subscribeType = info.isLocal 
              ? IVSModule.SubscribeType.NONE 
              : IVSModule.SubscribeType.AUDIO_VIDEO;
            console.log('[IVS Viewer] shouldSubscribeToParticipant:', info.id, 
              'isLocal:', info.isLocal, 
              'returning:', subscribeType);
            return subscribeType;
          },
        };

        // Create and join the stage
        stage = new IVSModule.Stage(token, strategy);

        // Set up event handlers
        stage.on(IVSModule.StageEvents.STAGE_CONNECTION_STATE_CHANGED, 
          (...args: unknown[]) => {
            const state = args[0] as string;
            console.log('[IVS Viewer] Connection state:', state);
            if (state === 'connected') {
              setConnectionState('connected');
            } else if (state === 'disconnected') {
              setConnectionState('disconnected');
            }
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_JOINED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            console.log('[IVS Viewer] Participant joined:', info.id, 'isLocal:', info.isLocal);
            // Refresh strategy so SDK re-evaluates subscription for new participant
            if (!info.isLocal && stage) {
              console.log('[IVS Viewer] Refreshing strategy for new participant');
              stage.refreshStrategy();
            }
          }
        );

        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_LEFT,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            console.log('[IVS Viewer] Participant left:', info.id);
            if (!info.isLocal) {
              // Publisher left - stream ended
              setError('Stream ended');
            }
          }
        );

        // Handle publish state changes (WHIP publisher may start publishing after join)
        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_PUBLISH_STATE_CHANGED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            const publishState = args[1] as string;
            console.log('[IVS Viewer] Participant publish state changed:', info.id, 
              'state:', publishState, 'isLocal:', info.isLocal);
            // When a remote participant starts publishing, refresh strategy to trigger subscription
            if (!info.isLocal && stage) {
              console.log('[IVS Viewer] Refreshing strategy after publish state change');
              stage.refreshStrategy();
            }
          }
        );

        // Handle subscribe state changes (for debugging)
        stage.on(IVSModule.StageEvents.STAGE_PARTICIPANT_SUBSCRIBE_STATE_CHANGED,
          (...args: unknown[]) => {
            const info = args[0] as StageParticipantInfo;
            const subscribeState = args[1] as string;
            console.log('[IVS Viewer] Subscribe state changed:', info.id, 
              'state:', subscribeState);
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

        // Join the stage
        console.log('[IVS Viewer] Joining stage with token length:', token?.length);
        await stage.join();
        console.log('[IVS Viewer] Successfully joined stage');

        if (mounted) {
          stageRef.current = stage;
        }
      } catch (err) {
        console.error('[IVS Viewer] Failed to initialize:', err);
        if (mounted) {
          setConnectionState('error');
          setError(err instanceof Error ? err.message : 'Failed to connect to stream');
        }
      }
    }

    initializeStage();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (stage) {
        console.log('[IVS Viewer] Leaving stage...');
        stage.leave();
      }
    };
  }, [token, handleStreamsAdded, handleStreamsRemoved]);

  // Manual play/unmute button handler
  const handlePlayClick = async () => {
    const videoEl = videoRef.current;
    if (videoEl) {
      try {
        if (!videoEl.srcObject) {
          console.warn('[IVS Viewer] No srcObject on video element');
          return;
        }
        videoEl.muted = false;
        setIsMuted(false);
        await videoEl.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('[IVS Viewer] Play failed:', err);
        // If unmuted play fails, try muted
        videoEl.muted = true;
        setIsMuted(true);
        try {
          await videoEl.play();
          setIsPlaying(true);
        } catch (err2) {
          console.error('[IVS Viewer] Even muted play failed:', err2);
        }
      }
    }
  };

  // Toggle mute
  const handleMuteToggle = () => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.muted = !videoEl.muted;
      setIsMuted(videoEl.muted);
    }
  };

  return (
    <div style={styles.container}>
      {/* Video container */}
      <div style={styles.videoWrapper}>
        <video
          ref={videoRef}
          style={styles.video}
          autoPlay
          playsInline
          muted
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
        
        {/* Play button for when video hasn't started yet */}
        {connectionState === 'connected' && !isPlaying && (
          <div style={styles.overlay}>
            <button onClick={handlePlayClick} style={styles.playButton}>
              ▶ Play
            </button>
          </div>
        )}
        
        {/* Stream ended overlay */}
        {error === 'Stream ended' && (
          <div style={styles.overlay}>
            <p>The stream has ended</p>
          </div>
        )}
      </div>
      
      {/* Stats bar - always show when connected for diagnostics */}
      <div style={styles.statsBar}>
        {stats.resolution && <span>📺 {stats.resolution}</span>}
        {stats.fps != null && isFinite(stats.fps) ? <span>🎬 {stats.fps.toFixed(0)} fps</span> : null}
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
    backgroundColor: '#000',
    minHeight: '300px',
    overflow: 'hidden',
  },
  video: {
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
    transition: 'transform 0.2s, background-color 0.2s',
  },
  statsBar: {
    display: 'flex',
    gap: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#111',
    fontSize: '0.75rem',
    color: '#888',
    alignItems: 'center',
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
