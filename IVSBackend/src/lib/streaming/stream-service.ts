/**
 * Stream Service
 * Core business logic for IVS streaming operations
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createChannel,
  createStreamKey,
  listStreamKeys,
  getStream,
  stopStream,
} from './ivs-client';
import {
  type IngestProvisioningResponse,
  type PlaybackResponse,
  type StreamSessionInfo,
  RECOMMENDED_ENCODER_CONFIG,
  StreamingError,
  StreamingErrorCode,
} from './types';
import { generatePlaybackToken } from './playback-auth';
import { encryptStreamKey, decryptStreamKey, isEncrypted } from './encryption';
import { prisma } from '../prisma';

// ============================================
// CHANNEL LIFECYCLE
// ============================================

/**
 * Ensures a streaming channel exists for a child
 * Creates one if it doesn't exist
 */
export async function ensureChannelForChild(childId: string): Promise<{
  channelId: string;
  channelArn: string;
  playbackUrl: string;
  ingestEndpoint: string;
}> {
  // Check if channel already exists
  const existingChannel = await prisma.childStreamChannel.findUnique({
    where: { childId },
  });

  if (existingChannel) {
    return {
      channelId: existingChannel.id,
      channelArn: existingChannel.ivsChannelArn,
      playbackUrl: existingChannel.ivsPlaybackUrl,
      ingestEndpoint: existingChannel.ivsIngestEndpoint,
    };
  }

  // Get child profile for naming
  const childProfile = await prisma.childProfile.findUnique({
    where: { id: childId },
    include: { user: true },
  });

  if (!childProfile) {
    throw new StreamingError(
      'Child profile not found',
      StreamingErrorCode.UNAUTHORIZED,
      404
    );
  }

  // Create IVS channel
  const channelName = `child-${childId}-${Date.now()}`;
  const recordingConfigArn = process.env.IVS_RECORDING_CONFIG_ARN;

  const ivsChannel = await createChannel({
    name: channelName,
    latencyMode: 'LOW',
    type: 'STANDARD',
    recordingConfigurationArn: recordingConfigArn,
    authorized: true, // Enable playback authorization
    tags: {
      childId,
      environment: process.env.NODE_ENV || 'development',
    },
  });

  // Get or create stream key
  let streamKey;
  try {
    // First check if any stream keys already exist for this channel
    const existingKeys = await listStreamKeys(ivsChannel.arn);
    if (existingKeys.length > 0) {
      streamKey = existingKeys[0];
    } else {
      // Create new stream key
      streamKey = await createStreamKey(ivsChannel.arn);
    }
  } catch (error) {
    // If stream key creation fails due to quota, try to list and use existing
    console.error('Stream key creation error, checking for existing keys:', error);
    const existingKeys = await listStreamKeys(ivsChannel.arn);
    if (existingKeys.length > 0) {
      streamKey = existingKeys[0];
    } else {
      throw error; // Re-throw if we can't find any existing keys
    }
  }

  // Store in database
  const dbChannel = await prisma.childStreamChannel.create({
    data: {
      id: uuidv4(),
      childId,
      ivsChannelArn: ivsChannel.arn,
      ivsChannelName: ivsChannel.name,
      ivsPlaybackUrl: ivsChannel.playbackUrl,
      ivsIngestEndpoint: ivsChannel.ingestEndpoint,
      ivsStreamKeyArn: streamKey.arn,
      ivsStreamKeyValue: encryptStreamKey(streamKey.value), // Encrypted for security
      ivsRecordingConfigArn: recordingConfigArn,
      status: 'INACTIVE',
    },
  });

  // Audit log
  await prisma.streamingAuditLog.create({
    data: {
      action: 'channel.created',
      resourceType: 'channel',
      resourceId: dbChannel.id,
      userId: childProfile.userId,
      details: {
        channelArn: ivsChannel.arn,
        channelName: ivsChannel.name,
      },
    },
  });

  return {
    channelId: dbChannel.id,
    channelArn: ivsChannel.arn,
    playbackUrl: ivsChannel.playbackUrl,
    ingestEndpoint: ivsChannel.ingestEndpoint,
  };
}

