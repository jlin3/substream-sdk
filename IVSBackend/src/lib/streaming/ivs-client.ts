/**
 * AWS IVS Client Wrapper
 * Handles all IVS Low-Latency channel operations
 */

import {
  IvsClient,
  CreateChannelCommand,
  DeleteChannelCommand,
  GetChannelCommand,
  ListChannelsCommand,
  CreateStreamKeyCommand,
  GetStreamKeyCommand,
  ListStreamKeysCommand,
  DeleteStreamKeyCommand,
  GetStreamCommand,
  ListStreamsCommand,
  StopStreamCommand,
  GetStreamSessionCommand,
  ListStreamSessionsCommand,
  CreateRecordingConfigurationCommand,
  GetRecordingConfigurationCommand,
  DeleteRecordingConfigurationCommand,
  CreatePlaybackRestrictionPolicyCommand,
  type Channel,
  type _Stream as Stream,
  type StreamSession,
  type ChannelLatencyMode,
  type ChannelType,
} from '@aws-sdk/client-ivs';
import { type IVSChannelConfig, type IVSChannel, type IVSStreamKey } from './types';

// ============================================
// CLIENT INITIALIZATION
// ============================================

let ivsClient: IvsClient | null = null;

export function getIVSClient(): IvsClient {
  if (!ivsClient) {
    const region = process.env.AWS_REGION || 'us-east-1';
    
    ivsClient = new IvsClient({
      region,
      // Credentials are automatically loaded from environment or IAM role
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return ivsClient;
}

// ============================================
// CHANNEL OPERATIONS
// ============================================

export async function createChannel(config: IVSChannelConfig): Promise<IVSChannel> {
  const client = getIVSClient();
  
  const command = new CreateChannelCommand({
    name: config.name,
    latencyMode: config.latencyMode as ChannelLatencyMode,
    type: config.type as ChannelType,
    recordingConfigurationArn: config.recordingConfigurationArn,
    authorized: config.authorized ?? true, // Enable playback auth by default
    tags: config.tags,
  });
  
  const response = await client.send(command);
  
  if (!response.channel) {
    throw new Error('Failed to create channel: no channel returned');
  }
  
  return mapChannel(response.channel);
}

export async function getChannel(channelArn: string): Promise<IVSChannel | null> {
  const client = getIVSClient();
  
  try {
    const command = new GetChannelCommand({ arn: channelArn });
    const response = await client.send(command);
    
    if (!response.channel) {
      return null;
    }
    
    return mapChannel(response.channel);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

export async function deleteChannel(channelArn: string): Promise<void> {
  const client = getIVSClient();
  
  // First, delete all stream keys
  const streamKeys = await listStreamKeys(channelArn);
  for (const key of streamKeys) {
    await deleteStreamKey(key.arn);
  }
  
  // Then delete the channel
  const command = new DeleteChannelCommand({ arn: channelArn });
  await client.send(command);
}

export async function listChannels(
  filterByName?: string,
  maxResults?: number,
  nextToken?: string
): Promise<{ channels: IVSChannel[]; nextToken?: string }> {
  const client = getIVSClient();
  
  const command = new ListChannelsCommand({
    filterByName,
    maxResults: maxResults ?? 50,
    nextToken,
  });
  
  const response = await client.send(command);
  
  return {
    channels: (response.channels ?? []).map(mapChannel),
    nextToken: response.nextToken,
  };
}

// ============================================
// STREAM KEY OPERATIONS
// ============================================

export async function createStreamKey(channelArn: string): Promise<IVSStreamKey> {
  const client = getIVSClient();
  
  const command = new CreateStreamKeyCommand({
    channelArn,
  });
  
  const response = await client.send(command);
  
  if (!response.streamKey) {
    throw new Error('Failed to create stream key: no key returned');
  }
  
  return {
    arn: response.streamKey.arn!,
    value: response.streamKey.value!,
    channelArn: response.streamKey.channelArn!,
  };
}

export async function getStreamKey(streamKeyArn: string): Promise<IVSStreamKey | null> {
  const client = getIVSClient();
  
  try {
    const command = new GetStreamKeyCommand({ arn: streamKeyArn });
    const response = await client.send(command);
    
    if (!response.streamKey) {
      return null;
    }
    
    return {
      arn: response.streamKey.arn!,
      value: response.streamKey.value!,
      channelArn: response.streamKey.channelArn!,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

export async function listStreamKeys(channelArn: string): Promise<IVSStreamKey[]> {
  const client = getIVSClient();
  
  const command = new ListStreamKeysCommand({ channelArn });
  const response = await client.send(command);
  
  // ListStreamKeys only returns summaries, need to get full keys
  const streamKeys: IVSStreamKey[] = [];
  for (const summary of response.streamKeys ?? []) {
    const key = await getStreamKey(summary.arn!);
    if (key) {
      streamKeys.push(key);
    }
  }
  
  return streamKeys;
}

export async function deleteStreamKey(streamKeyArn: string): Promise<void> {
  const client = getIVSClient();
  const command = new DeleteStreamKeyCommand({ arn: streamKeyArn });
  await client.send(command);
}

// ============================================
// STREAM OPERATIONS
// ============================================

export async function getStream(channelArn: string): Promise<Stream | null> {
  const client = getIVSClient();
  
  try {
    const command = new GetStreamCommand({ channelArn });
    const response = await client.send(command);
    return response.stream ?? null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ChannelNotBroadcasting') {
      return null;
    }
    throw error;
  }
}

export async function listStreams(
  filterByHealth?: 'HEALTHY' | 'STARVING' | 'UNKNOWN',
  maxResults?: number,
  nextToken?: string
): Promise<{ streams: Stream[]; nextToken?: string }> {
  const client = getIVSClient();
  
  const command = new ListStreamsCommand({
    filterBy: filterByHealth ? { health: filterByHealth } : undefined,
    maxResults: maxResults ?? 50,
    nextToken,
  });
  
  const response = await client.send(command);
  
  // ListStreams returns StreamSummary, but we'll cast to Stream for simplicity
  return {
    streams: (response.streams ?? []) as Stream[],
    nextToken: response.nextToken,
  };
}

export async function stopStream(channelArn: string): Promise<void> {
  const client = getIVSClient();
  const command = new StopStreamCommand({ channelArn });
  await client.send(command);
}

// ============================================
// STREAM SESSION OPERATIONS
// ============================================

export async function getStreamSession(
  channelArn: string,
  streamId: string
): Promise<StreamSession | null> {
  const client = getIVSClient();
  
  try {
    const command = new GetStreamSessionCommand({ channelArn, streamId });
    const response = await client.send(command);
    return response.streamSession ?? null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

export async function listStreamSessions(
  channelArn: string,
  maxResults?: number,
  nextToken?: string
): Promise<{ sessions: StreamSession[]; nextToken?: string }> {
  const client = getIVSClient();
  
  const command = new ListStreamSessionsCommand({
    channelArn,
    maxResults: maxResults ?? 50,
    nextToken,
  });
  
  const response = await client.send(command);
  
  return {
    sessions: (response.streamSessions ?? []) as StreamSession[],
    nextToken: response.nextToken,
  };
}

// ============================================
// RECORDING CONFIGURATION
// ============================================

export async function createRecordingConfiguration(
  bucketName: string,
  prefix?: string
): Promise<string> {
  const client = getIVSClient();
  
  const command = new CreateRecordingConfigurationCommand({
    destinationConfiguration: {
      s3: {
        bucketName,
      },
    },
    recordingReconnectWindowSeconds: 60, // Allow 60 second reconnect window
    thumbnailConfiguration: {
      recordingMode: 'INTERVAL',
      targetIntervalSeconds: 60, // Thumbnail every minute
      resolution: 'LOWEST_RESOLUTION',
      storage: ['SEQUENTIAL'],
    },
    name: `recording-config-${prefix || 'default'}`,
  });
  
  const response = await client.send(command);
  
  if (!response.recordingConfiguration?.arn) {
    throw new Error('Failed to create recording configuration');
  }
  
  return response.recordingConfiguration.arn;
}

export async function getRecordingConfiguration(arn: string): Promise<unknown | null> {
  const client = getIVSClient();
  
  try {
    const command = new GetRecordingConfigurationCommand({ arn });
    const response = await client.send(command);
    return response.recordingConfiguration ?? null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

export async function deleteRecordingConfiguration(arn: string): Promise<void> {
  const client = getIVSClient();
  const command = new DeleteRecordingConfigurationCommand({ arn });
  await client.send(command);
}

// ============================================
// PLAYBACK RESTRICTION POLICY
// ============================================

export async function createPlaybackRestrictionPolicy(
  name: string,
  allowedCountries?: string[],
  allowedOrigins?: string[]
): Promise<string> {
  const client = getIVSClient();
  
  const command = new CreatePlaybackRestrictionPolicyCommand({
    name,
    enableStrictOriginEnforcement: !!allowedOrigins,
    allowedCountries: allowedCountries ?? [], // Empty = allow all
    allowedOrigins: allowedOrigins ?? [], // Empty = allow all
  });
  
  const response = await client.send(command);
  
  if (!response.playbackRestrictionPolicy?.arn) {
    throw new Error('Failed to create playback restriction policy');
  }
  
  return response.playbackRestrictionPolicy.arn;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapChannel(channel: Channel): IVSChannel {
  return {
    arn: channel.arn!,
    name: channel.name!,
    playbackUrl: channel.playbackUrl!,
    ingestEndpoint: channel.ingestEndpoint!,
    authorized: channel.authorized ?? false,
    latencyMode: channel.latencyMode!,
    type: channel.type!,
    recordingConfigurationArn: channel.recordingConfigurationArn,
  };
}

// ============================================
// INGEST URL HELPER
// ============================================

export function buildRTMPSIngestUrl(ingestEndpoint: string, streamKey: string): string {
  // IVS ingest endpoints are like: rtmps://<random>.global-contribute.live-video.net:443/app/
  // Full URL format: rtmps://<endpoint>:443/app/<stream-key>
  return `rtmps://${ingestEndpoint}:443/app/${streamKey}`;
}

export function getIngestProtocol(): 'rtmps' {
  return 'rtmps';
}
