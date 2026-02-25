/**
 * Organization Analytics API
 *
 * GET /api/orgs/:orgId/analytics         — Aggregate overview
 * GET /api/orgs/:orgId/analytics?period=7d — Time-series data
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, type AuthContext } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;
    const { orgId } = await params;

    if (auth.method !== 'demo' && auth.orgId !== orgId) {
      return NextResponse.json(
        { error: 'Not authorized for this org', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const daysBack = parseInt(period) || 30;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Get all apps for this org
    const apps = await prisma.app.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });
    const appIds = apps.map((a) => a.id);

    if (appIds.length === 0) {
      return NextResponse.json({
        overview: { totalStreams: 0, liveNow: 0, totalWatchSeconds: 0, peakConcurrent: 0 },
        daily: [],
        apps: [],
      });
    }

    // Aggregate stream metrics
    const [totalStreams, liveNow, metrics] = await Promise.all([
      prisma.stream.count({ where: { appId: { in: appIds }, createdAt: { gte: since } } }),
      prisma.stream.count({ where: { appId: { in: appIds }, status: 'LIVE' } }),
      prisma.stream.aggregate({
        where: { appId: { in: appIds }, createdAt: { gte: since } },
        _sum: { totalWatchSeconds: true },
        _max: { maxViewers: true },
      }),
    ]);

    // Daily breakdown (grouped by date)
    const allStreams = await prisma.stream.findMany({
      where: { appId: { in: appIds }, startedAt: { gte: since } },
      select: { startedAt: true, maxViewers: true, totalWatchSeconds: true, status: true },
      orderBy: { startedAt: 'asc' },
    });

    const dailyMap = new Map<string, { streams: number; watchSeconds: number; peakViewers: number }>();
    for (const s of allStreams) {
      if (!s.startedAt) continue;
      const day = s.startedAt.toISOString().substring(0, 10);
      const entry = dailyMap.get(day) || { streams: 0, watchSeconds: 0, peakViewers: 0 };
      entry.streams++;
      entry.watchSeconds += s.totalWatchSeconds;
      entry.peakViewers = Math.max(entry.peakViewers, s.maxViewers);
      dailyMap.set(day, entry);
    }

    const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Per-app summary
    const perApp = await Promise.all(
      apps.map(async (app) => {
        const count = await prisma.stream.count({
          where: { appId: app.id, createdAt: { gte: since } },
        });
        const live = await prisma.stream.count({
          where: { appId: app.id, status: 'LIVE' },
        });
        return { appId: app.id, appName: app.name, totalStreams: count, liveNow: live };
      }),
    );

    return NextResponse.json({
      overview: {
        totalStreams,
        liveNow,
        totalWatchSeconds: metrics._sum.totalWatchSeconds ?? 0,
        peakConcurrent: metrics._max.maxViewers ?? 0,
      },
      daily,
      apps: perApp,
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
