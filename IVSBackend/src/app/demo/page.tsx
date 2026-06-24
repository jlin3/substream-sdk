'use client';

import Script from 'next/script';
import Link from 'next/link';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });
const BRAND = '#2B7FFF';

const BACKEND_URL = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://substream-sdk-production.up.railway.app';

declare global {
  interface Window {
    IVSBroadcastClient: {
      Stage: new (token: string, strategy: unknown) => {
        join: () => Promise<void>;
        leave: () => void;
        on: (event: string, cb: (...args: unknown[]) => void) => void;
      };
      LocalStageStream: new (track: MediaStreamTrack) => unknown;
      SubscribeType: { NONE: string };
      StageEvents: {
        STAGE_CONNECTION_STATE_CHANGED: string;
        STAGE_PARTICIPANT_JOINED: string;
      };
    };
  }
}

type LogEntry = { msg: string; level: string; ts: string };

function SubstreamLogo({ className }: { className?: string }) {
  return (
    <svg width="42" height="24" viewBox="0 0 42 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g clipPath="url(#ss_clip)">
        <path d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z" fill={BRAND} />
        <path d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z" fill={BRAND} />
      </g>
      <defs><clipPath id="ss_clip"><rect width="42" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}

const BTN_PRIMARY = 'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_12px_rgba(43,127,255,0.4)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 active:scale-95 transition-all ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2B7FFF]';
const BTN_OUTLINE = 'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out disabled:opacity-40 disabled:cursor-not-allowed';

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

function Icon({ name }: { name: string }) {
  const c = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: BRAND, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'data': return <svg {...c}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case 'spark': return <svg {...c}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>;
    case 'cash': return <svg {...c}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case 'users': return <svg {...c}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    default: return null;
  }
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: shown ? 1 : 0, transform: shown ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

export default function DemoPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<{
    paddleX: number; ballX: number; ballY: number;
    ballDX: number; ballDY: number; score: number;
    blocks: { x: number; y: number; w: number; h: number; color: string; alive: boolean }[];
  } | null>(null);
  const sessionRef = useRef<{
    streamId: string; viewerUrl: string;
    stage: { leave: () => void }; canvasStream: MediaStream; isLive: boolean;
  } | null>(null);

  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [streamInfo, setStreamInfo] = useState<{ streamId: string; dashboardUrl: string; viewerUrl: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<{ text: string; type: 'info' | 'live' | 'error' }>({
    text: 'Press Start Streaming to go live.', type: 'info',
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = useCallback((msg: string, level = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev.slice(-100), { msg, level, ts }]);
  }, []);

  // elapsed timer while live
  useEffect(() => {
    if (!streaming) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [streaming]);

  // Breakout game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    const W = 1280, H = 720;
    const paddleW = 120, paddleH = 16, paddleY = H - 40;
    const blockRows = 5, blockCols = 10;
    const blockW = (W - 40) / blockCols, blockH = 24, blockPad = 4;
    const colors = ['#2B7FFF', '#4f93ff', '#7aacff', '#22d3ee', '#a855f7'];

    function initBlocks() {
      const blocks: NonNullable<typeof gameStateRef.current>['blocks'] = [];
      for (let r = 0; r < blockRows; r++)
        for (let c = 0; c < blockCols; c++)
          blocks.push({ x: 20 + c * blockW, y: 60 + r * (blockH + blockPad), w: blockW - blockPad, h: blockH, color: colors[r], alive: true });
      return blocks;
    }

    const state = {
      paddleX: W / 2 - 60, ballX: W / 2, ballY: H / 2,
      ballDX: 4, ballDY: -4, score: 0, blocks: initBlocks(),
    };
    gameStateRef.current = state;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.paddleX = Math.max(0, Math.min(W - paddleW, (e.clientX - rect.left) * (W / rect.width) - paddleW / 2));
    };
    canvas.addEventListener('mousemove', onMove);

    let raf: number;
    function loop() {
      ctx.fillStyle = '#0e0e10';
      ctx.fillRect(0, 0, W, H);

      for (const b of state.blocks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
      }

      ctx.fillStyle = '#2B7FFF';
      ctx.beginPath();
      ctx.roundRect(state.paddleX, paddleY, paddleW, paddleH, 8);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#2B7FFF'; ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      state.ballX += state.ballDX;
      state.ballY += state.ballDY;
      if (state.ballX - 10 < 0 || state.ballX + 10 > W) state.ballDX = -state.ballDX;
      if (state.ballY - 10 < 0) state.ballDY = -state.ballDY;

      if (state.ballY + 10 >= paddleY && state.ballY + 10 <= paddleY + paddleH + 8 && state.ballX >= state.paddleX && state.ballX <= state.paddleX + paddleW) {
        state.ballDY = -Math.abs(state.ballDY);
        state.ballDX = ((state.ballX - state.paddleX) / paddleW - 0.5) * 8;
      }

      for (const b of state.blocks) {
        if (!b.alive) continue;
        if (state.ballX + 10 > b.x && state.ballX - 10 < b.x + b.w && state.ballY + 10 > b.y && state.ballY - 10 < b.y + b.h) {
          b.alive = false; state.ballDY = -state.ballDY; state.score += 10;
        }
      }

      if (state.ballY - 10 > H) {
        state.ballX = W / 2; state.ballY = H / 2;
        state.ballDX = 4 * (Math.random() > 0.5 ? 1 : -1); state.ballDY = -4;
      }
      if (state.blocks.every(b => !b.alive)) {
        state.blocks = initBlocks();
        state.ballDX *= 1.1; state.ballDY *= 1.1;
      }

      ctx.fillStyle = '#fff'; ctx.font = '600 20px system-ui';
      ctx.fillText('Score: ' + state.score, 20, 38);

      if (sessionRef.current?.isLive) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(W - 78, 30, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '600 15px system-ui';
        ctx.fillText('LIVE', W - 62, 35);
      }

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('mousemove', onMove); };
  }, []);

  async function startStreaming() {
    if (!window.IVSBroadcastClient) {
      setStatus({ text: 'IVS SDK not loaded yet. Wait a moment and try again.', type: 'error' });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    setConnecting(true);
    setStatus({ text: 'Connecting...', type: 'info' });
    log('Requesting publish token...');

    try {
      const res = await fetch(`${BACKEND_URL}/api/streams/web-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
        body: JSON.stringify({
          childId: 'demo-child-001', orgId: 'org-substream-demo',
          streamerName: 'Demo Player', title: 'Live Breakout Session',
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      const info = await res.json();
      log(`Stream ${info.streamId} created`, 'ok');

      const stream = canvas.captureStream(30);
      log(`Canvas capture started (${stream.getTracks().length} tracks at 30fps)`, 'ok');

      const { Stage, LocalStageStream, SubscribeType, StageEvents } = window.IVSBroadcastClient;
      const localStreams = stream.getTracks().map(t => new LocalStageStream(t));
      const strategy = { stageStreamsToPublish: () => localStreams, shouldPublishParticipant: () => true, shouldSubscribeToParticipant: () => SubscribeType.NONE };
      const stage = new Stage(info.publishToken, strategy);

      stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, (...args: unknown[]) => {
        const state = args[0] as string;
        log(`Stage: ${state}`, state === 'connected' ? 'ok' : 'info');
        if (state === 'connected') {
          setStreaming(true); setConnecting(false);
          setStatus({ text: 'LIVE — streaming to viewers', type: 'live' });
          if (sessionRef.current) sessionRef.current.isLive = true;
        }
      });

      log('Joining IVS stage...');
      await stage.join();
      log('Publishing to IVS Real-Time', 'ok');

      sessionRef.current = { streamId: info.streamId, viewerUrl: info.viewerUrl, stage, canvasStream: stream, isLive: true };
      setStreamInfo({ streamId: info.streamId, dashboardUrl: `/dashboard/streams/${info.streamId}`, viewerUrl: info.viewerUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log(`ERROR: ${msg}`, 'err');
      setStatus({ text: `Error: ${msg}`, type: 'error' });
      setConnecting(false);
    }
  }

  async function stopStreaming() {
    if (!sessionRef.current) return;
    const { streamId, canvasStream, stage } = sessionRef.current;
    canvasStream.getTracks().forEach(t => t.stop());
    try { stage.leave(); } catch { /* */ }
    try {
      await fetch(`${BACKEND_URL}/api/streams/web-publish`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
        body: JSON.stringify({ streamId }),
      });
      log('Stream stopped, backend notified', 'ok');
    } catch { log('Backend stop notification failed (non-critical)', 'warn'); }
    sessionRef.current = null;
    setStreamInfo(null);
    setStreaming(false); setConnecting(false);
    setStatus({ text: 'Stream stopped. Start again anytime.', type: 'info' });
  }

  const logColors: Record<string, string> = { ok: 'text-green-400', err: 'text-red-400', warn: 'text-yellow-300', info: 'text-blue-300' };
  const viewerSrc = streamInfo ? `${BACKEND_URL}/viewer/${streamInfo.streamId}?auth=demo-viewer-token` : null;

  return (
    <div className={`${geist.className} min-h-screen bg-[#18181B] text-[#FAFAFA] tracking-tight`}>
      <Script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js" onLoad={() => setSdkLoaded(true)} />
      <style>{`
        @keyframes ssPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .ss-pulse { animation: ssPulse 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ss-pulse { animation: none !important; } }
      `}</style>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#18181B]/85 backdrop-blur-lg z-30">
        <Link href="/" className="flex items-center gap-2.5">
          <SubstreamLogo className="h-5 w-auto" />
          <span className="text-lg font-semibold">Substream</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">Docs</Link>
          <Link href="/api/auth/demo-auto" className={BTN_PRIMARY + ' h-9'}>Open Dashboard</Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden px-6 pt-14 pb-10 border-b border-white/10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[360px] w-full" style={{ background: 'radial-gradient(120% 100% at 50% 0%, #18181B 55%, rgba(43,127,255,0.25) 100%)' }} />
        <div className="relative z-10 max-w-6xl mx-auto text-center space-y-5">
          <p className="inline-flex h-8 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white/70">
            <span className="ss-pulse size-1.5 rounded-full bg-[#2B7FFF]" />
            Live SDK demo
          </p>
          <h1 className="text-balance text-3xl sm:text-5xl font-medium tracking-tighter leading-[1.05]">
            Your own private Twitch <span className="text-[#2B7FFF]">— live, right here.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-white/55 leading-relaxed">
            Press Start: this Breakout game captures its canvas and goes live over WebRTC, then plays back in the viewer beside it — exactly how it would embed on your own site.
          </p>
        </div>
      </header>

      {/* Live demo */}
      <section className="px-6 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Stat chips */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium ${streaming ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-white/12 bg-white/[0.03] text-white/60'}`}>
              <span className={`size-2 rounded-full ${streaming ? 'bg-red-500 ss-pulse' : 'bg-white/40'}`} />
              {streaming ? 'LIVE' : 'Offline'}
            </span>
            <Chip label="Elapsed" value={fmt(elapsed)} />
            <Chip label="Latency" value="<500ms" />
            <Chip label="Stream" value={streamInfo ? streamInfo.streamId.slice(0, 8) : '—'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Publisher (game) */}
            <div className="space-y-4">
              <Panel label="1 · Your game (publisher)">
                <canvas ref={canvasRef} width={1280} height={720} className="w-full rounded-xl border border-white/10 bg-[#0e0e10] cursor-crosshair" />
              </Panel>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={startStreaming} disabled={streaming || connecting || !sdkLoaded} className={BTN_PRIMARY}>
                  {connecting ? 'Connecting…' : streaming ? 'Streaming' : 'Start Streaming'}
                </button>
                <button onClick={stopStreaming} disabled={!streaming} className={BTN_OUTLINE}>Stop</button>
                {!sdkLoaded && <span className="text-xs text-white/30">Loading SDK…</span>}
              </div>
              <div className={`rounded-xl px-4 py-2.5 text-sm text-center border ${
                status.type === 'live' ? 'border-green-500/30 bg-green-900/30 text-green-300' :
                status.type === 'error' ? 'border-red-500/30 bg-red-900/30 text-red-300' :
                'border-white/10 bg-white/[0.03] text-white/60'
              }`}>{status.text}</div>
            </div>

            {/* Subscriber (viewer on your site) */}
            <div className="space-y-4">
              <Panel label="2 · Live on your site (viewer)">
                <div className="rounded-xl border border-white/10 bg-[#0e0e10] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                    <span className="size-2.5 rounded-full bg-white/15" />
                    <span className="size-2.5 rounded-full bg-white/15" />
                    <span className="size-2.5 rounded-full bg-white/15" />
                    <div className="ml-3 flex-1 rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-white/40 font-mono">yourgame.com/live</div>
                  </div>
                  <div className="relative aspect-video bg-[#0e0e10]">
                    {viewerSrc ? (
                      <iframe key={viewerSrc} src={viewerSrc} title="Live viewer" allow="autoplay; fullscreen" className="absolute inset-0 h-full w-full" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                        <span className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/40">▶</span>
                        <p className="text-sm text-white/40 max-w-xs">Start streaming to watch the game play back here — the same embed your players would see on your site.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
              {streamInfo && (
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <a href={streamInfo.viewerUrl} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + ' h-9'}>Open in new tab</a>
                  <Link href={streamInfo.dashboardUrl} className="text-[#2B7FFF] hover:underline text-sm">Track on dashboard →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Event log */}
          <div className="rounded-2xl border border-white/10 bg-[#0e0e10] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/50">SDK event log</span>
              <button onClick={() => setLogs([])} className="text-xs text-white/30 hover:text-white">Clear</button>
            </div>
            <div className="overflow-y-auto p-3 font-mono text-xs space-y-0.5 max-h-44">
              {logs.length === 0 ? <p className="text-white/20">Waiting for events…</p> : logs.map((l, i) => (
                <div key={i} className={logColors[l.level] || 'text-white/50'}>
                  <span className="text-white/20">[{l.ts}]</span> {l.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What you get with it */}
      <section className="px-6 py-16 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">More than a stream</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">Your platform, your economics</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            <StoryCard icon="data" title="Own your data & content"
              body="Every stream, recording, viewer, and event is yours — in your dashboard and API. Not locked inside Twitch or YouTube."
              href="/api/auth/demo-auto" cta="See the dashboard" />
            <StoryCard icon="spark" title="AI highlight service"
              body="Recordings auto-condense into highlight reels, tuned to your game. Shareable clips that pull new players in."
              href="/dashboard/highlights" cta="See highlights" />
            <StoryCard icon="cash" title="Monetize & grow LTV"
              body="Subscriptions, watch parties, gifting, and clip sales — on your domain. Turn viewers into a community that compounds LTV."
              href="/dashboard/billing" cta="See monetization" />
          </div>

          {/* LTV / community strip */}
          <Reveal delay={120}>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 grid sm:grid-cols-3 gap-6 text-center">
              <Stat icon="users" value="Your community" label="watches on your domain, not a third party" />
              <Stat icon="spark" value="Auto highlights" label="turn one stream into dozens of shareable clips" />
              <Stat icon="cash" value="Recurring revenue" label="subscriptions + gifting compound player LTV" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 px-6 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[320px] w-full" style={{ background: 'radial-gradient(120% 100% at 50% 100%, #18181B 55%, rgba(43,127,255,0.22) 100%)' }} />
        <Reveal className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">Ready to run it on your game?</h2>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/api/auth/demo-auto" className={BTN_PRIMARY}>Explore the dashboard</Link>
            <Link href="/docs" className={BTN_OUTLINE}>Read the docs</Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-white/40">
            <SubstreamLogo className="h-4 w-auto opacity-70" />
            Substream — live streaming infrastructure for games
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-white/40 hover:text-white transition-colors">Home</Link>
            <Link href="/docs" className="text-white/40 hover:text-white transition-colors">Docs</Link>
            <Link href="https://github.com/jlin3/substream-sdk" className="text-white/40 hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-sm">
      <span className="text-white/40">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </span>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">{label}</p>
      {children}
    </div>
  );
}

function StoryCard({ icon, title, body, href, cta }: { icon: string; title: string; body: string; href: string; cta: string }) {
  return (
    <Reveal className="h-full">
      <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04] flex flex-col">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#2B7FFF]/12 border border-[#2B7FFF]/25 transition-transform duration-500 group-hover:scale-110">
          <Icon name={icon} />
        </div>
        <h3 className="font-semibold mb-1.5">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed flex-1">{body}</p>
        <Link href={href} className="mt-4 text-sm text-[#2B7FFF] hover:underline">{cta} →</Link>
      </div>
    </Reveal>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#2B7FFF]/12 border border-[#2B7FFF]/25"><Icon name={icon} /></span>
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-white/45 leading-relaxed max-w-[12rem]">{label}</div>
    </div>
  );
}
