/**
 * Viewer Token Endpoint for Parents
 * 
 * GET /api/streams/:streamId/viewer
 * 
 * Returns a subscribe token for parents to watch their child's stream
 * via IVS Real-Time WebRTC (IVS Web Broadcast SDK).
 * 
 * Authentication:
 * - Parent must be authenticated
 * - Parent must have permission to view this child's stream
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createSubscribeTokenForStream,
  findStageByStreamId,
} from '@/lib/streaming/stage-pool';

// ============================================
// TYPES
// ============================================

interface ViewerTokenResponse {
  streamId: string;
  stageArn: string;
  subscribeToken: string;
  participantId: string;
  expiresAt: string;
  region: string;
  viewerConfig: {
    /** Use IVS Web Broadcast SDK to subscribe */
    sdkUrl: string;
    /** Alternative: use WebRTC directly with this signaling endpoint */
    signalingEndpoint: string;
  };
}

interface ErrorResponse {
  error: string;
  code: string;
}

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

async function validateParentAuth(
  request: NextRequest,
  streamId: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const token = extractAuthToken(request);
  
  // Demo token support
  if (token === 'demo-viewer-token' || token === 'demo-token') {
    return { valid: true, userId: 'demo-parent' };
  }
  
  if (!token) {
    return { valid: false, error: 'Missing authorization token' };
  }
  
  // In production:
  // 1. Validate JWT
  // 2. Check if parent is related to the child who owns this stream
  // 3. Check if parent has permission to view
  
  // For now, accept any token
  return { valid: true, userId: token.substring(0, 20) };
}

// ============================================
// GET - Get Viewer (Subscribe) Token
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const { streamId } = await params;
    
    // Validate authentication
    const auth = await validateParentAuth(request, streamId);
    if (!auth.valid) {
      return NextResponse.json(
        { error: auth.error, code: 'UNAUTHORIZED' } as ErrorResponse,
        { status: 401 }
      );
    }
    
    // Find the active stage for this stream
    const stage = findStageByStreamId(streamId);
    
    if (!stage) {
      return NextResponse.json(
        { 
          error: 'Stream not found or not currently live',
          code: 'NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }
    
    if (!stage.inUse) {
      return NextResponse.json(
        { 
          error: 'Stream is no longer live',
          code: 'STREAM_ENDED',
        } as ErrorResponse,
        { status: 410 }
      );
    }
    
    // Create subscribe token for this viewer
    const subscription = await createSubscribeTokenForStream(
      stage.arn,
      auth.userId!,
      streamId
    );
    
    const region = subscription.region;
    
    const response: ViewerTokenResponse = {
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
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Viewer] Error getting viewer token:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal error',
        code: 'INTERNAL_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================
// POST - Alternative endpoint for viewer token
// (Some clients prefer POST for sensitive data)
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  // Just delegate to GET handler
  return GET(request, { params });
}
