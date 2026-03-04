import { NextResponse } from 'next/server';

const BUILD_TIME = new Date().toISOString();
const VERSION = '1.2.0';

export async function GET() {
  return NextResponse.json({
    version: VERSION,
    buildTime: BUILD_TIME,
    features: ['api-key-auth', 'jwt-auth', 'ivs-streaming', 'web-sdk'],
  });
}
