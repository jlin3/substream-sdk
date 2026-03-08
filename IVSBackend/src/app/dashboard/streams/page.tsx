import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function StreamsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const streams = await prisma.stream.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { highlights: true } } },
  });

  const live = streams.filter((s) => s.status === 'LIVE');
  const past = streams.filter((s) => s.status !== 'LIVE');

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Streams</h1>

      {/* Live Streams */}
      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-live flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
            Live Now ({live.length})
          </h2>
          <div className="grid gap-3">
            {live.map((s) => (
              <StreamCard key={s.id} stream={s} />
            ))}
          </div>
        </section>
      )}

      {/* Past Streams */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          {live.length > 0 ? 'Past Streams' : 'All Streams'}
        </h2>
        {past.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-12 text-center">
            <p className="text-white/30 text-sm">
              No streams yet. Integrate the Substream SDK into your game to start streaming.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {past.map((s) => (
              <StreamCard key={s.id} stream={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type StreamWithCount = {
  id: string;
  title: string | null;
  streamerName: string | null;
  streamerId: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSecs: number | null;
  recordingUrl: string | null;
  _count: { highlights: number };
};

function StreamCard({ stream }: { stream: StreamWithCount }) {
  const duration = stream.durationSecs
    ? formatDuration(stream.durationSecs)
    : stream.startedAt && stream.endedAt
      ? formatDuration(Math.floor((stream.endedAt.getTime() - stream.startedAt.getTime()) / 1000))
      : null;

  return (
    <Link
      href={`/dashboard/streams/${stream.id}`}
      className="rounded-xl border border-white/10 bg-surface-100 px-5 py-4 flex items-center justify-between gap-4 hover:border-white/20 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{stream.title || 'Untitled Stream'}</p>
          <StatusBadge status={stream.status} />
        </div>
        <p className="text-xs text-white/40 mt-1">
          {stream.streamerName || stream.streamerId}
          {duration && <> &middot; {duration}</>}
          {stream.startedAt && <> &middot; {formatDate(stream.startedAt)}</>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {stream.status === 'LIVE' && (
          <span className="rounded-lg bg-live/20 text-live px-3 py-1.5 text-xs font-medium">
            Watch Live
          </span>
        )}
        {(stream.status === 'RECORDED' || stream.status === 'ENDED') && (
          <span className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60">
            View Details
          </span>
        )}
        {stream._count.highlights > 0 && (
          <span className="text-xs text-brand-400">
            {stream._count.highlights} highlight{stream._count.highlights > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
