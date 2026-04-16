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
import { requireAuth, type AuthContext } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    
    // Check playback mode (rtmps/hls is default for backward compatibility)
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'hls';
    
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    if (mode === 'webrtc') {
      // New WebRTC mode using IVS Real-Time
      const result = await getRealTimePlaybackForParent(auth.userId, childId);
      return NextResponse.json({
        mode: 'webrtc',
        ...result,
      });
    } else {
      // Legacy HLS mode
      const result = await getPlaybackForParent(auth.userId, childId);
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