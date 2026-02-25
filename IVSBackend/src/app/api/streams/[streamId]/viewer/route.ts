/**
 * Viewer Token Endpoint
 *
 * GET /api/streams/:streamId/viewer
 * POST /api/streams/:streamId/viewer
 *
 * Returns a subscribe token to watch a live stream via IVS Real-Time WebRTC.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSubscribeTokenForStream,
  findStageByStreamId,
} from '@/lib/streaming/stage-pool';
import { dispatchWebhookEvent } from '@/lib/webhooks/webhook-service';
import { requireAuth, type AuthContext } from '@/lib/auth';

// ============================================
// GET - Get Viewer (Subscribe) Token
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const { streamId } = await params;

    const stage = await findStageByStreamId(streamId);
    if (!stage) {
      return NextResponse.json(
        { error: 'Stream not found or not currently live', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (!stage.inUse) {
      return NextResponse.json(
        { error: 'Stream is no longer live', code: 'STREAM_ENDED' },
        { status: 410 },
      );
    }

    const subscription = await createSubscribeTokenForStream(
      stage.arn,
      auth.userId,
      streamId,
    );

    const region = subscription.region;

    dispatchWebhookEvent('viewer.joined', {
      streamId,
      viewerUserId: auth.userId,
      participantId: subscription.participantId,
      orgId: auth.orgId,
    });

    return NextResponse.json({
      streamId,
      stageArn: subscription.stageArn,
      subscribeToken: subscription.subscribeToken,
      participantId: subscription.participantId,
      expiresAt: subscription.expiresAt.toISOString(),
      region,
      viewerConfig: {
        sdkUrl: 'https://web.ivs.rocks/broadcast',
        signalingEndpoint: `wss://global.realtime.ivs.${region}.amazonaws.com`,
      },
    });
  } catch (error) {
    console.error('[Viewer] Error getting viewer token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  return GET(request, { params });
}
