/**
 * Prometheus Metrics Endpoint
 *
 * GET /api/metrics
 *
 * Exposes key operational metrics in Prometheus text format for
 * scraping by Prometheus, Grafana Agent, Datadog, etc.
 */

import { NextResponse } from 'next/server';
import { getStagePoolStatus } from '@/lib/streaming/stage-pool';
import { isRedisAvailable } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const lines: string[] = [];

  function gauge(name: string, help: string, value: number, labels?: Record<string, string>) {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);
    const labelStr = labels
      ? '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
      : '';
    lines.push(`${name}${labelStr} ${value}`);
  }

  // Stage pool metrics
  try {
    const pool = await getStagePoolStatus();
    gauge('substream_stage_pool_available', 'Available stages in pool', pool.available);
    gauge('substream_stage_pool_in_use', 'Stages currently in use', pool.inUse);
    gauge('substream_stage_pool_total', 'Total stages in pool', pool.total);
  } catch {
    gauge('substream_stage_pool_available', 'Available stages in pool', -1);
  }

  // Redis connectivity
  const redisUp = await isRedisAvailable();
  gauge('substream_redis_up', 'Whether Redis is connected (1=up, 0=down)', redisUp ? 1 : 0);

  // DB stream counts
  try {
    const [liveStreams, totalOrgs, totalApps] = await Promise.all([
      prisma.stream.count({ where: { status: 'LIVE' } }),
      prisma.organization.count(),
      prisma.app.count(),
    ]);
    gauge('substream_streams_live', 'Number of currently live streams', liveStreams);
    gauge('substream_organizations_total', 'Total registered organizations', totalOrgs);
    gauge('substream_apps_total', 'Total registered apps', totalApps);
  } catch {
    gauge('substream_streams_live', 'Number of currently live streams', -1);
  }

  // Process metrics
  const mem = process.memoryUsage();
  gauge('process_heap_used_bytes', 'Process heap used bytes', mem.heapUsed);
  gauge('process_heap_total_bytes', 'Process heap total bytes', mem.heapTotal);
  gauge('process_rss_bytes', 'Process RSS bytes', mem.rss);

  return new NextResponse(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
