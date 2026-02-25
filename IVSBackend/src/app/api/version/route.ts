import { NextResponse } from 'next/server';

const BUILD_TIME = new Date().toISOString();
const VERSION = '2.0.0';

export async function GET() {
  return NextResponse.json({
    version: VERSION,
    buildTime: BUILD_TIME,
    features: [
      'multi-tenant',
      'api-keys',
      'jwt-auth',
      'ivs-streaming',
      'redis-stage-pool',
      'webhooks',
      'chat',
      'reactions',
      'viewer-count',
      'stream-discovery',
      'analytics',
      'embed-widget',
    ],
  });
}
