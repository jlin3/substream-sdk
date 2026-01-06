/**
 * Health Check API
 * Returns server status and configuration info
 * 
 * GET /api/health
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      database: !!process.env.DATABASE_URL,
      awsIvs: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      recording: !!process.env.IVS_RECORDING_CONFIG_ARN,
      playbackAuth: !!(process.env.IVS_PLAYBACK_KEY_PAIR_ID && process.env.IVS_PLAYBACK_PRIVATE_KEY),
      encryption: !!process.env.STREAM_KEY_ENCRYPTION_KEY,
    },
  });
}
