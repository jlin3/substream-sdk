/**
 * Rate Limiting via Redis sliding-window counter.
 *
 * Falls back to a simple in-memory Map when Redis is unavailable.
 * Keyed by API key prefix or IP address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis, isRedisAvailable } from './redis';
import type { AuthContext } from './auth';

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX = 100;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// In-memory fallback
const memCounters = new Map<string, { count: number; resetAt: number }>();

function rateLimitKey(auth: AuthContext | null, request: NextRequest): string {
  if (auth) return `rl:${auth.orgId}`;
  return `rl:ip:${request.headers.get('x-forwarded-for') || 'unknown'}`;
}

async function checkRedis(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, '-inf', windowStart);
  pipeline.zadd(key, now, `${now}:${Math.random()}`);
  pipeline.zcard(key);
  pipeline.pexpire(key, windowMs);
  const results = await pipeline.exec();

  const count = (results?.[2]?.[1] as number) || 0;
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt: now + windowMs,
  };
}

function checkMemory(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memCounters.get(key);

  if (!entry || now > entry.resetAt) {
    memCounters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  entry.count++;
  return {
    allowed: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Check rate limit for a request. Returns null if allowed,
 * or a 429 NextResponse if rate-limited.
 */
export async function checkRateLimit(
  request: NextRequest,
  auth: AuthContext | null,
  opts?: { max?: number; windowMs?: number },
): Promise<NextResponse | null> {
  const max = opts?.max ?? DEFAULT_MAX;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const key = rateLimitKey(auth, request);

  let result: RateLimitResult;
  if (await isRedisAvailable()) {
    result = await checkRedis(key, max, windowMs);
  } else {
    result = checkMemory(key, max, windowMs);
  }

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      },
    );
  }

  return null;
}
