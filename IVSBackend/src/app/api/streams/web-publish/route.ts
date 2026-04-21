/**
 * Web Game Publish Endpoint
 *
 * POST /api/streams/web-publish   — Start a stream
 * DELETE /api/streams/web-publish  — Stop a stream
 * GET /api/streams/web-publish     — Pool status
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  allocateStage,
  getStagePoolStatus,
  releaseStage,
  findStageByStreamId,
} from '@/lib/streaming/stage-pool';
import { dispatchWebhookEvent } from '@/lib/webhooks/webhook-service';
import { requireAuth, requireScopes, type AuthContext } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ============================================
// POST - Start Web Publish Stream
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

    // Platform segmentation: "web" | "ios" | "android" | "unity" | "unity-quest" | null
    // SDKs send this via the `platform` body field and/or the `X-Substream-SDK`
    // header (e.g. "ios/1.0.0"). Unknown/missing values are treated as "web".
    const sdkHeader = request.headers.get('x-substream-sdk') || '';
    const [headerPlatform, headerVersion] = sdkHeader.includes('/')
      ? sdkHeader.split('/', 2)
      : [sdkHeader, ''];
    const platform: string =
      (typeof body.platform === 'string' && body.platform.trim()) ||
      headerPlatform ||
      'web';
    const sdkVersion: string | null =
      (typeof body.sdkVersion === 'string' && body.sdkVersion.trim()) ||
      headerVersion ||
      null;

    const streamId = uuidv4();
    const allocation = await allocateStage(streamId, auth.userId, streamerId);

    const baseUrl =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const viewerUrl = `${protocol}://${baseUrl}/viewer/${streamId}`;

    // Create a Stream record if an org exists for this auth context
    const orgId = body.orgId || auth.orgId;
    try {
      const org = await prisma.organization.findFirst({
        where: { id: orgId },
      });
      if (org) {
        await prisma.stream.create({
          data: {
            id: streamId,
            orgId: org.id,
            streamerId,
            streamerName: body.streamerName || null,
            title: body.title || null,
            status: 'LIVE',
            ivsStageArn: allocation.stageArn,
            startedAt: new Date(),
            platform,
            sdkVersion,
          },
        });
      }
    } catch {
      // Non-critical: stream works even without the org record
    }

    dispatchWebhookEvent('stream.started', {
      streamId,
      streamerId,
      stageArn: allocation.stageArn,
      viewerUrl,
      orgId,
      platform,
      sdkVersion,
    });

    return NextResponse.json(
      {
        streamId,
        stageArn: allocation.stageArn,
        publishToken: allocation.publishToken,
        participantId: allocation.participantId,
        expiresAt: allocation.expiresAt.toISOString(),
        region: allocation.region,
        viewerUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[WebPublish] Error starting stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE - Stop Web Publish Stream
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

    // Update Stream record to ENDED
    const now = new Date();
    try {
      const existingStream = await prisma.stream.findUnique({
        where: { id: body.streamId },
      });
      if (existingStream) {
        const durationSecs = existingStream.startedAt
          ? Math.floor((now.getTime() - existingStream.startedAt.getTime()) / 1000)
          : null;

        // Construct likely S3 recording path from the IVS stage ARN
        const bucket = process.env.S3_RECORDING_BUCKET;
        const recordingUrl = bucket && existingStream.ivsStageArn
          ? `s3://${bucket}/ivs/v1/${existingStream.ivsStageArn.split(':').pop()}/${body.streamId}/`
          : null;

        await prisma.stream.update({
          where: { id: body.streamId },
          data: {
            status: recordingUrl ? 'RECORDED' : 'ENDED',
            endedAt: now,
            durationSecs,
            recordingUrl,
          },
        });
      }
    } catch {
      // Non-critical
    }

    dispatchWebhookEvent('stream.stopped', { streamId: body.streamId });

    return NextResponse.json({ success: true, streamId: body.streamId });
  } catch (error) {
    console.error('[WebPublish] Error stopping stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ============================================
// GET - Web Publish Status
// ============================================

export async function GET() {
  const poolStatus = await getStagePoolStatus();
  return NextResponse.json({
    enabled: true,
    poolStatus,
    info: 'POST with { streamerId } to start a stream. Returns a publishToken for the IVS Web Broadcast SDK.',
  });
}

// ============================================
// OPTIONS - CORS preflight
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
