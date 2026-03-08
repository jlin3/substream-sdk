'use client';

import Script from 'next/script';
import Link from 'next/link';
import { useRef, useEffect, useState, useCallback } from 'react';

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
  const [streamInfo, setStreamInfo] = useState<{ streamId: string; dashboardUrl: string } | null>(null);
  const [status, setStatus] = useState<{ text: string; type: 'info' | 'live' | 'error' }>({
    text: 'Load complete. Click "Start Streaming" to go live.', type: 'info',
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = useCallback((msg: string, level = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev.slice(-100), { msg, level, ts }]);
  }, []);

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
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

    function initBlocks() {
      const blocks: typeof gameStateRef.current extends null ? never : NonNullable<typeof gameStateRef.current>['blocks'] = [];
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
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, W, H);

      for (const b of state.blocks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
      }

      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.roundRect(state.paddleX, paddleY, paddleW, paddleH, 8);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 15;
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

      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Score: ' + state.score, 20, 35);

      if (sessionRef.current?.isLive) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(W - 30, 30, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '14px system-ui';
        ctx.fillText('LIVE', W - 70, 35);
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
          childId: 'demo-child-001', orgId: 'org-livewave-demo',
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
          setStatus({ text: 'LIVE — Streaming to viewers', type: 'live' });
          if (sessionRef.current) sessionRef.current.isLive = true;
        }
      });

      log('Joining IVS stage...');
      await stage.join();
      log('Publishing to IVS Real-Time', 'ok');

      sessionRef.current = { streamId: info.streamId, viewerUrl: info.viewerUrl, stage, canvasStream: stream, isLive: true };
      setStreamInfo({ streamId: info.streamId, dashboardUrl: `/dashboard/streams/${info.streamId}` });
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
    setStreaming(false); setConnecting(false);
    setStatus({ text: 'Stream stopped. Start again anytime.', type: 'info' });
  }

  const logColors: Record<string, string> = { ok: 'text-green-400', err: 'text-red-400', warn: 'text-yellow-300', info: 'text-blue-300' };

  return (
    <div className="min-h-screen bg-surface-50 text-white">
      <Script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js" onLoad={() => setSdkLoaded(true)} />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-brand-400">live</span>wave
        </Link>
        <Link href="/login" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 transition-colors">
          Open Dashboard
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">SDK Demo</h1>
          <p className="text-sm text-white/50 mt-1">
            This Breakout game uses the Substream SDK to stream its canvas via WebRTC.
            The same integration works with Unity WebGL, Phaser, Three.js, PixiJS, and any canvas-based engine.
          </p>
        </div>

        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Game */}
          <div className="flex-1 min-w-0 space-y-3">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full rounded-xl border-2 border-white/10 bg-surface-200 cursor-crosshair"
            />

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={startStreaming}
                disabled={streaming || connecting || !sdkLoaded}
                className="rounded-lg bg-green-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {connecting ? 'Connecting...' : 'Start Streaming'}
              </button>
              <button
                onClick={stopStreaming}
                disabled={!streaming}
                className="rounded-lg bg-red-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Stop Streaming
              </button>
              {!sdkLoaded && <span className="text-xs text-white/30">Loading IVS SDK...</span>}
            </div>

            {/* Status */}
            <div className={`rounded-lg px-4 py-2.5 text-sm text-center ${
              status.type === 'live' ? 'bg-green-900/40 text-green-300' :
              status.type === 'error' ? 'bg-red-900/40 text-red-300' :
              'bg-blue-900/30 text-blue-300'
            }`}>
              {status.text}
            </div>

            {/* Dashboard link */}
            {streamInfo && (
              <div className="rounded-lg border border-brand-500/30 bg-brand-600/10 px-4 py-3 text-sm space-y-1">
                <p className="text-brand-400 font-medium">Stream is live on the dashboard</p>
                <Link href={streamInfo.dashboardUrl} className="text-brand-300 hover:underline text-xs">
                  {window.location.origin}{streamInfo.dashboardUrl}
                </Link>
              </div>
            )}
          </div>

          {/* Log panel */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden h-full flex flex-col">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Event Log</span>
                <button onClick={() => setLogs([])} className="text-xs text-white/30 hover:text-white">Clear</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 min-h-[300px] max-h-[500px]">
                {logs.length === 0 ? (
                  <p className="text-white/20">Waiting for events...</p>
                ) : logs.map((l, i) => (
                  <div key={i} className={logColors[l.level] || 'text-white/50'}>
                    <span className="text-white/20">[{l.ts}]</span> {l.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
