import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { GenerateHighlightButton } from './generate-button';

export default async function VodsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const recordings = await prisma.stream.findMany({
    where: {
      orgId: session.orgId,
      status: { in: ['RECORDED', 'ENDED'] },
    },
    orderBy: { endedAt: 'desc' },
    take: 50,
    include: { _count: { select: { highlights: true } } },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Recordings</h1>

      {recordings.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-16 text-center">
          <p className="text-white/30 text-sm">
            No recordings yet. Streams are automatically recorded when they end.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recordings.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden"
            >
              {/* Thumbnail / Placeholder */}
              <div className="aspect-video bg-surface-300 flex items-center justify-center relative">
                {r.thumbnailUrl ? (
                  <img src={r.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-white/10">
                    <rect x="4" y="10" width="40" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 18l10 6-10 6V18z" fill="currentColor" />
                  </svg>
                )}
                {r.durationSecs && (
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(r.durationSecs)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium truncate">{r.title || 'Untitled Stream'}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {r.streamerName || r.streamerId}
                    {r.endedAt && <> &middot; {formatDate(r.endedAt)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <GenerateHighlightButton
                    streamId={r.id}
                    orgSlug={session.orgSlug}
                    hasRecording={!!r.recordingUrl}
                    existingHighlights={r._count.highlights}
                  />
                  {r.recordingUrl && (
                    <a
                      href={r.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
