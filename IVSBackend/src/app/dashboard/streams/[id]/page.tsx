import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { StreamViewer } from './viewer';

export default async function StreamViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const stream = await prisma.stream.findFirst({
    where: { id, orgId: session.orgId },
  });

  if (!stream) notFound();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/streams"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          &larr; Streams
        </Link>
        <span className="text-white/20">/</span>
        <h1 className="text-lg font-semibold truncate">{stream.title || 'Untitled Stream'}</h1>
        {stream.status === 'LIVE' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-live/20 text-live font-medium shrink-0">
            ● LIVE
          </span>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        {stream.status === 'LIVE' && stream.ivsStageArn ? (
          <StreamViewer streamId={stream.id} orgSlug={session.orgSlug} />
        ) : stream.recordingUrl ? (
          <div className="aspect-video bg-black flex items-center justify-center">
            <video
              src={stream.recordingUrl}
              controls
              className="w-full h-full"
              poster={stream.thumbnailUrl || undefined}
            />
          </div>
        ) : (
          <div className="aspect-video bg-black flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-white/30 text-sm">
                {stream.status === 'IDLE'
                  ? 'Waiting for stream to start...'
                  : 'Stream has ended'}
              </p>
              {stream.status === 'ENDED' && (
                <p className="text-xs text-white/20">Recording may still be processing</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 text-sm text-white/50">
        <span>Streamer: {stream.streamerName || stream.streamerId}</span>
        {stream.startedAt && (
          <span>Started: {new Date(stream.startedAt).toLocaleString()}</span>
        )}
        {stream.durationSecs && (
          <span>Duration: {Math.floor(stream.durationSecs / 60)}m {stream.durationSecs % 60}s</span>
        )}
      </div>
    </div>
  );
}
