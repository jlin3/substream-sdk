/**
 * Health Check API
 * Returns server status and configuration info
 * 
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { checkRealTimeHealth } from '@/lib/streaming/stream-realtime-service';

export async function GET() {
  // Check IVS Real-Time configuration
  let realTimeHealth = {
    configured: false,
    stageArn: null as string | null,
    channelArn: null as string | null,
    storageArn: null as string | null,
  };
  
  try {
    realTimeHealth = await checkRealTimeHealth();
  } catch (error) {
    console.warn('[Health] Could not check IVS Real-Time:', error);
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      // Database
      database: !!process.env.DATABASE_URL,
      
      // AWS Credentials
      awsIvs: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      
      // IVS Real-Time (WebRTC) - NEW
      ivsRealTime: realTimeHealth.configured,
      ivsStage: !!realTimeHealth.stageArn,
      ivsChannel: !!realTimeHealth.channelArn,
      
      // Legacy IVS Low-Latency (RTMPS)
      recording: !!process.env.IVS_RECORDING_CONFIG_ARN,
      playbackAuth: !!(process.env.IVS_PLAYBACK_KEY_PAIR_ID && process.env.IVS_PLAYBACK_PRIVATE_KEY),
      
      // Security
      encryption: !!process.env.STREAM_KEY_ENCRYPTION_KEY,
    },
    realtime: {
      stageArn: realTimeHealth.stageArn,
      channelArn: realTimeHealth.channelArn,
      storageArn: realTimeHealth.storageArn,
    },
  });
}
