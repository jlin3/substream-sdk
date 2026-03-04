/**
 * VOD List API
 * Returns list of recorded sessions for a child
 * 
 * GET /api/streams/children/:childId/vods
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVODsForChild, StreamingError } from '@/lib/streaming';
import { requireAuth, type AuthContext } from '@/lib/auth';

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
    
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const result = await getVODsForChild(auth.userId, childId, limit, cursor);

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