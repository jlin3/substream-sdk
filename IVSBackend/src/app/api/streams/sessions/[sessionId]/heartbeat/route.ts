/**
 * Session Heartbeat API
 * Receives periodic health updates from the Stream SDK
 * 
 * POST /api/streams/sessions/:sessionId/heartbeat
 */

import { NextRequest, NextResponse } from 'next/server';
import { StreamingError } from '@/lib/streaming';
import { prisma } from '@/lib/prisma';

interface HeartbeatPayload {
  currentBitrateKbps?: number;
  currentViewers?: number;
  streamHealth?: 'healthy' | 'degraded' | 'poor';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body: HeartbeatPayload = await request.json();
    
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Find session
    const session = await prisma.childStreamSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (session.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Session is not active', code: 'SESSION_NOT_ACTIVE' },
        { status: 400 }
      );
    }

    // Update session metrics
    const updateData: Record<string, number | null> = {};
    
    if (body.currentBitrateKbps !== undefined) {
      // Update average bitrate (simple running average)
      const currentAvg = session.avgBitrateKbps || body.currentBitrateKbps;
      updateData.avgBitrateKbps = Math.round(
        (currentAvg + body.currentBitrateKbps) / 2
      );
    }

    if (body.currentViewers !== undefined) {
      // Track max viewers
      const currentMax = session.maxViewers || 0;
      if (body.currentViewers > currentMax) {
        updateData.maxViewers = body.currentViewers;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.childStreamSession.update({
        where: { id: sessionId },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Heartbeat error:', error);

    if (error instanceof StreamingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
