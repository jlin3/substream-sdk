/**
 * IVS Real-Time Stream Service
 * Core business logic for IVS Real-Time (WebRTC) streaming operations
 * 
 * This service handles WebRTC streaming via IVS Real-Time Stages,
 * which outputs HLS for parent viewing.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createStage,
  getStage,
  listStages,
  createStreamerToken,
  createViewerToken,
  startComposition,
  stopComposition,
  getComposition,
  listCompositions,
  type IVSStage,
  type IVSParticipantTokenResponse,
} from './ivs-realtime-client';
import {
  type StreamSessionInfo,
  StreamingError,
  StreamingErrorCode,
} from './types';
import { prisma } from '../prisma';

// ============================================
// TYPES
// ============================================

export interface RealTimeIngestResponse {
  stageArn: string;
  participantToken: string;
  participantId: string;
  expirationTime: string;
  webrtcUrl: string;
}

export interface RealTimePlaybackResponse {
  childId: string;
  stageArn: string;
  playback: {
    /** HLS URL for viewing */
    hlsUrl: string | null;
    /** Participant token for WebRTC viewing (alternative to HLS) */
    viewerToken: string | null;
    viewerParticipantId: string | null;
    expiresAt: string;
  };
  status: {
    isLive: boolean;
    currentSessionId: string | null;
    lastLiveAt: string | null;
    participantCount: number;
  };
}

// ============================================
// STAGE LIFECYCLE
// ============================================

/**
 * Ensures a Real-Time Stage exists for a child
 * Creates one if it doesn't exist
 */
