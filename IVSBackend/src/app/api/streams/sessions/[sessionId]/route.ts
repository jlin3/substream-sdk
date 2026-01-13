/**
 * Session API
 * Get session info and end sessions
 * 
 * GET /api/streams/sessions/:sessionId - Get session info
 * DELETE /api/streams/sessions/:sessionId - End session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionInfo, endStreamSession, StreamingError } from '@/lib/streaming';

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
    
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const requestingUserId = extractUserIdFromAuth(authHeader);
    if (!requestingUserId) {
      return NextResponse.json(
        { error: 'Invalid authentication', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await endStreamSession(sessionId, requestingUserId);

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
