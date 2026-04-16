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

        // highlight-service returns flat response: { status, highlight_url, segments, metadata, pipeline_data }
        if (hlData.status === 'completed' && hlData.highlight_url) {
          const duration = hlData.metadata?.highlight_duration
            ? Math.round(hlData.metadata.highlight_duration)
            : null;

          const pipelineData = hlData.pipeline_data
            ? {
                ...hlData.pipeline_data,
                segments: hlData.segments?.map((s: { start_time: number; end_time: number; score: number; label: string }) => ({
                  start: s.start_time,
                  end: s.end_time,
                  score: s.score,
                  label: s.label,
                })),
                model: hlData.metadata?.model_used || null,
                game_detected: hlData.metadata?.game_detected || null,
                genre_detected: hlData.metadata?.genre_detected || null,
              }
            : null;

          await prisma.highlight.update({
            where: { id: highlight.id },
            data: {
              status: 'COMPLETED',
              videoUrl: hlData.highlight_url,
              thumbnailUrl: null,
              duration,
              pipelineData: pipelineData ?? undefined,
            },
          });
          return NextResponse.json({
            highlight: {
              ...highlight,
              status: 'COMPLETED',
              videoUrl: hlData.highlight_url,
              duration,
              pipelineData,
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