export async function ensureStageForChild(childId: string): Promise<{
  stageId: string;
  stageArn: string;
}> {
  // Check if stage already exists in database
  const existingChannel = await prisma.childStreamChannel.findUnique({
    where: { childId },
  });

  if (existingChannel?.ivsStageArn) {
    // Verify the stage still exists in AWS
    const stage = await getStage(existingChannel.ivsStageArn);
    if (stage) {
      return {
        stageId: existingChannel.id,
        stageArn: existingChannel.ivsStageArn,
      };
    }
    // Stage was deleted in AWS, need to recreate
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

  // Check if we should use the default demo stage
  const defaultStageArn = process.env.IVS_STAGE_ARN;
  if (defaultStageArn) {
    // Use the configured stage for all streaming
    // This is simpler and avoids per-child stage creation
    const stage = await getStage(defaultStageArn);
    if (!stage) {
      throw new StreamingError(
        'Configured IVS_STAGE_ARN not found. Run pnpm ivs:setup to create resources.',
        StreamingErrorCode.CHANNEL_NOT_FOUND,
        500
      );
    }

    // Create or update database record
    if (existingChannel) {
      await prisma.childStreamChannel.update({
        where: { id: existingChannel.id },
        data: { ivsStageArn: defaultStageArn },
      });
      return {
        stageId: existingChannel.id,
        stageArn: defaultStageArn,
      };
    }

    const dbChannel = await prisma.childStreamChannel.create({
      data: {
        id: uuidv4(),
        childId,
        ivsStageArn: defaultStageArn,
        // IVS Low-Latency fields (can be empty for Real-Time only)
        ivsChannelArn: '',
        ivsChannelName: `rt-${childId}`,
        ivsPlaybackUrl: '',
        ivsIngestEndpoint: '',
        ivsStreamKeyArn: '',
        ivsStreamKeyValue: '',
        status: 'INACTIVE',
      },
    });

    return {
      stageId: dbChannel.id,
      stageArn: defaultStageArn,
    };
  }

  // Create a new stage per child (more isolated but more expensive)
  const stageName = `child-${childId}-${Date.now()}`;
  
  const ivsStage = await createStage({
    name: stageName,
    tags: {
      childId,
      environment: process.env.NODE_ENV || 'development',
    },
  });

  // Store in database
  if (existingChannel) {
    await prisma.childStreamChannel.update({
      where: { id: existingChannel.id },
      data: { ivsStageArn: ivsStage.arn },
    });
    return {
      stageId: existingChannel.id,
      stageArn: ivsStage.arn,
    };
  }

  const dbChannel = await prisma.childStreamChannel.create({
    data: {
      id: uuidv4(),
      childId,
      ivsStageArn: ivsStage.arn,
      ivsChannelArn: '',
      ivsChannelName: stageName,
      ivsPlaybackUrl: '',
      ivsIngestEndpoint: '',
      ivsStreamKeyArn: '',
      ivsStreamKeyValue: '',
      status: 'INACTIVE',
    },
  });

  // Audit log
  await prisma.streamingAuditLog.create({
    data: {
      action: 'stage.created',
      resourceType: 'stage',
      resourceId: dbChannel.id,
      userId: childProfile.userId,
      details: {
        stageArn: ivsStage.arn,
        stageName,
      },
    },
  });

  return {
    stageId: dbChannel.id,
    stageArn: ivsStage.arn,
  };
}

// ============================================
// INGEST (FOR UNITY/CHILD)
// ============================================

/**
 * Gets WebRTC ingest credentials for a child's Unity game
 * This replaces RTMPS ingest with WebRTC
 */
export async function getRealTimeIngestProvisioning(
  childId: string,
  requestingUserId: string
): Promise<RealTimeIngestResponse> {
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

  // Ensure stage exists
  const { stageArn } = await ensureStageForChild(childId);

  // Create participant token for streaming
  const tokenResponse = await createStreamerToken(stageArn, requestingUserId, childId);

  // Get the WebRTC URL (derived from stage ARN)
  // Format: wss://global.realtime.ivs.aws/
  const region = process.env.AWS_REGION || 'us-east-1';
  const webrtcUrl = `wss://global.realtime.ivs.${region}.amazonaws.com`;

  return {
    stageArn,
    participantToken: tokenResponse.token,
    participantId: tokenResponse.participantId,
    expirationTime: tokenResponse.expirationTime.toISOString(),
    webrtcUrl,
  };
}

// ============================================
// PLAYBACK (FOR PARENTS)
// ============================================

/**
 * Gets playback info for a parent watching their child via HLS or WebRTC
 */
export async function getRealTimePlaybackForParent(
  parentUserId: string,
  childId: string
): Promise<RealTimePlaybackResponse> {
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

  // Get or create stage
  const { stageArn } = await ensureStageForChild(childId);

  // Get channel/session status from database
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

  // Check if stage has active participants
  const stage = await getStage(stageArn);
  const isLive = !!stage?.activeSessionId;

  // Get HLS URL if composition is running
  let hlsUrl: string | null = null;
  const compositions = await listCompositions(stageArn);
  const activeComposition = compositions.find(c => c.state === 'ACTIVE');
  
  if (activeComposition) {
    // The HLS URL comes from the composition's channel destination
    // For now, use the IVS channel if configured
    const channelArn = process.env.IVS_CHANNEL_ARN;
    if (channelArn) {
      // The HLS URL format for IVS channels
      const channelId = channelArn.split('/').pop();
      const region = process.env.AWS_REGION || 'us-east-1';
      hlsUrl = `https://${channelId}.${region}.playback.live-video.net/api/video/v1/us-east-1.${process.env.AWS_ACCOUNT_ID}.channel.${channelId}.m3u8`;
    }
  }

  // Create viewer token for WebRTC viewing (alternative to HLS)
  let viewerToken: string | null = null;
  let viewerParticipantId: string | null = null;

  try {
    const tokenResponse = await createViewerToken(stageArn, parentUserId);
    viewerToken = tokenResponse.token;
    viewerParticipantId = tokenResponse.participantId;
  } catch (error) {
    console.warn('[RealTime] Could not create viewer token:', error);
  }

  return {
    childId,
    stageArn,
    playback: {
      hlsUrl,
      viewerToken,
      viewerParticipantId,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
    },
    status: {
      isLive,
      currentSessionId: channel?.sessions[0]?.id ?? null,
      lastLiveAt: channel?.lastLiveAt?.toISOString() ?? null,
      participantCount: 0, // Would need to list participants to get this
    },
  };
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Creates a new streaming session for Real-Time
 * Called by Unity before starting WebRTC connection
 */
export async function createRealTimeSession(
  childId: string,
  requestingUserId: string
): Promise<{ sessionId: string; stageArn: string; participantToken: string }> {
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

  // Ensure stage exists
  const { stageId, stageArn } = await ensureStageForChild(childId);

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
    // Check if the stage has any active participants
    const stage = await getStage(stageArn);
    const isActuallyLive = !!stage?.activeSessionId;

    if (!isActuallyLive) {
      // Session exists but no one is streaming - end it to allow restart
      console.log(`[RealTime] Ending inactive session ${activeSession.id} to allow restart`);
      await prisma.childStreamSession.update({
        where: { id: activeSession.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      });
      await prisma.childStreamChannel.update({
        where: { id: channel.id },
        data: { status: 'INACTIVE' },
      });
    } else {
      throw new StreamingError(
        'A session is already active',
        StreamingErrorCode.SESSION_ALREADY_ACTIVE,
        409
      );
    }
  }

  // Create participant token
  const tokenResponse = await createStreamerToken(stageArn, requestingUserId, childId);

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

  // Start composition for HLS output (if configured)
  const storageArn = process.env.IVS_STORAGE_ARN;
  const channelArn = process.env.IVS_CHANNEL_ARN;
  
  if (storageArn || channelArn) {
    try {
      const destinations: Array<{
        s3?: { storageConfigurationArn: string };
        channel?: { channelArn: string };
      }> = [];
      
      if (storageArn) {
        destinations.push({ s3: { storageConfigurationArn: storageArn } });
      }
      if (channelArn) {
        destinations.push({ channel: { channelArn } });
      }
      
      await startComposition({
        stageArn,
        destinations,
        idempotencyToken: session.id,
      });
      console.log('[RealTime] Started composition for HLS/recording');
    } catch (error) {
      console.warn('[RealTime] Could not start composition:', error);
      // Non-fatal - WebRTC viewing still works
    }
  }

  // Audit log
  await prisma.streamingAuditLog.create({
    data: {
      action: 'realtime_session.started',
      resourceType: 'session',
      resourceId: session.id,
      userId: requestingUserId,
      details: {
        channelId: channel.id,
        childId,
        stageArn,
      },
    },
  });

  return {
    sessionId: session.id,
    stageArn,
    participantToken: tokenResponse.token,
  };
}

/**
 * Ends a Real-Time streaming session
 */
export async function endRealTimeSession(
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

  // Stop composition if running
  if (session.channel.ivsStageArn) {
    try {
      const compositions = await listCompositions(session.channel.ivsStageArn);
      for (const comp of compositions) {
        if (comp.state === 'ACTIVE' && comp.arn) {
          await stopComposition(comp.arn);
          console.log('[RealTime] Stopped composition');
        }
      }
    } catch (error) {
      console.warn('[RealTime] Could not stop composition:', error);
    }
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
      action: 'realtime_session.ended',
      resourceType: 'session',
      resourceId: sessionId,
      userId: requestingUserId,
    },
  });
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if IVS Real-Time is properly configured
 */
export async function checkRealTimeHealth(): Promise<{
  configured: boolean;
  stageArn: string | null;
  channelArn: string | null;
  storageArn: string | null;
}> {
  const stageArn = process.env.IVS_STAGE_ARN || null;
  const channelArn = process.env.IVS_CHANNEL_ARN || null;
  const storageArn = process.env.IVS_STORAGE_ARN || null;

  // Verify stage exists
  let stageExists = false;
  if (stageArn) {
    try {
      const stage = await getStage(stageArn);
      stageExists = !!stage;
    } catch (error) {
      console.warn('[RealTime] Stage check failed:', error);
    }
  }

  return {
    configured: !!stageArn && stageExists,
    stageArn: stageExists ? stageArn : null,
    channelArn,
    storageArn,
  };
}
