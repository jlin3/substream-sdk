/**
 * Type declarations for amazon-ivs-web-broadcast
 * 
 * These are partial types for the IVS Real-Time Web SDK.
 * For full types, see: https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/web-publish.html
 */

declare module 'amazon-ivs-web-broadcast' {
  export interface StageParticipantInfo {
    id: string;
    userId?: string;
    isLocal: boolean;
    attributes?: Record<string, string>;
    publishState?: 'published' | 'notPublished';
    subscribeState?: 'subscribed' | 'notSubscribed';
  }

  export interface StageStream {
    streamType: 'video' | 'audio';
    mediaStreamTrack: MediaStreamTrack;
    id: string;
  }

  export interface StageStrategy {
    stageStreamsToPublish(): StageStream[];
    shouldPublishParticipant(info: StageParticipantInfo): boolean;
    shouldSubscribeToParticipant(info: StageParticipantInfo): SubscribeType | string;
  }

  export interface StageConnectionState {
    connected: boolean;
    state: 'connected' | 'connecting' | 'disconnected';
  }

  export interface StageJoinOptions {
    simulcast?: {
      enabled: boolean;
    };
  }

  export class Stage {
    constructor(token: string, strategy: StageStrategy);
    
    join(options?: StageJoinOptions): Promise<void>;
    leave(): void;
    
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    
    refreshStrategy(): void;
  }

  export const StageEvents: {
    STAGE_CONNECTION_STATE_CHANGED: string;
    STAGE_PARTICIPANT_JOINED: string;
    STAGE_PARTICIPANT_LEFT: string;
    STAGE_PARTICIPANT_STREAMS_ADDED: string;
    STAGE_PARTICIPANT_STREAMS_REMOVED: string;
    STAGE_PARTICIPANT_PUBLISH_STATE_CHANGED: string;
    STAGE_PARTICIPANT_SUBSCRIBE_STATE_CHANGED: string;
  };

  export const SubscribeType: {
    AUDIO_VIDEO: string;
    AUDIO_ONLY: string;
    NONE: string;
  };

  export const StreamType: {
    VIDEO: string;
    AUDIO: string;
  };

  // LocalStageStream for publishing
  export class LocalStageStream implements StageStream {
    constructor(mediaStreamTrack: MediaStreamTrack);
    streamType: 'video' | 'audio';
    mediaStreamTrack: MediaStreamTrack;
    id: string;
    setMuted(muted: boolean): void;
    isMuted: boolean;
  }
}
