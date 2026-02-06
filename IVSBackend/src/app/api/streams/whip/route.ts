/**
 * WHIP Ingest Provisioning Endpoint
 * 
 * POST /api/streams/whip
 * 
 * Allocates an IVS Real-Time Stage and returns WHIP connection info
 * for Unity to publish WebRTC video directly to IVS.
 * 
 * This is the "no FFmpeg" path - Unity uses standard WebRTC via WHIP protocol.
 * 
 * Reference: https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/rt-stream-ingest.html
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  allocateStage, 
  getStagePoolStatus,
  releaseStage,
  findStageByStreamId,
} from '@/lib/streaming/stage-pool';

// ============================================
// TYPES
// ============================================

interface WhipStartRequest {
  childId: string;
}

interface WhipStartResponse {
  streamId: string;
  stageArn: string;
  whipUrl: string;
  publishToken: string;
  participantId: string;
  expiresAt: string;
  region: string;
  mediaConstraints: {
    videoCodec: string;
    videoProfile: string;
    maxWidth: number;
    maxHeight: number;
    maxFramerate: number;
    maxBitrateBps: number;
    idrIntervalSeconds: number;
    bFrames: boolean;
    audioCodec: string;
    audioMaxBitrateBps: number;
  };
}

interface WhipStopRequest {
  streamId: string;
}

interface WhipStatusResponse {
  enabled: boolean;
  poolStatus: {
    available: number;
    inUse: number;
    total: number;
  };
  whipEndpoint: string;
  region: string;
  mediaConstraints: {
    videoCodec: string;
    videoProfile: string;
    maxResolution: string;
    maxBitrate: string;
    audioCodec: string;
  };
}

// ============================================
// IVS MEDIA CONSTRAINTS
// Per https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/rt-stream-ingest.html
// ============================================

const IVS_MEDIA_CONSTRAINTS = {
  videoCodec: 'H.264',
  videoProfile: 'baseline',   // IVS requires Baseline profile
  maxWidth: 1280,             // 720p max
  maxHeight: 720,
  maxFramerate: 30,           // Recommend 30fps for stability
  maxBitrateBps: 2500000,     // 2.5 Mbps recommended for WHIP
  idrIntervalSeconds: 2,      // IDR every 2 seconds required
  bFrames: false,             // B-frames MUST be disabled or IVS disconnects
  audioCodec: 'opus',         // WHIP uses Opus audio
  audioMaxBitrateBps: 160000, // 160 Kbps max
};

const WHIP_GLOBAL_ENDPOINT = 'https://global.whip.live-video.net';

// ============================================
// AUTHENTICATION HELPER
// ============================================

function extractAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

async function validateAuth(request: NextRequest, childId: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const token = extractAuthToken(request);
  
  // Demo token support
  if (token === 'demo-token' && childId === 'demo-child-001') {
    return { valid: true, userId: 'demo-user' };
  }
  
  if (!token) {
    return { valid: false, error: 'Missing authorization token' };
  }
  
  // In production, validate JWT and check child ownership
  // For now, accept any token for non-demo requests
  return { valid: true, userId: token.substring(0, 20) };
}

// ============================================
// POST - Start WHIP Stream
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as WhipStartRequest;
    
    // Validate required fields
    if (!body.childId) {
      return NextResponse.json(
        { error: 'Missing childId', code: 'INVALID_PARAMS' },
        { status: 400 }
      );
    }
    
    // Validate authentication
    const auth = await validateAuth(request, body.childId);
    if (!auth.valid) {
      return NextResponse.json(
        { error: auth.error, code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // Generate stream ID
    const streamId = uuidv4();
    
    // Allocate a stage from the pool
    const allocation = await allocateStage(streamId, auth.userId!, body.childId);
    
    // Note: Stream tracking is handled by the stage pool
    // In production, you would also persist to database here
    
    console.log(`[WHIP] Started stream ${streamId} for child ${body.childId}`);
    
    const response: WhipStartResponse = {
      streamId,
      stageArn: allocation.stageArn,
      whipUrl: allocation.whipUrl,
      publishToken: allocation.publishToken,
      participantId: allocation.participantId,
      expiresAt: allocation.expiresAt.toISOString(),
      region: allocation.region,
      mediaConstraints: IVS_MEDIA_CONSTRAINTS,
    };
    
    return NextResponse.json(response, { status: 201 });
    
  } catch (error) {
    console.error('[WHIP] Error starting stream:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Stop WHIP Stream
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization token', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const body = await request.json() as WhipStopRequest;
    
    if (!body.streamId) {
      return NextResponse.json(
        { error: 'Missing streamId', code: 'INVALID_PARAMS' },
        { status: 400 }
      );
    }
    
    // Find the stage by stream ID in our pool (static import)
    const stage = findStageByStreamId(body.streamId);
    
    if (!stage) {
      return NextResponse.json(
        { error: 'Stream not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    // Release the stage back to the pool
    await releaseStage(stage.arn);
    
    console.log(`[WHIP] Stopped stream ${body.streamId}`);
    
    return NextResponse.json({ success: true, streamId: body.streamId });
    
  } catch (error) {
    console.error('[WHIP] Error stopping stream:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET - WHIP Status and Pool Info
// ============================================

export async function GET() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const poolStatus = getStagePoolStatus();
  
  const response: WhipStatusResponse = {
    enabled: true,
    poolStatus,
    whipEndpoint: WHIP_GLOBAL_ENDPOINT,
    region,
    mediaConstraints: {
      videoCodec: 'H.264 Baseline',
      videoProfile: 'baseline',
      maxResolution: '720p (1280x720)',
      maxBitrate: '2.5 Mbps',
      audioCodec: 'Opus',
    },
  };
  
  return NextResponse.json(response);
}
