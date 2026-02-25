/**
 * Live viewer count tracking via Redis.
 *
 * Uses a Redis sorted set per stream keyed by viewerId with a TTL heartbeat.
 * Falls back to in-memory counters when Redis is unavailable.
 */

import { redis, isRedisAvailable } from '../redis';

const VIEWER_TTL_SECONDS = 90; // consider viewer gone if no heartbeat for 90s

function redisKey(streamId: string): string {
  return `viewers:${streamId}`;
}

// In-memory fallback
const memViewers = new Map<string, Set<string>>();

export async function viewerJoin(streamId: string, viewerId: string): Promise<void> {
  if (await isRedisAvailable()) {
    const now = Date.now();
    await redis.zadd(redisKey(streamId), now, viewerId);
    await redis.expire(redisKey(streamId), VIEWER_TTL_SECONDS * 2);
  } else {
    if (!memViewers.has(streamId)) memViewers.set(streamId, new Set());
    memViewers.get(streamId)!.add(viewerId);
  }
}

export async function viewerHeartbeat(streamId: string, viewerId: string): Promise<void> {
  if (await isRedisAvailable()) {
    await redis.zadd(redisKey(streamId), Date.now(), viewerId);
  }
}

export async function viewerLeave(streamId: string, viewerId: string): Promise<void> {
  if (await isRedisAvailable()) {
    await redis.zrem(redisKey(streamId), viewerId);
  } else {
    memViewers.get(streamId)?.delete(viewerId);
  }
}

export async function getViewerCount(streamId: string): Promise<number> {
  if (await isRedisAvailable()) {
    // Only count viewers with heartbeat within TTL
    const cutoff = Date.now() - VIEWER_TTL_SECONDS * 1000;
    await redis.zremrangebyscore(redisKey(streamId), '-inf', cutoff);
    return redis.zcard(redisKey(streamId));
  }
  return memViewers.get(streamId)?.size ?? 0;
}

export async function getViewerList(streamId: string): Promise<string[]> {
  if (await isRedisAvailable()) {
    const cutoff = Date.now() - VIEWER_TTL_SECONDS * 1000;
    await redis.zremrangebyscore(redisKey(streamId), '-inf', cutoff);
    return redis.zrangebyscore(redisKey(streamId), cutoff, '+inf');
  }
  return Array.from(memViewers.get(streamId) ?? []);
}
