/**
 * AWS IVS Real-Time Client Wrapper
 * Handles IVS Real-Time Stage operations for WebRTC streaming
 * 
 * IVS Real-Time uses WebRTC for input and can output HLS for viewers.
 * This replaces RTMPS ingest (which required FFmpeg) with native WebRTC.
 */

import {
  IVSRealTimeClient,
  CreateStageCommand,
  DeleteStageCommand,
  GetStageCommand,
  ListStagesCommand,
  CreateParticipantTokenCommand,
  GetParticipantCommand,
  ListParticipantsCommand,
  DisconnectParticipantCommand,
  CreateStorageConfigurationCommand,
  GetStorageConfigurationCommand,
  ListStorageConfigurationsCommand,
  DeleteStorageConfigurationCommand,
  StartCompositionCommand,
  StopCompositionCommand,
  GetCompositionCommand,
  ListCompositionsCommand,
  type Stage,
  type ParticipantToken,
  type Participant,
  type ParticipantTokenCapability,
  type StorageConfiguration,
  type Composition,
  type CompositionSummary,
} from '@aws-sdk/client-ivs-realtime';

// ============================================
// CLIENT INITIALIZATION
// ============================================

let realTimeClient: IVSRealTimeClient | null = null;

export function getIVSRealTimeClient(): IVSRealTimeClient {
  if (!realTimeClient) {
    const region = process.env.AWS_REGION || 'us-east-1';
    
    realTimeClient = new IVSRealTimeClient({
      region,
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
  return realTimeClient;
}

// ============================================
// TYPES
// ============================================

export interface IVSStageConfig {
  name: string;
  tags?: Record<string, string>;
}

export interface IVSStage {
  arn: string;
  name: string;
  activeSessionId?: string;
  tags?: Record<string, string>;
}

export interface IVSParticipantTokenConfig {
  stageArn: string;
  userId: string;
  capabilities: ('PUBLISH' | 'SUBSCRIBE')[];
  duration?: number; // in minutes, default 720 (12 hours)
  attributes?: Record<string, string>;
}

export interface IVSParticipantTokenResponse {
  token: string;
  participantId: string;
  expirationTime: Date;
}

export interface IVSCompositionConfig {
  stageArn: string;
  destinations: {
    s3?: {
      storageConfigurationArn: string;
      encoderConfiguration?: {
        video?: {
          width?: number;
          height?: number;
          framerate?: number;
          bitrate?: number;
        };
      };
    };
    channel?: {
      channelArn: string; // For HLS output via IVS Low-Latency channel
    };
  }[];
  idempotencyToken?: string;
}

// ============================================
// STAGE OPERATIONS
// ============================================

/**
 * Create a new IVS Real-Time Stage
 * A Stage is a virtual room where participants can stream via WebRTC
 */
export async function createStage(config: IVSStageConfig): Promise<IVSStage> {
  const client = getIVSRealTimeClient();
  
  const command = new CreateStageCommand({
    name: config.name,
    tags: config.tags,
  });
  
  const response = await client.send(command);
  
  if (!response.stage) {
    throw new Error('Failed to create stage: no stage returned');
  }
  
  return mapStage(response.stage);
}

/**
 * Get an existing Stage by ARN
 */
export async function getStage(stageArn: string): Promise<IVSStage | null> {
  const client = getIVSRealTimeClient();
  
  try {
    const command = new GetStageCommand({ arn: stageArn });
    const response = await client.send(command);
    
    if (!response.stage) {
      return null;
    }
    
    return mapStage(response.stage);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

/**
 * List all Stages
 */
export async function listStages(): Promise<IVSStage[]> {
  const client = getIVSRealTimeClient();
  
  const command = new ListStagesCommand({});
  const response = await client.send(command);
  
  return (response.stages || []).map(mapStage);
}

/**
 * Delete a Stage
 */
export async function deleteStage(stageArn: string): Promise<void> {
  const client = getIVSRealTimeClient();
  
  const command = new DeleteStageCommand({ arn: stageArn });
  await client.send(command);
}

// ============================================
// PARTICIPANT TOKEN OPERATIONS
// ============================================

/**
 * Create a participant token for joining a Stage
 * This token is used by Unity to connect via WebRTC
 */
export async function createParticipantToken(
  config: IVSParticipantTokenConfig
): Promise<IVSParticipantTokenResponse> {
  const client = getIVSRealTimeClient();
  
  const command = new CreateParticipantTokenCommand({
    stageArn: config.stageArn,
    userId: config.userId,
    capabilities: config.capabilities as ParticipantTokenCapability[],
    duration: config.duration || 720, // 12 hours default
    attributes: config.attributes,
  });
  
  const response = await client.send(command);
  
  if (!response.participantToken) {
    throw new Error('Failed to create participant token');
  }
  
  return {
    token: response.participantToken.token!,
    participantId: response.participantToken.participantId!,
    expirationTime: response.participantToken.expirationTime!,
  };
}

/**
 * Get participant information
 */
export async function getParticipant(
  stageArn: string,
  participantId: string,
  sessionId: string
): Promise<Participant | null> {
  const client = getIVSRealTimeClient();
  
  try {
    const command = new GetParticipantCommand({
      stageArn,
      participantId,
      sessionId,
    });
    const response = await client.send(command);
    return response.participant || null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

/**
 * List participants in a Stage session
 */
export async function listParticipants(
  stageArn: string,
  sessionId: string
): Promise<Participant[]> {
  const client = getIVSRealTimeClient();
  
  const command = new ListParticipantsCommand({
    stageArn,
    sessionId,
  });
  const response = await client.send(command);
  
  return response.participants || [];
}

/**
 * Disconnect a participant from a Stage
 */
export async function disconnectParticipant(
  stageArn: string,
  participantId: string,
  reason?: string
): Promise<void> {
  const client = getIVSRealTimeClient();
  
  const command = new DisconnectParticipantCommand({
    stageArn,
    participantId,
    reason,
  });
  await client.send(command);
}

// ============================================
// STORAGE CONFIGURATION (for S3 recording)
// ============================================

/**
 * Create storage configuration for recording to S3
 */
export async function createStorageConfiguration(
  name: string,
  bucketName: string
): Promise<StorageConfiguration> {
  const client = getIVSRealTimeClient();
  
  const command = new CreateStorageConfigurationCommand({
    name,
    s3: {
      bucketName,
    },
  });
  
  const response = await client.send(command);
  
  if (!response.storageConfiguration) {
    throw new Error('Failed to create storage configuration');
  }
  
  return response.storageConfiguration;
}

/**
 * Get storage configuration
 */
export async function getStorageConfiguration(
  arn: string
): Promise<StorageConfiguration | null> {
  const client = getIVSRealTimeClient();
  
  try {
    const command = new GetStorageConfigurationCommand({ arn });
    const response = await client.send(command);
    return response.storageConfiguration || null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

/**
 * List storage configurations
 */
export async function listStorageConfigurations(): Promise<StorageConfiguration[]> {
  const client = getIVSRealTimeClient();
  
  const command = new ListStorageConfigurationsCommand({});
  const response = await client.send(command);
  
  return response.storageConfigurations || [];
}

/**
 * Delete storage configuration
 */
export async function deleteStorageConfiguration(arn: string): Promise<void> {
  const client = getIVSRealTimeClient();
  
  const command = new DeleteStorageConfigurationCommand({ arn });
  await client.send(command);
}

// ============================================
// COMPOSITION (for HLS output and recording)
// ============================================

/**
 * Start a composition to enable HLS output and/or S3 recording
 * This converts the WebRTC stream to HLS for parent viewing
 */
export async function startComposition(
  config: IVSCompositionConfig
): Promise<Composition> {
  const client = getIVSRealTimeClient();
  
  const destinations = config.destinations.map((dest) => {
    if (dest.s3) {
      return {
        s3: {
          storageConfigurationArn: dest.s3.storageConfigurationArn,
          encoderConfigurationArns: [], // Use default encoding
        },
      };
    }
    if (dest.channel) {
      return {
        channel: {
          channelArn: dest.channel.channelArn,
        },
      };
    }
    throw new Error('Invalid destination configuration');
  });
  
  const command = new StartCompositionCommand({
    stageArn: config.stageArn,
    destinations,
    idempotencyToken: config.idempotencyToken,
  });
  
  const response = await client.send(command);
  
  if (!response.composition) {
    throw new Error('Failed to start composition');
  }
  
  return response.composition;
}

/**
 * Stop an active composition
 */
export async function stopComposition(compositionArn: string): Promise<void> {
  const client = getIVSRealTimeClient();
  
  const command = new StopCompositionCommand({ arn: compositionArn });
  await client.send(command);
}

/**
 * Get composition details
 */
export async function getComposition(
  compositionArn: string
): Promise<Composition | null> {
  const client = getIVSRealTimeClient();
  
  try {
    const command = new GetCompositionCommand({ arn: compositionArn });
    const response = await client.send(command);
    return response.composition || null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

/**
 * List compositions for a Stage
 */
export async function listCompositions(
  filterByStageArn?: string
): Promise<CompositionSummary[]> {
  const client = getIVSRealTimeClient();
  
  const command = new ListCompositionsCommand({
    filterByStageArn,
  });
  const response = await client.send(command);
  
  return response.compositions || [];
}

// ============================================
// HELPERS
// ============================================

function mapStage(stage: Stage): IVSStage {
  return {
    arn: stage.arn!,
    name: stage.name!,
    activeSessionId: stage.activeSessionId,
    tags: stage.tags,
  };
}

// ============================================
// HIGH-LEVEL OPERATIONS
// ============================================

/**
 * Create a streamer token (can publish video/audio)
 */
export async function createStreamerToken(
  stageArn: string,
  userId: string,
  childId: string
): Promise<IVSParticipantTokenResponse> {
  return createParticipantToken({
    stageArn,
    userId,
    capabilities: ['PUBLISH', 'SUBSCRIBE'],
    duration: 720, // 12 hours
    attributes: {
      role: 'streamer',
      childId,
    },
  });
}

/**
 * Create a viewer token (can only subscribe/view)
 */
export async function createViewerToken(
  stageArn: string,
  userId: string
): Promise<IVSParticipantTokenResponse> {
  return createParticipantToken({
    stageArn,
    userId,
    capabilities: ['SUBSCRIBE'],
    duration: 720, // 12 hours
    attributes: {
      role: 'viewer',
    },
  });
}