/**
 * Gets ingest provisioning info for a child's stream SDK
 */
export async function getIngestProvisioning(
  childId: string,
  requestingUserId: string
): Promise<IngestProvisioningResponse> {
  // Verify the requesting user is the child
  const childProfile = await prisma.childProfile.findFirst({
    where: {
      id: childId,
      userId: requestingUserId,
    },
  });

  if (!childProfile) {
    throw new StreamingError(
      'Not authorized to access this channel',
      StreamingErrorCode.FORBIDDEN,
      403
    );
  }

  // Check if streaming is enabled for this child
  if (!childProfile.streamingEnabled) {
    throw new StreamingError(
      'Streaming is disabled for this account',
      StreamingErrorCode.FORBIDDEN,
      403
    );
  }

  // Ensure channel exists
  const { channelArn, ingestEndpoint } = await ensureChannelForChild(childId);

  // Get stream key
  const channel = await prisma.childStreamChannel.findUnique({
    where: { childId },
  });

  if (!channel || !channel.ivsStreamKeyValue) {
    throw new StreamingError(
      'Channel not properly configured',
      StreamingErrorCode.CHANNEL_NOT_FOUND,
      500
    );
  }

  // Decrypt the stream key (handles both encrypted and legacy plaintext keys)
  const streamKeyValue = isEncrypted(channel.ivsStreamKeyValue)
    ? decryptStreamKey(channel.ivsStreamKeyValue)
    : channel.ivsStreamKeyValue;

  return {
    channelArn,
    ingest: {
      protocol: 'rtmps',
      endpoint: `rtmps://${ingestEndpoint}:443/app/`,
      streamKey: streamKeyValue,
    },
    recommendedEncoderConfig: RECOMMENDED_ENCODER_CONFIG,
  };
}

// ============================================
// PLAYBACK
// ============================================

/**
 * Gets playback info for a parent watching their child
 */
