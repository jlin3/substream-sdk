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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    
    // Check session mode (rtmps is default for backward compatibility)
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'rtmps';
    
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

    if (mode === 'webrtc') {
      // New WebRTC mode using IVS Real-Time
      const result = await createRealTimeSession(childId, requestingUserId);
      return NextResponse.json({
        mode: 'webrtc',
        ...result,
      }, { status: 201 });
    } else {
      // Legacy RTMPS mode
      const result = await createStreamSession(childId, requestingUserId);
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
