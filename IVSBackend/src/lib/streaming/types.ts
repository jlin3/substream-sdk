/**
 * IVS Streaming Types
 * "Private Twitch" architecture for families
 */

// ============================================
// CHANNEL TYPES
// ============================================

export interface IVSChannelConfig {
  name: string;
  latencyMode: 'NORMAL' | 'LOW';
  type: 'STANDARD' | 'BASIC';
  recordingConfigurationArn?: string;
  authorized?: boolean; // Enable playback authorization
  tags?: Record<string, string>;
}

export interface IVSChannel {
  arn: string;
  name: string;
  playbackUrl: string;
  ingestEndpoint: string;
  authorized: boolean;
  latencyMode: string;
  type: string;
  recordingConfigurationArn?: string;
}

export interface IVSStreamKey {
  arn: string;
  value: string;
  channelArn: string;
}

// ============================================
// INGEST TYPES
// ============================================

export interface IngestConfig {
  protocol: 'rtmps' | 'rtmp' | 'srt';
  endpoint: string;
  streamKey: string;
}

export interface EncoderConfig {
  maxWidth: number;
  maxHeight: number;
  maxFramerate: number;
  maxBitrateKbps: number;
  keyframeIntervalSeconds: number;
  codec: 'H.264' | 'H.265';
  profile: 'baseline' | 'main' | 'high';
}

export const RECOMMENDED_ENCODER_CONFIG: EncoderConfig = {
  maxWidth: 1280,
  maxHeight: 720,
  maxFramerate: 30,
  maxBitrateKbps: 3500,
  keyframeIntervalSeconds: 2,
  codec: 'H.264',
  profile: 'main',
};

export interface IngestProvisioningResponse {
  channelArn: string;
  ingest: IngestConfig;
  recommendedEncoderConfig: EncoderConfig;
}

// ============================================
// PLAYBACK TYPES
// ============================================

export interface PlaybackTokenPayload {
  channelArn: string;
  viewerId: string;
  exp: number;
  iat: number;
}

export interface PlaybackResponse {
  childId: string;
  channelArn: string;
  playback: {
    url: string;
    token: string;
    expiresAt: string;
  };
  status: {
    isLive: boolean;
    currentSessionId: string | null;
    lastLiveAt: string | null;
  };
}

// ============================================
// SESSION TYPES
// ============================================

export interface StreamSessionInfo {
  id: string;
  channelArn: string;
  childId: string;
  startedAt: string;
  endedAt: string | null;
  status: 'in_progress' | 'completed' | 'failed' | 'processing';
  metrics: {
    maxViewers: number | null;
    avgBitrateKbps: number | null;
    totalWatchMinutes: number | null;
  };
  vod: {
    masterUrl: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
  } | null;
}

export interface CreateSessionRequest {
  childId: string;
  metadata?: Record<string, string>;
}

export interface SessionHeartbeat {
  sessionId: string;
  currentBitrateKbps?: number;
  currentViewers?: number;
}

// ============================================
// VOD TYPES
// ============================================

export interface VODSession {
  id: string;
  childId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  playbackUrl: string;
}

export interface VODListResponse {
  childId: string;
  sessions: VODSession[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// ============================================
// IVS EVENT TYPES (CloudWatch / EventBridge)
// ============================================

export interface IVSStreamStateChangeEvent {
  version: string;
  id: string;
  'detail-type': 'IVS Stream State Change';
  source: 'aws.ivs';
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    channel_name: string;
    stream_id: string;
    event_name: 'Stream Start' | 'Stream End' | 'Stream Failure';
    reason?: string;
  };
}

export interface IVSRecordingStateChangeEvent {
  version: string;
  id: string;
  'detail-type': 'IVS Recording State Change';
  source: 'aws.ivs';
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    channel_name: string;
    stream_id: string;
    recording_status: 'Recording Start' | 'Recording End' | 'Recording Start Failure' | 'Recording End Failure';
    recording_status_reason?: string;
    recording_s3_bucket_name?: string;
    recording_s3_key_prefix?: string;
  };
}

// ============================================
// S3 RECORDING METADATA
// ============================================

export interface IVSRecordingMetadata {
  version: string;
  channel_arn: string;
  recording_configuration_arn: string;
  stream_id: string;
  start_time: string;
  end_time: string;
  recording_duration_ms: number;
  media: {
    hls: {
      duration_ms: number;
      path: string;
      playlist: string;
      renditions: Array<{
        path: string;
        playlist: string;
        resolution_width: number;
        resolution_height: number;
      }>;
    };
  };
  thumbnails?: {
    path: string;
    pattern: string;
    count: number;
  };
}

// ============================================
// API ERROR TYPES
// ============================================

export class StreamingError extends Error {
  constructor(
    message: string,
    public code: StreamingErrorCode,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StreamingError';
  }
}

export enum StreamingErrorCode {
  // Channel errors
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  CHANNEL_ALREADY_EXISTS = 'CHANNEL_ALREADY_EXISTS',
  CHANNEL_CREATION_FAILED = 'CHANNEL_CREATION_FAILED',
  
  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_ALREADY_ACTIVE = 'SESSION_ALREADY_ACTIVE',
  
  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  PARENT_NOT_LINKED = 'PARENT_NOT_LINKED',
  
  // Playback errors
  PLAYBACK_TOKEN_FAILED = 'PLAYBACK_TOKEN_FAILED',
  PLAYBACK_NOT_AUTHORIZED = 'PLAYBACK_NOT_AUTHORIZED',
  
  // VOD errors
  VOD_NOT_FOUND = 'VOD_NOT_FOUND',
  VOD_NOT_READY = 'VOD_NOT_READY',
  
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}
