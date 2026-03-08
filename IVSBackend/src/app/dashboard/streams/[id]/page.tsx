import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { StreamViewer } from './viewer';
import { GenerateHighlightButton } from '../../vods/generate-button';

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
    include: {
      highlights: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!stream) notFound();

  const isEnded = stream.status === 'RECORDED' || stream.status === 'ENDED';

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/streams"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          &larr; Streams
        </Link>
        <span className="text-white/20">/</span>
        <h1 className="text-lg font-semibold truncate">{stream.title || 'Untitled Stream'}</h1>
        <StatusBadge status={stream.status} />
      </div>

      {/* Video area */}
      <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        {stream.status === 'LIVE' && stream.ivsStageArn ? (
          <StreamViewer streamId={stream.id} />
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
          <div className="aspect-video bg-surface-300 flex items-center justify-center">
            <div className="text-center space-y-3">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto text-white/10">
                <rect x="6" y="14" width="52" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
                <path d="M26 24l14 8-14 8V24z" fill="currentColor" />
              </svg>
              <p className="text-white/30 text-sm">
                {stream.status === 'IDLE'
                  ? 'Waiting for stream to start...'
                  : 'Stream has ended'}
              </p>
              {isEnded && !stream.recordingUrl && (
                <p className="text-xs text-white/20">Recording is being processed by AWS IVS</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stream info + actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-surface-100 p-5 space-y-4">
          <h2 className="font-semibold">Stream Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40 text-xs">Streamer</p>
              <p className="mt-0.5">{stream.streamerName || stream.streamerId}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Status</p>
              <p className="mt-0.5 capitalize">{stream.status.toLowerCase()}</p>
            </div>
            {stream.startedAt && (
              <div>
                <p className="text-white/40 text-xs">Started</p>
                <p className="mt-0.5">{new Date(stream.startedAt).toLocaleString()}</p>
              </div>
            )}
            {stream.durationSecs && (
              <div>
                <p className="text-white/40 text-xs">Duration</p>
                <p className="mt-0.5">{formatDuration(stream.durationSecs)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-xl border border-white/10 bg-surface-100 p-5 space-y-4">
          <h2 className="font-semibold">Actions</h2>
          <div className="space-y-2">
            {isEnded && (
              <GenerateHighlightButton
                streamId={stream.id}
                orgSlug={session.orgSlug}
                hasRecording={true}
                existingHighlights={stream.highlights.length}
              />
            )}
            {stream.recordingUrl && (
              <a
                href={stream.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                Download Recording
              </a>
            )}
          </div>

          {/* Highlights for this stream */}
          {stream.highlights.length > 0 && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-xs text-white/40">Highlights</p>
              {stream.highlights.map((h) => (
                <Link
                  key={h.id}
                  href={`/dashboard/highlights/${h.id}`}
                  className="flex items-center justify-between text-xs hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <span className="truncate">{h.title}</span>
                  <HighlightBadge status={h.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    LIVE: 'bg-live/20 text-live',
    ENDED: 'bg-white/10 text-white/50',
    RECORDED: 'bg-brand-600/20 text-brand-400',
    IDLE: 'bg-white/10 text-white/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${styles[status] || styles.IDLE}`}>
      {status === 'LIVE' ? '● LIVE' : status}
    </span>
  );
}

function HighlightBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'text-success',
    PROCESSING: 'text-warning',
    PENDING: 'text-white/40',
    FAILED: 'text-danger',
  };
  return <span className={`${styles[status] || styles.PENDING} shrink-0`}>{status}</span>;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
