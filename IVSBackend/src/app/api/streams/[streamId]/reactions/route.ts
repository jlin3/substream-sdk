/**
 * Reactions API
 *
 * POST /api/streams/:streamId/reactions — Send a reaction
 * GET  /api/streams/:streamId/reactions — Get allowed reactions list
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/lib/auth';
import {
  publishReaction,
  isValidReaction,
  getAllowedReactions,
} from '@/lib/engagement/reactions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;
    const { streamId } = await params;

    const body = await request.json();
    const emoji: string = body.emoji;

    if (!emoji || !isValidReaction(emoji)) {
      return NextResponse.json(
        {
          error: 'Invalid reaction',
          code: 'INVALID_PARAMS',
          allowed: getAllowedReactions(),
        },
        { status: 400 },
      );
    }

    await publishReaction({
      streamId,
      viewerId: auth.userId,
      emoji,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Reactions] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await params;
  return NextResponse.json({
    streamId,
    allowedReactions: getAllowedReactions(),
  });
}