export async function getPlaybackForParent(
  parentUserId: string,
  childId: string
): Promise<PlaybackResponse> {
  // Verify parent-child relationship
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: parentUserId },
  });

  if (!parentProfile) {
    throw new StreamingError(
      'Parent profile not found',
      StreamingErrorCode.UNAUTHORIZED,
      401
    );
  }

  const relationship = await prisma.parentChildRelation.findFirst({
    where: {
      parentId: parentProfile.id,
      childId,
      canWatch: true,
    },
  });

  if (!relationship) {
    throw new StreamingError(
      'Not authorized to watch this child',
      StreamingErrorCode.PARENT_NOT_LINKED,
      403
    );
  }

  // Get or create channel
  const { channelArn, playbackUrl } = await ensureChannelForChild(childId);

  // Get channel status
  const channel = await prisma.childStreamChannel.findUnique({
    where: { childId },
    include: {
      sessions: {
        where: { status: 'IN_PROGRESS' },
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  });

  // Check live status from IVS
  const ivsStream = await getStream(channelArn);
  const isLive = ivsStream?.state === 'LIVE';

  // Generate playback token
  const token = await generatePlaybackToken({
    channelArn,
    viewerId: parentUserId,
    ttlSeconds: 3600, // 1 hour
  });

  return {
    childId,
    channelArn,
    playback: {
      url: playbackUrl,
      token,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    },
    status: {
      isLive,
      currentSessionId: channel?.sessions[0]?.id ?? null,
      lastLiveAt: channel?.lastLiveAt?.toISOString() ?? null,
    },
  };
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Creates a new streaming session
 * Called by Stream SDK before starting to push RTMPS
 */
export async function createStreamSession(
  childId: string,
  requestingUserId: string
): Promise<{ sessionId: string }> {
  // Verify child
  const childProfile = await prisma.childProfile.findFirst({
    where: {
      id: childId,
      userId: requestingUserId,
    },
  });

  if (!childProfile) {
    throw new StreamingError(
      'Not authorized',
      StreamingErrorCode.FORBIDDEN,
      403
    );
  }

  // Get channel
  const channel = await prisma.childStreamChannel.findUnique({
    where: { childId },
  });

  if (!channel) {
    throw new StreamingError(
      'Channel not found. Call ingest provisioning first.',
      StreamingErrorCode.CHANNEL_NOT_FOUND,
      404
    );
  }

  // Check for existing active session
  const activeSession = await prisma.childStreamSession.findFirst({
    where: {
      channelId: channel.id,
      status: 'IN_PROGRESS',
    },
  });

  if (activeSession) {
    throw new StreamingError(
      'A session is already active',
      StreamingErrorCode.SESSION_ALREADY_ACTIVE,
      409
    );
  }

  // Create session
  const session = await prisma.childStreamSession.create({
    data: {
      id: uuidv4(),
      channelId: channel.id,
      childId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  });

  // Update channel status
  await prisma.childStreamChannel.update({
    where: { id: channel.id },
    data: { status: 'LIVE' },
  });

  // Audit log
  await prisma.streamingAuditLog.create({
    data: {
      action: 'session.started',
      resourceType: 'session',
      resourceId: session.id,
      userId: requestingUserId,
      details: {
        channelId: channel.id,
        childId,
      },
    },
  });

  return { sessionId: session.id };
}

/**
 * Ends a streaming session
 */
export async function endStreamSession(
  sessionId: string,
  requestingUserId: string
): Promise<void> {
  const session = await prisma.childStreamSession.findUnique({
    where: { id: sessionId },
    include: { channel: true },
  });

  if (!session) {
    throw new StreamingError(
      'Session not found',
      StreamingErrorCode.SESSION_NOT_FOUND,
      404
    );
  }

  // Verify ownership
  const childProfile = await prisma.childProfile.findFirst({
    where: {
      id: session.childId,
      userId: requestingUserId,
    },
  });

  if (!childProfile) {
    throw new StreamingError(
      'Not authorized',
      StreamingErrorCode.FORBIDDEN,
      403
    );
  }

  // Update session
  await prisma.childStreamSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
    },
  });

  // Update channel status
  await prisma.childStreamChannel.update({
    where: { id: session.channelId },
    data: {
      status: 'INACTIVE',
      lastLiveAt: new Date(),
    },
  });

  // Audit log
  await prisma.streamingAuditLog.create({
    data: {
      action: 'session.ended',
      resourceType: 'session',
      resourceId: sessionId,
      userId: requestingUserId,
    },
  });
}

/**
 * Gets session info
 */
