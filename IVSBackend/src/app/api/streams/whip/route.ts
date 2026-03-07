/**
 * WHIP Ingest Provisioning Endpoint
 *
 * POST /api/streams/whip   — Start WHIP stream (Unity WebRTC)
 * DELETE /api/streams/whip  — Stop WHIP stream
 * GET /api/streams/whip     — Status and pool info
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  allocateStage,
  getStagePoolStatus,
  releaseStage,
  findStageByStreamId,
} from '@/lib/streaming/stage-pool';
import { requireAuth, requireScopes, type AuthContext } from '@/lib/auth';

const IVS_MEDIA_CONSTRAINTS = {
  videoCodec: 'H.264',
  videoProfile: 'baseline',
  maxWidth: 1280,
  maxHeight: 720,
  maxFramerate: 30,
  maxBitrateBps: 2500000,
  idrIntervalSeconds: 2,
  bFrames: false,
  audioCodec: 'opus',
  audioMaxBitrateBps: 160000,
};

const WHIP_GLOBAL_ENDPOINT = 'https://global.whip.live-video.net';

// ============================================
// POST - Start WHIP Stream
// ============================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const scopeErr = requireScopes(auth, ['streams:write']);
    if (scopeErr) return scopeErr;

    const body = await request.json();
    const streamerId: string | undefined = body.streamerId || body.childId;

    if (!streamerId) {
      return NextResponse.json(
        { error: 'Missing streamerId (or childId)', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const streamId = uuidv4();
    const allocation = await allocateStage(streamId, auth.userId, streamerId);

    return NextResponse.json(
      {
        streamId,
        stageArn: allocation.stageArn,
        whipUrl: allocation.whipUrl,
        publishToken: allocation.publishToken,
        participantId: allocation.participantId,
        expiresAt: allocation.expiresAt.toISOString(),
        region: allocation.region,
        mediaConstraints: IVS_MEDIA_CONSTRAINTS,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[WHIP] Error starting stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE - Stop WHIP Stream
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    if (!body.streamId) {
      return NextResponse.json(
        { error: 'Missing streamId', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const stage = await findStageByStreamId(body.streamId);
    if (!stage) {
      return NextResponse.json(
        { error: 'Stream not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    await releaseStage(stage.arn);
    return NextResponse.json({ success: true, streamId: body.streamId });
  } catch (error) {
    console.error('[WHIP] Error stopping stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ============================================
// GET - WHIP Status and Pool Info
// ============================================

export async function GET() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const poolStatus = await getStagePoolStatus();
  return NextResponse.json({
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
  });
}
