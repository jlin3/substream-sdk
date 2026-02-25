/**
 * Health Check API
 *
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { checkRealTimeHealth } from '@/lib/streaming/stream-realtime-service';
import { isRedisAvailable } from '@/lib/redis';
import { getStagePoolStatus } from '@/lib/streaming/stage-pool';

export async function GET() {
  let realTimeHealth = {
    configured: false,
    stageArn: null as string | null,
    channelArn: null as string | null,
    storageArn: null as string | null,
  };

  try {
    realTimeHealth = await checkRealTimeHealth();
  } catch {
    // IVS check failed — report as unconfigured
  }

  const redisUp = await isRedisAvailable();
  let poolStatus = { available: 0, inUse: 0, total: 0 };
  try {
    poolStatus = await getStagePoolStatus();
  } catch {}

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: !!process.env.DATABASE_URL,
      redis: redisUp,
      awsIvs: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      ivsRealTime: realTimeHealth.configured,
      encryption: !!process.env.STREAM_KEY_ENCRYPTION_KEY,
      jwt: !!process.env.JWT_SECRET,
    },
    stagePool: poolStatus,
    realtime: {
      stageArn: realTimeHealth.stageArn,
      channelArn: realTimeHealth.channelArn,
      storageArn: realTimeHealth.storageArn,
    },
  });
}
