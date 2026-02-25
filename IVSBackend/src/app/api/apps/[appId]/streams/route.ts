/**
 * Stream Discovery API
 *
 * GET /api/apps/:appId/streams         — List streams (live, ended, all)
 * GET /api/apps/:appId/streams?live=1  — List only live streams
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, type AuthContext } from '@/lib/auth';
import { getViewerCount } from '@/lib/engagement/viewer-count';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const { appId } = await params;
    const { searchParams } = new URL(request.url);

    const liveOnly = searchParams.get('live') === '1' || searchParams.get('status') === 'LIVE';
    const tag = searchParams.get('tag');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    // Verify the app belongs to the auth's org
    if (auth.method !== 'demo') {
      const app = await prisma.app.findUnique({ where: { id: appId }, select: { orgId: true } });
      if (!app || app.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'App not found or not accessible', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
    }

    const where: Record<string, unknown> = { appId };
    if (liveOnly) where.status = 'LIVE';
    if (tag) where.tags = { has: tag };
    if (cursor) where.id = { lt: cursor };

    const streams = await prisma.stream.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = streams.length > limit;
    const page = hasMore ? streams.slice(0, -1) : streams;

    // Enrich with live viewer counts
    const enriched = await Promise.all(
      page.map(async (s) => ({
        id: s.id,
        streamerId: s.streamerId,
        title: s.title,
        tags: s.tags,
        status: s.status,
        viewerCount: s.status === 'LIVE' ? await getViewerCount(s.id) : s.maxViewers,
        startedAt: s.startedAt?.toISOString() ?? null,
        endedAt: s.endedAt?.toISOString() ?? null,
        vodUrl: s.vodUrl,
        vodThumbnailUrl: s.vodThumbnailUrl,
      })),
    );

    return NextResponse.json({
      streams: enriched,
      pagination: {
        nextCursor: hasMore ? page[page.length - 1].id : null,
        hasMore,
      },
    });
  } catch (error) {
    console.error('[Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
