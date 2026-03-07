/**
 * Session API
 * Get session info and end sessions
 * 
 * GET /api/streams/sessions/:sessionId - Get session info
 * DELETE /api/streams/sessions/:sessionId - End session
 * 
 * Query parameters for DELETE:
 *   mode: 'webrtc' (default) | 'rtmps'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionInfo, endStreamSession, StreamingError } from '@/lib/streaming';
import { endRealTimeSession } from '@/lib/streaming/stream-realtime-service';
import { requireAuth, type AuthContext } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    const session = await getSessionInfo(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Get session error:', error);

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    // Check session mode (rtmps is default for backward compatibility)
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'rtmps';
    
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    if (mode === 'webrtc') {
      // WebRTC mode - also stops compositions
      await endRealTimeSession(sessionId, auth.userId);
    } else {
      // Legacy RTMPS mode
      await endStreamSession(sessionId, auth.userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('End session error:', error);

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