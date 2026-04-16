/**
 * Health Check API
 *
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { getStagePoolStatus } from '@/lib/streaming/stage-pool';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: !!process.env.DATABASE_URL,
      awsIvs: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      encryption: !!process.env.STREAM_KEY_ENCRYPTION_KEY,
    },
    stagePool: getStagePoolStatus(),
  });
}
