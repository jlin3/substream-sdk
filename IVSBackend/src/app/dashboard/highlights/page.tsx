import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HighlightsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const highlights = await prisma.highlight.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      stream: { select: { id: true, title: true, streamerName: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Highlights</h1>

      {highlights.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-16 text-center space-y-2">
          <p className="text-white/30 text-sm">
            No highlights yet.
          </p>
          <p className="text-xs text-white/20">
            Go to <Link href="/dashboard/vods" className="text-brand-400 hover:underline">Recordings</Link> and
            click &ldquo;Generate Highlight&rdquo; to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h) => (
            <Link
              key={h.id}
              href={`/dashboard/highlights/${h.id}`}
              className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden hover:border-white/20 transition-colors group"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-surface-300 flex items-center justify-center relative">
                {h.thumbnailUrl ? (
                  <img src={h.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-white/10">
                    <path d="M24 4l6 15h15l-12 10.5 4.5 15L24 34.5 10.5 44.5 15 29.5 3 19h15l6-15z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
                {h.duration && (
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(h.duration)}
                  </span>
                )}
                <StatusOverlay status={h.status} />
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="text-sm font-medium truncate group-hover:text-brand-400 transition-colors">
                  {h.title}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {h.stream?.title || 'Unknown stream'}
                  {' '}&middot;{' '}
                  {formatDate(h.createdAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusOverlay({ status }: { status: string }) {
  if (status === 'COMPLETED') return null;

  const labels: Record<string, { text: string; color: string }> = {
    PROCESSING: { text: 'Processing...', color: 'bg-warning/80' },
    PENDING: { text: 'Queued', color: 'bg-white/50' },
    FAILED: { text: 'Failed', color: 'bg-danger/80' },
  };

  const label = labels[status] || labels.PENDING;

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
      <span className={`${label.color} text-white text-xs px-3 py-1 rounded-full font-medium`}>
        {label.text}
      </span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
