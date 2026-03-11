'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const IvsRealTimeViewer = dynamic(
  () => import('@/components/IvsRealTimeViewer'),
  { ssr: false, loading: () => <div className="aspect-video bg-black flex items-center justify-center"><p className="text-white/30 text-sm">Loading live viewer...</p></div> },
);

// ─── Types ───────────────────────────────────────────────────

interface LiveStream {
  id: string; title: string | null; streamerName: string | null;
  streamerId: string; status: string; ivsStageArn: string | null; startedAt: string | null;
}
interface Recording {
  id: string; title: string | null; streamerName: string | null;
  streamerId: string; status: string; recordingUrl: string | null;
  durationSecs: number | null; endedAt: string | null;
}
interface HighlightItem {
  id: string; title: string; videoUrl: string | null;
  duration: number | null; status: string;
  streamTitle: string | null; streamerName: string | null; createdAt: string;
}
interface Comment { id: string; name: string; text: string; time: string; avatar: string; }
interface FloatingReaction { id: number; emoji: string; x: number; }
interface ViewerToken { subscribeToken: string; stageArn: string; participantId: string; }

type NowPlaying = {
  type: 'live' | 'recording' | 'highlight';
  id: string; title: string; streamer: string;
  url: string | null; stageArn?: string | null; duration?: number | null;
};

// ─── Constants ───────────────────────────────────────────────

const REACTIONS = [
  { emoji: '🔥', label: 'fire' }, { emoji: '💯', label: '100' },
  { emoji: '👏', label: 'clap' }, { emoji: '❤️', label: 'heart' },
  { emoji: '💀', label: 'skull' }, { emoji: '😂', label: 'laugh' },
];

const SEED_COMMENTS: Comment[] = [
  { id: 'c1', name: 'Mom', text: 'That sniper shot was insane!', time: '2m ago', avatar: '👩' },
  { id: 'c2', name: 'Dad', text: 'Nice flag capture 💪', time: '5m ago', avatar: '👨' },
  { id: 'c3', name: 'Coach Rivera', text: 'Great teamwork on that last play', time: '12m ago', avatar: '🧑‍🏫' },
  { id: 'c4', name: 'Grandpa', text: 'I have no idea what\'s happening but GO!!!', time: '15m ago', avatar: '👴' },
];

// ─── Component ───────────────────────────────────────────────

