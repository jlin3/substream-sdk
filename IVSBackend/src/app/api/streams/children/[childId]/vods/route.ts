/**
 * VOD List API
 * Returns list of recorded sessions for a child
 * 
 * GET /api/streams/children/:childId/vods
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVODsForChild, StreamingError } from '@/lib/streaming';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const cursor = searchParams.get('cursor') || undefined;
    
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const parentUserId = extractUserIdFromAuth(authHeader);
    if (!parentUserId) {
      return NextResponse.json(
        { error: 'Invalid authentication', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const result = await getVODsForChild(parentUserId, childId, limit, cursor);

    return NextResponse.json({
      childId,
      ...result,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
      },
    });
  } catch (error) {
    console.error('VOD list error:', error);

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
