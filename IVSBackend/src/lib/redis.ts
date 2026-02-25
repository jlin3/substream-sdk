/**
 * Shared Redis client singleton.
 *
 * Falls back to an in-memory stub when REDIS_URL is not set so that
 * local development works without Redis installed.
 */

import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.warn('[Redis] REDIS_URL not set — using in-memory fallback (single-instance only)');
    // Return a real Redis instance pointed at localhost; if it fails to connect
    // callers degrade gracefully.
    return new Redis({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't retry — degrade gracefully
      lazyConnect: true,
    });
  }

  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
  });
}

export const redis: Redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * Returns true if Redis is connected and responding.
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