export async function getSessionInfo(
  sessionId: string
): Promise<StreamSessionInfo | null> {
  const session = await prisma.childStreamSession.findUnique({
    where: { id: sessionId },
    include: { channel: true },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    channelArn: session.channel.ivsChannelArn,
    childId: session.childId,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    status: session.status.toLowerCase() as StreamSessionInfo['status'],
    metrics: {
      maxViewers: session.maxViewers,
      avgBitrateKbps: session.avgBitrateKbps,
      totalWatchMinutes: session.totalWatchMinutes,
    },
    vod: session.vodMasterUrl
      ? {
          masterUrl: session.vodMasterUrl,
          thumbnailUrl: session.vodThumbnailUrl,
          durationSeconds: session.vodDurationSeconds,
        }
      : null,
  };
}

// ============================================
// VOD
// ============================================

/**
 * Gets VOD list for a child
 */
export async function getVODsForChild(
  parentUserId: string,
  childId: string,
  limit: number = 20,
  cursor?: string
): Promise<{
  sessions: StreamSessionInfo[];
  nextCursor: string | null;
}> {
  // Verify parent-child relationship
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: parentUserId },
  });

  if (!parentProfile) {
    throw new StreamingError(
      'Parent profile not found',
      StreamingErrorCode.UNAUTHORIZED,
      401
    );
  }

  const relationship = await prisma.parentChildRelation.findFirst({
    where: {
      parentId: parentProfile.id,
      childId,
      canViewVods: true,
    },
  });

  if (!relationship) {
    throw new StreamingError(
      'Not authorized to view VODs for this child',
      StreamingErrorCode.PARENT_NOT_LINKED,
      403
    );
  }

  // Get sessions with VODs
  const sessions = await prisma.childStreamSession.findMany({
    where: {
      childId,
      status: 'COMPLETED',
      vodMasterUrl: { not: null },
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: { channel: true },
    orderBy: { startedAt: 'desc' },
    take: limit + 1, // Fetch one extra to determine if there are more
  });

  const hasMore = sessions.length > limit;
  const returnSessions = hasMore ? sessions.slice(0, -1) : sessions;

  return {
    sessions: returnSessions.map((session: typeof sessions[number]) => ({
      id: session.id,
      channelArn: session.channel.ivsChannelArn,
      childId: session.childId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      status: 'completed' as const,
      metrics: {
        maxViewers: session.maxViewers,
        avgBitrateKbps: session.avgBitrateKbps,
        totalWatchMinutes: session.totalWatchMinutes,
      },
      vod: {
        masterUrl: session.vodMasterUrl!,
        thumbnailUrl: session.vodThumbnailUrl,
        durationSeconds: session.vodDurationSeconds,
      },
    })),
    nextCursor: hasMore ? returnSessions[returnSessions.length - 1].id : null,
  };
}

// ============================================
// ADMIN OPERATIONS
// ============================================

/**
 * Force stop a stream (admin only)
 */
export async function forceStopStream(
  channelId: string,
  adminUserId: string
): Promise<void> {
  const channel = await prisma.childStreamChannel.findUnique({
    where: { id: channelId },
  });

  if (!channel) {
    throw new StreamingError(
      'Channel not found',
      StreamingErrorCode.CHANNEL_NOT_FOUND,
      404
    );
  }

  // Stop the IVS stream
  await stopStream(channel.ivsChannelArn);

  // Update active sessions
  await prisma.childStreamSession.updateMany({
    where: {
      channelId: channel.id,
      status: 'IN_PROGRESS',
    },
    data: {
      status: 'FAILED',
      endedAt: new Date(),
      errorMessage: 'Stream forcibly stopped by admin',
    },
  });

  // Update channel
  await prisma.childStreamChannel.update({
    where: { id: channelId },
    data: { status: 'INACTIVE' },
  });

  // Audit log
  await prisma.streamingAuditLog.create({
    data: {
      action: 'stream.force_stopped',
      resourceType: 'channel',
      resourceId: channelId,
      userId: adminUserId,
    },
  });
}

/**
 * Reset channel (create new stream key)
 */
export async function resetChannel(
  channelId: string,
  adminUserId: string
): Promise<{ newStreamKey: string }> {
  const channel = await prisma.childStreamChannel.findUnique({
    where: { id: channelId },
  });

  if (!channel) {
    throw new StreamingError(
      'Channel not found',
      StreamingErrorCode.CHANNEL_NOT_FOUND,
      404
    );
  }

  // Create new stream key
  const newKey = await createStreamKey(channel.ivsChannelArn);

  // Update database (encrypt the new key)
  await prisma.childStreamChannel.update({
    where: { id: channelId },
    data: {
      ivsStreamKeyArn: newKey.arn,
      ivsStreamKeyValue: encryptStreamKey(newKey.value),
    },
  });

  // Audit log
  await prisma.streamingAuditLog.create({
    data: {
      action: 'channel.key_reset',
      resourceType: 'channel',
      resourceId: channelId,
      userId: adminUserId,
    },
  });

  return { newStreamKey: newKey.value };
}
