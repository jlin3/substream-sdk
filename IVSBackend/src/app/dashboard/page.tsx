import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardOverview() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [liveStreams, recentStreams, recentHighlights, totalStreams, totalHighlights] =
    await Promise.all([
      prisma.stream.count({ where: { orgId: session.orgId, status: 'LIVE' } }),
      prisma.stream.findMany({
        where: { orgId: session.orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.highlight.findMany({
        where: { orgId: session.orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { stream: { select: { title: true } } },
      }),
      prisma.stream.count({ where: { orgId: session.orgId } }),
      prisma.highlight.count({ where: { orgId: session.orgId } }),
    ]);

  const recorded = await prisma.stream.count({
    where: { orgId: session.orgId, status: { in: ['RECORDED', 'ENDED'] } },
  });

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-white/50 mt-1">{session.orgName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Live Now" value={liveStreams} accent={liveStreams > 0} />
        <StatCard label="Total Streams" value={totalStreams} />
        <StatCard label="Recordings" value={recorded} />
        <StatCard label="Highlights" value={totalHighlights} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Streams */}
        <section className="rounded-xl border border-white/10 bg-surface-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold">Recent Streams</h2>
            <Link href="/dashboard/streams" className="text-xs text-brand-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentStreams.length === 0 ? (
              <p className="px-5 py-8 text-sm text-white/30 text-center">
                No streams yet. Start streaming with the SDK!
              </p>
            ) : (
              recentStreams.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/streams/${s.id}`}
                  className="px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.title || 'Untitled Stream'}</p>
                    <p className="text-xs text-white/40">
                      {s.streamerName || s.streamerId} &middot;{' '}
                      {s.startedAt ? timeAgo(s.startedAt) : 'Not started'}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Recent Highlights */}
        <section className="rounded-xl border border-white/10 bg-surface-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold">Recent Highlights</h2>
            <Link href="/dashboard/highlights" className="text-xs text-brand-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentHighlights.length === 0 ? (
              <p className="px-5 py-8 text-sm text-white/30 text-center">
                No highlights yet. Generate one from a recording!
              </p>
            ) : (
              recentHighlights.map((h) => (
                <Link
                  key={h.id}
                  href={`/dashboard/highlights/${h.id}`}
                  className="px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors block"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{h.title}</p>
                    <p className="text-xs text-white/40">
                      {h.stream?.title || 'Unknown stream'} &middot; {timeAgo(h.createdAt)}
                    </p>
                  </div>
                  <HighlightStatusBadge status={h.status} />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-4">
      <p className="text-xs text-white/50 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? 'text-live' : ''}`}>{value}</p>
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
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.IDLE}`}>
      {status === 'LIVE' ? '● LIVE' : status}
    </span>
  );
}

function HighlightStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-success/20 text-success',
    PROCESSING: 'bg-warning/20 text-warning',
    PENDING: 'bg-white/10 text-white/40',
    FAILED: 'bg-danger/20 text-danger',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
