import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const AVATARS: Record<string, string> = {
  'Spartan-117': '🎖️', 'xNova': '⚡', 'ShadowFox': '🦊',
  'PhantomAce': '🃏', 'BlockSmith': '🧱', 'ViperStrike': '🐍',
  'Demo Streamer': '🎮',
};

const GAME_TAGS: Record<string, string> = {
  'Halo': 'bg-green-600/20 text-green-400',
  'Fortnite': 'bg-purple-600/20 text-purple-400',
  'Rocket League': 'bg-blue-600/20 text-blue-400',
  'Valorant': 'bg-red-600/20 text-red-400',
  'Minecraft': 'bg-emerald-600/20 text-emerald-400',
  'Apex': 'bg-orange-600/20 text-orange-400',
  'Breakout': 'bg-cyan-600/20 text-cyan-400',
};

function extractGame(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes('halo')) return 'Halo';
  if (t.includes('fortnite')) return 'Fortnite';
  if (t.includes('rocket')) return 'Rocket League';
  if (t.includes('valorant')) return 'Valorant';
  if (t.includes('minecraft')) return 'Minecraft';
  if (t.includes('apex')) return 'Apex';
  if (t.includes('breakout')) return 'Breakout';
  return null;
}

export default async function BrowsePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [liveStreams, allStreams, highlights] = await Promise.all([
    prisma.stream.findMany({
      where: { orgId: session.orgId, status: 'LIVE' },
      orderBy: { startedAt: 'desc' },
      take: 5,
    }),
    prisma.stream.findMany({
      where: { orgId: session.orgId, status: { in: ['RECORDED', 'ENDED'] } },
      orderBy: { endedAt: 'desc' },
      take: 20,
    }),
    prisma.highlight.findMany({
      where: { orgId: session.orgId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { stream: { select: { title: true, streamerName: true } } },
    }),
  ]);

  const featured = liveStreams[0] || null;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Hero Banner */}
      {featured ? (
        <Link
          href={`/dashboard/watch`}
          className="block rounded-2xl overflow-hidden border border-live/30 bg-gradient-to-r from-live/10 to-surface-200 hover:from-live/15 transition-colors"
        >
          <div className="flex items-center gap-6 p-6 sm:p-8">
            <div className="shrink-0 w-20 h-20 rounded-xl bg-live/20 flex items-center justify-center">
              <span className="text-3xl">{AVATARS[featured.streamerName || ''] || '🎮'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-live animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wide text-live">Live Now</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold truncate">{featured.title || 'Live Stream'}</h2>
              <p className="text-sm text-white/50 mt-1">{featured.streamerName || featured.streamerId}</p>
            </div>
            <span className="shrink-0 rounded-lg bg-live px-5 py-2.5 text-sm font-semibold text-white hidden sm:block">
              Watch Now
            </span>
          </div>
        </Link>
      ) : highlights.length > 0 ? (
        <Link
          href={`/dashboard/highlights/${highlights[0].id}`}
          className="block rounded-2xl overflow-hidden border border-brand-500/20 bg-gradient-to-r from-brand-600/10 to-surface-200 hover:from-brand-600/15 transition-colors"
        >
          <div className="flex items-center gap-6 p-6 sm:p-8">
            <div className="shrink-0 w-20 h-20 rounded-xl bg-brand-600/20 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-brand-400">
                <path d="M12 2l3 7.5h7.5l-6 5.25 2.25 7.5L12 17.25 5.25 22.25 7.5 14.75 1.5 9.5H9L12 2z" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-400 mb-1">Featured Highlight</p>
              <h2 className="text-xl sm:text-2xl font-bold truncate">{highlights[0].title}</h2>
              <p className="text-sm text-white/50 mt-1">
                {highlights[0].stream?.streamerName || 'Unknown'}
                {highlights[0].duration && <> &middot; {fmtDur(highlights[0].duration)}</>}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hidden sm:block">
              Play
            </span>
          </div>
        </Link>
      ) : null}

      {/* Highlights Row */}
      {highlights.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Highlights</h2>
            <Link href="/dashboard/highlights" className="text-xs text-brand-400 hover:underline">See all</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
            {highlights.map((h) => {
              return (
                <Link
                  key={h.id}
                  href={`/dashboard/highlights/${h.id}`}
                  className="shrink-0 w-56 rounded-xl overflow-hidden border border-white/10 bg-surface-100 hover:border-brand-500/50 hover:scale-[1.02] transition-all group"
                >
                  <div className="aspect-video bg-surface-300 flex items-center justify-center relative">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white/8 group-hover:text-white/15 transition-colors">
                      <path d="M12 2l3 7.5h7.5l-6 5.25 2.25 7.5L12 17.25 5.25 22.25 7.5 14.75 1.5 9.5H9L12 2z" fill="currentColor" />
                    </svg>
                    {h.duration && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {fmtDur(h.duration)}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate group-hover:text-brand-400 transition-colors">{h.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm">{AVATARS[h.stream?.streamerName || ''] || '🎮'}</span>
                      <span className="text-xs text-white/40 truncate">{h.stream?.streamerName || 'Unknown'}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Live Streams */}
      {liveStreams.length > 1 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-live animate-pulse" />
              Live Streams
            </h2>
            <Link href="/dashboard/streams" className="text-xs text-brand-400 hover:underline">See all</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {liveStreams.slice(1).map((s) => (
              <Link
                key={s.id}
                href="/dashboard/watch"
                className="rounded-xl overflow-hidden border border-live/20 bg-surface-100 hover:border-live/50 hover:scale-[1.02] transition-all group"
              >
                <div className="aspect-video bg-surface-300 flex items-center justify-center relative">
                  <span className="text-live text-xs font-bold">● LIVE</span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{s.title || 'Live Stream'}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm">{AVATARS[s.streamerName || ''] || '🎮'}</span>
                    <span className="text-xs text-white/40">{s.streamerName || s.streamerId}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Streams Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Recent Streams</h2>
          <Link href="/dashboard/streams" className="text-xs text-brand-400 hover:underline">See all</Link>
        </div>
        {allStreams.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-12 text-center">
            <p className="text-white/30 text-sm">No recordings yet. Start streaming with the SDK!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {allStreams.map((s) => {
              const game = extractGame(s.title);
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/streams/${s.id}`}
                  className="rounded-xl overflow-hidden border border-white/10 bg-surface-100 hover:border-white/25 hover:scale-[1.02] transition-all group"
                >
                  <div className="aspect-video bg-surface-300 flex items-center justify-center relative">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white/8 group-hover:text-white/15 transition-colors">
                      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
                    </svg>
                    {s.durationSecs && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {fmtDur(s.durationSecs)}
                      </span>
                    )}
                    {game && (
                      <span className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${GAME_TAGS[game] || 'bg-white/10 text-white/40'}`}>
                        {game}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate group-hover:text-brand-400 transition-colors">{s.title || 'Untitled Stream'}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{AVATARS[s.streamerName || ''] || '🎮'}</span>
                        <span className="text-xs text-white/40 truncate">{s.streamerName || s.streamerId}</span>
                      </div>
                      <span className="text-[10px] text-white/25 shrink-0">{timeAgo(s.endedAt || s.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function fmtDur(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
