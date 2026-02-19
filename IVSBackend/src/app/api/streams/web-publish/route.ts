/**
 * Web Game Publish Endpoint
 * 
 * POST /api/streams/web-publish
 * 
 * Allocates an IVS Real-Time Stage and returns a publish participant token
 * for browser-based games to publish via the IVS Web Broadcast SDK.
 * 
 * Unlike the WHIP endpoint (which returns a WHIP URL for Unity), this
 * returns the raw participant token for use with the IVS Web SDK's
 * Stage constructor directly in the browser.
 * 
 * DELETE /api/streams/web-publish
 * 
 * Stops a web game stream and releases the stage.
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

// ============================================
// TYPES
// ============================================

interface WebPublishStartRequest {
  childId: string;
}

interface WebPublishStartResponse {
  streamId: string;
  stageArn: string;
  publishToken: string;
  participantId: string;
  expiresAt: string;
  region: string;
  viewerUrl: string;
}

interface WebPublishStopRequest {
  streamId: string;
}

// ============================================
// AUTHENTICATION
// ============================================

function extractAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

async function validateAuth(
  request: NextRequest, 
  childId: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const token = extractAuthToken(request);
  
  // Demo token support
  if (token === 'demo-token' && childId === 'demo-child-001') {
    return { valid: true, userId: 'demo-user' };
  }
  
  if (!token) {
    return { valid: false, error: 'Missing authorization token' };
  }
  
  // In production, validate JWT and check child ownership
  return { valid: true, userId: token.substring(0, 20) };
}

// ============================================
// POST - Start Web Publish Stream
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as WebPublishStartRequest;
    
    if (!body.childId) {
      return NextResponse.json(
        { error: 'Missing childId', code: 'INVALID_PARAMS' },
        { status: 400 }
      );
    }
    
    const auth = await validateAuth(request, body.childId);
    if (!auth.valid) {
      return NextResponse.json(
        { error: auth.error, code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const streamId = uuidv4();
    const allocation = await allocateStage(streamId, auth.userId!, body.childId);
    
    console.log(`[WebPublish] Started stream ${streamId} for child ${body.childId}`);
    
    // Build the viewer URL so the SDK can return it to the game developer
    const baseUrl = request.headers.get('x-forwarded-host') 
      || request.headers.get('host') 
      || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const viewerUrl = `${protocol}://${baseUrl}/viewer/${streamId}?auth=demo-viewer-token`;

    dispatchWebhookEvent('stream.started', {
      streamId,
      childId: body.childId,
      stageArn: allocation.stageArn,
      viewerUrl,
    });
    
    const response: WebPublishStartResponse = {
      streamId,
      stageArn: allocation.stageArn,
      publishToken: allocation.publishToken,
      participantId: allocation.participantId,
      expiresAt: allocation.expiresAt.toISOString(),
      region: allocation.region,
      viewerUrl,
    };
    
    return NextResponse.json(response, { 
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, DELETE, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error('[WebPublish] Error starting stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Stop Web Publish Stream
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization token', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const body = await request.json() as WebPublishStopRequest;
    
    if (!body.streamId) {
      return NextResponse.json(
        { error: 'Missing streamId', code: 'INVALID_PARAMS' },
        { status: 400 }
      );
    }
    
    const stage = findStageByStreamId(body.streamId);
    if (!stage) {
      return NextResponse.json(
        { error: 'Stream not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    await releaseStage(stage.arn);
    console.log(`[WebPublish] Stopped stream ${body.streamId}`);

    dispatchWebhookEvent('stream.stopped', {
      streamId: body.streamId,
    });
    
    return NextResponse.json(
      { success: true, streamId: body.streamId },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
    
  } catch (error) {
    console.error('[WebPublish] Error stopping stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Web Publish Status
// ============================================

export async function GET() {
  const poolStatus = getStagePoolStatus();
  
  return NextResponse.json({
    enabled: true,
    poolStatus,
    info: 'Use POST with { childId } to start a web publish stream. ' +
          'Returns a publishToken for use with the IVS Web Broadcast SDK.',
  }, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

// ============================================
// OPTIONS - CORS preflight
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
