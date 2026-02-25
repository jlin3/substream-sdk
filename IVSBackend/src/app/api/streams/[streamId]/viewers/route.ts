/**
 * Viewer Count API
 *
 * GET    /api/streams/:streamId/viewers — Get current viewer count
 * POST   /api/streams/:streamId/viewers — Register viewer join / heartbeat
 * DELETE /api/streams/:streamId/viewers — Register viewer leave
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/lib/auth';
import {
  viewerJoin,
  viewerHeartbeat,
  viewerLeave,
  getViewerCount,
} from '@/lib/engagement/viewer-count';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await params;
  const count = await getViewerCount(streamId);
  return NextResponse.json({ streamId, viewerCount: count });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;
    const { streamId } = await params;

    const body = await request.json().catch(() => ({}));
    const action: string = body.action || 'join';

    if (action === 'heartbeat') {
      await viewerHeartbeat(streamId, auth.userId);
    } else {
      await viewerJoin(streamId, auth.userId);
    }

    const count = await getViewerCount(streamId);
    return NextResponse.json({ streamId, viewerCount: count });
  } catch (error) {
    console.error('[Viewers] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;
    const { streamId } = await params;

    await viewerLeave(streamId, auth.userId);
    const count = await getViewerCount(streamId);
    return NextResponse.json({ streamId, viewerCount: count });
  } catch (error) {
    console.error('[Viewers] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
