/**
 * Version API - shows when the code was last deployed
 */
import { NextResponse } from 'next/server';

const BUILD_TIME = new Date().toISOString();
const VERSION = '1.2.0-webrtc-signaling';

export async function GET() {
  return NextResponse.json({
    version: VERSION,
    buildTime: BUILD_TIME,
    features: ['demo-tokens', 'ivs-streaming', 'webrtc-signaling'],
  });
}
