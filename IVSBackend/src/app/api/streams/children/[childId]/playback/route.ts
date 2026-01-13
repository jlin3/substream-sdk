/**
 * Playback API
 * Provides HLS playback URL and token for parents watching their children
 * 
 * GET /api/streams/children/:childId/playback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlaybackForParent, StreamingError } from '@/lib/streaming';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    
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

    const result = await getPlaybackForParent(parentUserId, childId);

    return NextResponse.json(result);
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
