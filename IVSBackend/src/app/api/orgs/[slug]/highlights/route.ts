import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session || session.orgSlug !== slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const highlights = await prisma.highlight.findMany({
    where: { org: { slug } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      stream: { select: { id: true, title: true, streamerName: true } },
    },
  });

  return NextResponse.json({ highlights });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session || session.orgSlug !== slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { streamId } = body;

  if (!streamId) {
    return NextResponse.json({ error: 'streamId is required' }, { status: 400 });
  }

  const stream = await prisma.stream.findFirst({
    where: { id: streamId, org: { slug } },
  });

  if (!stream) {
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  }

  const highlightServiceUrl = process.env.HIGHLIGHT_SERVICE_URL || 'http://localhost:8080';

  let jobId: string | null = null;
  let hlStatus: 'PENDING' | 'PROCESSING' = 'PENDING';

  if (stream.recordingUrl) {
    try {
      const hlRes = await fetch(`${highlightServiceUrl}/api/v1/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_uri: stream.recordingUrl,
          title: `Highlights: ${stream.title || 'Untitled Stream'}`,
        }),
      });

      if (hlRes.ok) {
        const hlData = await hlRes.json();
        jobId = hlData.job_id || null;
        hlStatus = 'PROCESSING';
      }
    } catch {
      // Highlight service may not be running; create record anyway
    }
  }

  const highlight = await prisma.highlight.create({
    data: {
      orgId: session.orgId,
      streamId: stream.id,
      title: `Highlights: ${stream.title || 'Untitled Stream'}`,
      status: hlStatus,
      jobId,
    },
  });

  return NextResponse.json({ highlight }, { status: 201 });
}