export function WatchPlayer({
  liveStreams: initialLive,
  recordings,
  highlights,
  orgSlug,
}: {
  liveStreams: LiveStream[];
  recordings: Recording[];
  highlights: HighlightItem[];
  orgSlug: string;
}) {
  const completedHighlights = highlights.filter((h) => h.status === 'COMPLETED' && h.videoUrl);

  // ── State ──

  const [liveStreams, setLiveStreams] = useState(initialLive);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(() => {
    if (initialLive.length > 0) {
      const s = initialLive[0];
      return { type: 'live', id: s.id, title: s.title || 'Live Stream', streamer: s.streamerName || s.streamerId, url: null, stageArn: s.ivsStageArn };
    }
    if (completedHighlights.length > 0) {
      const h = completedHighlights[0];
      return { type: 'highlight', id: h.id, title: h.title, streamer: h.streamerName || '', url: h.videoUrl, duration: h.duration };
    }
    if (recordings.length > 0) {
      const r = recordings[0];
      return { type: 'recording', id: r.id, title: r.title || 'Recording', streamer: r.streamerName || r.streamerId, url: r.recordingUrl, duration: r.durationSecs };
    }
    return null;
  });
  const [viewerToken, setViewerToken] = useState<ViewerToken | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>(SEED_COMMENTS);
  const [commentInput, setCommentInput] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const reactionIdRef = useRef(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // ── Poll for live streams every 5s ──

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgSlug}/streams?status=LIVE&limit=5`);
        if (!res.ok) return;
        const data = await res.json();
        const newLive: LiveStream[] = (data.streams || []).map((s: Record<string, unknown>) => ({
          id: s.id, title: s.title, streamerName: s.streamerName,
          streamerId: s.streamerId, status: s.status,
          ivsStageArn: s.ivsStageArn, startedAt: s.startedAt,
        }));
        setLiveStreams(newLive);

        // Auto-switch to live stream when one appears and we're not already watching live
        if (newLive.length > 0) {
          setNowPlaying((prev) => {
            if (prev?.type === 'live') return prev;
            const s = newLive[0];
            return { type: 'live', id: s.id, title: s.title || 'Live Stream', streamer: s.streamerName || s.streamerId, url: null, stageArn: s.ivsStageArn };
          });
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [orgSlug]);

  // ── Fetch viewer token when a live stream is selected ──

  useEffect(() => {
    if (nowPlaying?.type !== 'live') { setViewerToken(null); setViewerError(null); return; }
    let cancelled = false;
    async function fetchToken() {
      setViewerToken(null); setViewerError(null);
      try {
        const res = await fetch(`/api/streams/${nowPlaying!.id}/viewer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentUserId: 'watch-viewer' }),
        });
        if (cancelled) return;
        if (!res.ok) { setViewerError('Could not connect to live stream'); return; }
        const data = await res.json();
        setViewerToken(data);
      } catch { if (!cancelled) setViewerError('Failed to connect'); }
    }
    fetchToken();
    return () => { cancelled = true; };
  }, [nowPlaying?.type === 'live' ? nowPlaying?.id : null]);

  // ── Reactions ──

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  const addReaction = useCallback((emoji: string) => {
    const id = reactionIdRef.current++;
    const x = 20 + Math.random() * 60;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2000);
  }, []);

  function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim()) return;
    setComments((prev) => [...prev, { id: `c-${Date.now()}`, name: 'You', text: commentInput.trim(), time: 'just now', avatar: '😎' }]);
    setCommentInput('');
  }

  // ── Selection handlers ──

  function selectHighlight(h: HighlightItem) {
    setNowPlaying({ type: 'highlight', id: h.id, title: h.title, streamer: h.streamerName || '', url: h.videoUrl, duration: h.duration });
  }
  function selectRecording(r: Recording) {
    setNowPlaying({ type: 'recording', id: r.id, title: r.title || 'Recording', streamer: r.streamerName || r.streamerId, url: r.recordingUrl, duration: r.durationSecs });
  }
  function selectLive(s: LiveStream) {
    setNowPlaying({ type: 'live', id: s.id, title: s.title || 'Live Stream', streamer: s.streamerName || s.streamerId, url: null, stageArn: s.ivsStageArn });
  }

  // ── Render ──

  const isLive = nowPlaying?.type === 'live';

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ── Player area ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Video */}
          <div className="relative bg-black">
            {nowPlaying ? (
              isLive ? (
                viewerToken ? (
                  <IvsRealTimeViewer
                    token={viewerToken.subscribeToken}
                    stageArn={viewerToken.stageArn}
                    participantId={viewerToken.participantId}
                  />
                ) : viewerError ? (
                  <div className="aspect-video flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-live animate-pulse" />
                        <span className="text-live font-semibold">LIVE</span>
                      </div>
                      <p className="text-white/40 text-sm">{viewerError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="w-6 h-6 border-2 border-live border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-white/40 text-sm">Connecting to live stream...</p>
                    </div>
                  </div>
                )
              ) : nowPlaying.url ? (
                <video key={nowPlaying.id} src={nowPlaying.url} controls autoPlay className="w-full aspect-video" />
              ) : (
                <div className="aspect-video flex items-center justify-center">
                  <p className="text-white/20 text-sm">No playable video available</p>
                </div>
              )
            ) : (
              /* ── Empty state: prompt to start streaming ── */
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-brand-400">
                      <rect x="3" y="7" width="26" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                      <path d="M13 12l8 4.5-8 4.5V12z" fill="currentColor" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/60 font-medium">No one is streaming yet</p>
                    <p className="text-white/30 text-sm mt-1">Start a stream from the game demo and it will appear here automatically.</p>
                  </div>
                  <a
                    href="/demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold hover:bg-brand-500 transition-colors"
                  >
                    Open Game Demo
                  </a>
                </div>
              </div>
            )}

            {/* Floating reactions overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {floatingReactions.map((r) => (
                <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%`, bottom: 0 }}>{r.emoji}</span>
              ))}
            </div>
          </div>

          {/* Now Playing info bar */}
          {nowPlaying && (
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm truncate">{nowPlaying.title}</h2>
                  {isLive && <span className="text-xs px-1.5 py-0.5 rounded bg-live/20 text-live font-medium shrink-0">● LIVE</span>}
                  {nowPlaying.type === 'highlight' && <span className="text-xs px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-400 font-medium shrink-0">Highlight</span>}
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  {nowPlaying.streamer}{nowPlaying.duration ? ` · ${fmtDur(nowPlaying.duration)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {nowPlaying.type === 'highlight' && (
                  <Link href={`/dashboard/highlights/${nowPlaying.id}`} className="text-xs text-brand-400 hover:underline">View Analysis</Link>
                )}
                {!isLive && liveStreams.length === 0 && (
                  <a href="/demo" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline">Start a stream</a>
                )}
              </div>
            </div>
          )}

          {/* ── Live streams banner ── */}
          {liveStreams.length > 0 && !isLive && (
            <button
              onClick={() => selectLive(liveStreams[0])}
              className="mx-4 mt-3 flex items-center gap-3 rounded-lg bg-live/10 border border-live/30 px-4 py-3 hover:bg-live/20 transition-colors text-left"
            >
              <span className="w-3 h-3 rounded-full bg-live animate-pulse shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-live">Live Now: {liveStreams[0].title || 'Live Stream'}</p>
                <p className="text-xs text-white/40">{liveStreams[0].streamerName || liveStreams[0].streamerId} — tap to watch</p>
              </div>
            </button>
          )}

          {/* ── Highlights carousel ── */}
          {completedHighlights.length > 0 && (
            <div className="px-4 py-4 border-b border-white/10">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Highlights</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                {completedHighlights.map((h) => (
                  <button key={h.id} onClick={() => selectHighlight(h)} className={`shrink-0 w-44 rounded-lg overflow-hidden border transition-colors text-left ${nowPlaying?.id === h.id ? 'border-brand-500 bg-brand-600/10' : 'border-white/10 bg-surface-200 hover:border-white/20'}`}>
                    <div className="aspect-video bg-surface-300 flex items-center justify-center relative">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/10"><path d="M12 2l3 7.5h7.5l-6 5.25 2.25 7.5L12 17.25 5.25 22.25 7.5 14.75 1.5 9.5H9L12 2z" fill="currentColor" /></svg>
                      {h.duration && <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded">{fmtDur(h.duration)}</span>}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{h.title}</p>
                      <p className="text-[10px] text-white/30 mt-0.5 truncate">{h.streamTitle || 'Unknown'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Recordings grid ── */}
          <div className="px-4 py-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Recordings</h3>
            {recordings.length === 0 ? (
              <p className="text-xs text-white/20">No recordings yet.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {recordings.map((r) => (
                  <button key={r.id} onClick={() => selectRecording(r)} className={`rounded-lg overflow-hidden border transition-colors text-left ${nowPlaying?.id === r.id ? 'border-brand-500 bg-brand-600/10' : 'border-white/10 bg-surface-200 hover:border-white/20'}`}>
                    <div className="aspect-video bg-surface-300 flex items-center justify-center relative">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/10"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" /></svg>
                      {r.durationSecs && <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded">{fmtDur(r.durationSecs)}</span>}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{r.title || 'Untitled'}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{r.streamerName || r.streamerId}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Comments + Reactions sidebar ── */}
        <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col bg-surface-100">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between gap-1">
              {REACTIONS.map((r) => (
                <button key={r.label} onClick={() => addReaction(r.emoji)} className="flex-1 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors text-lg active:scale-110" title={r.label}>{r.emoji}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <span className="text-lg shrink-0 mt-0.5">{c.avatar}</span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold">{c.name}</span>
                    <span className="text-[10px] text-white/20">{c.time}</span>
                  </div>
                  <p className="text-xs text-white/60 mt-0.5">{c.text}</p>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>
          <form onSubmit={addComment} className="px-4 py-3 border-t border-white/10">
            <div className="flex gap-2">
              <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs placeholder:text-white/20 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button type="submit" disabled={!commentInput.trim()} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium hover:bg-brand-500 transition-colors disabled:opacity-30">Send</button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
