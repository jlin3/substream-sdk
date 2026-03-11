import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { WatchPlayer } from './player';

export default async function WatchPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [liveStreams, recordings, highlights] = await Promise.all([
    prisma.stream.findMany({
      where: { orgId: session.orgId, status: 'LIVE' },
      orderBy: { startedAt: 'desc' },
      take: 5,
    }),
    prisma.stream.findMany({
      where: { orgId: session.orgId, status: { in: ['RECORDED', 'ENDED'] } },
      orderBy: { endedAt: 'desc' },
      take: 12,
    }),
    prisma.highlight.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { stream: { select: { title: true, streamerName: true } } },
    }),
  ]);

  // Resolve GCS URIs to signed URLs for highlights
  const hlServiceUrl = process.env.HIGHLIGHT_SERVICE_URL || 'http://localhost:8080';
  const resolvedHighlights = await Promise.all(
    highlights.map(async (h) => {
      let videoUrl = h.videoUrl;
      if (videoUrl && videoUrl.startsWith('gs://')) {
        try {
          const res = await fetch(
            `${hlServiceUrl}/api/v1/signed-url?uri=${encodeURIComponent(videoUrl)}`,
            { cache: 'no-store' },
          );
          if (res.ok) {
            const data = await res.json();
            videoUrl = data.url;
          }
        } catch {
          videoUrl = null;
        }
      }
      return {
        id: h.id,
        title: h.title,
        videoUrl,
        duration: h.duration,
        status: h.status,
        streamTitle: h.stream?.title || null,
        streamerName: h.stream?.streamerName || null,
        createdAt: h.createdAt.toISOString(),
      };
    }),
  );

  const serializedLive = liveStreams.map((s) => ({
    id: s.id,
    title: s.title,
    streamerName: s.streamerName,
    streamerId: s.streamerId,
    status: s.status,
    ivsStageArn: s.ivsStageArn,
    startedAt: s.startedAt?.toISOString() || null,
  }));

  const serializedRecordings = recordings.map((r) => ({
    id: r.id,
    title: r.title,
    streamerName: r.streamerName,
    streamerId: r.streamerId,
    status: r.status,
    recordingUrl: r.recordingUrl,
    durationSecs: r.durationSecs,
    endedAt: r.endedAt?.toISOString() || null,
  }));

  return (
    <WatchPlayer
      liveStreams={serializedLive}
      recordings={serializedRecordings}
      highlights={resolvedHighlights}
      orgSlug={session.orgSlug}
    />
  );
}
