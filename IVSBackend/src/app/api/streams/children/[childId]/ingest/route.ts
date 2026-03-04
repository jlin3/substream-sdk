/**
 * Ingest Provisioning API
 * Provides streaming credentials for a child's Stream SDK
 * 
 * POST /api/streams/children/:childId/ingest
 * 
 * Query parameters:
 *   mode: 'rtmps' (default) | 'webrtc'
 *     - rtmps: RTMPS streaming via IVS Low-Latency (current, requires FFmpeg)
 *     - webrtc: IVS Real-Time WebRTC streaming (experimental)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIngestProvisioning, StreamingError } from '@/lib/streaming';
import { getRealTimeIngestProvisioning } from '@/lib/streaming/stream-realtime-service';
import { requireAuth, type AuthContext } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    
    // Check ingest mode (rtmps is default for backward compatibility)
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'rtmps';
    
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    if (mode === 'webrtc') {
      // New WebRTC mode using IVS Real-Time
      const result = await getRealTimeIngestProvisioning(childId, auth.userId);
      return NextResponse.json({
        mode: 'webrtc',
        ...result,
      });
    } else {
      // Legacy RTMPS mode (requires FFmpeg native library)
      const result = await getIngestProvisioning(childId, auth.userId);
      return NextResponse.json({
        mode: 'rtmps',
        ...result,
      });
    }
  } catch (error) {
    console.error('Ingest provisioning error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');

    if (error instanceof StreamingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }

    // Return more details in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage, code: 'INTERNAL_ERROR', stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}