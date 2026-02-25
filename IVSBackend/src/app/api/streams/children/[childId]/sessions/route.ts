/**
 * Session Management API
 * Create and end streaming sessions
 * 
 * POST /api/streams/children/:childId/sessions - Create new session
 * 
 * Query parameters:
 *   mode: 'webrtc' (default) | 'rtmps'
 *     - webrtc: IVS Real-Time session (returns participant token)
 *     - rtmps: Legacy RTMPS session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createStreamSession, StreamingError } from '@/lib/streaming';
import { createRealTimeSession } from '@/lib/streaming/stream-realtime-service';
import { requireAuth, type AuthContext } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    
    // Check session mode (rtmps is default for backward compatibility)
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'rtmps';
    
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    if (mode === 'webrtc') {
      // New WebRTC mode using IVS Real-Time
      const result = await createRealTimeSession(childId, auth.userId);
      return NextResponse.json({
        mode: 'webrtc',
        ...result,
      }, { status: 201 });
    } else {
      // Legacy RTMPS mode
      const result = await createStreamSession(childId, auth.userId);
      return NextResponse.json({
        mode: 'rtmps',
        ...result,
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Create session error:', error);

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