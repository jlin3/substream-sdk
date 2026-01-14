/**
 * Playback API
 * Provides playback URL and token for parents watching their children
 * 
 * GET /api/streams/children/:childId/playback
 * 
 * Query parameters:
 *   mode: 'webrtc' (default) | 'hls'
 *     - webrtc: IVS Real-Time WebRTC playback (low latency)
 *     - hls: Traditional HLS playback (wider compatibility)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlaybackForParent, StreamingError } from '@/lib/streaming';
import { getRealTimePlaybackForParent } from '@/lib/streaming/stream-realtime-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    
    // Check playback mode
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'webrtc';
    
    // TODO: Replace with actual auth extraction from session/token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // Extract parent user ID from auth
    const parentUserId = extractUserIdFromAuth(authHeader);
    if (!parentUserId) {
      return NextResponse.json(
        { error: 'Invalid authentication', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (mode === 'webrtc') {
      // New WebRTC mode using IVS Real-Time
      const result = await getRealTimePlaybackForParent(parentUserId, childId);
      return NextResponse.json({
        mode: 'webrtc',
        ...result,
      });
    } else {
      // Legacy HLS mode
      const result = await getPlaybackForParent(parentUserId, childId);
      return NextResponse.json({
        mode: 'hls',
        ...result,
      });
    }
  } catch (error) {
    console.error('Playback error:', error);

    if (error instanceof StreamingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

function extractUserIdFromAuth(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) return null;
  
  const token = match[1];
  
  // Demo token mapping for SDK users to test immediately
  const demoTokens: Record<string, string> = {
    'demo-token': 'demo-user-001',
    'demo-viewer-token': 'demo-viewer-001',
    'test-token': 'test-user-id',
    'test-parent-token': 'test-parent-user-id',
  };
  
  return demoTokens[token] || token;
}
