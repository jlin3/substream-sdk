import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session || session.orgSlug !== slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const highlight = await prisma.highlight.findFirst({
    where: { id, org: { slug } },
    include: {
      stream: { select: { id: true, title: true, streamerName: true } },
    },
  });

  if (!highlight) {
    return NextResponse.json({ error: 'Highlight not found' }, { status: 404 });
  }

  // If processing, poll the highlight service for status updates
  if (highlight.status === 'PROCESSING' && highlight.jobId) {
    const highlightServiceUrl = process.env.HIGHLIGHT_SERVICE_URL || 'http://localhost:8080';
    try {
      const hlRes = await fetch(`${highlightServiceUrl}/api/v1/highlights/${highlight.jobId}`);
      if (hlRes.ok) {
        const hlData = await hlRes.json();
        if (hlData.status === 'completed' && hlData.result?.highlight_url) {
          await prisma.highlight.update({
            where: { id: highlight.id },
            data: {
              status: 'COMPLETED',
              videoUrl: hlData.result.highlight_url,
              thumbnailUrl: hlData.result.thumbnail_url || null,
              duration: hlData.result.duration_seconds || null,
            },
          });
          return NextResponse.json({
            highlight: {
              ...highlight,
              status: 'COMPLETED',
              videoUrl: hlData.result.highlight_url,
              thumbnailUrl: hlData.result.thumbnail_url || null,
              duration: hlData.result.duration_seconds || null,
            },
          });
        } else if (hlData.status === 'failed') {
          await prisma.highlight.update({
            where: { id: highlight.id },
            data: { status: 'FAILED' },
          });
          return NextResponse.json({
            highlight: { ...highlight, status: 'FAILED' },
          });
        }
      }
    } catch {
      // Highlight service unreachable; return current state
    }
  }

  return NextResponse.json({ highlight });
}
