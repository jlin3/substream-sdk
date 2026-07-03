'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * The one REAL moment inside the simulated demo: a live source that
 * publishes to AWS IVS Real-Time through the actual Substream pipeline,
 * so the prospect's "stream" plays back in their branded player via a
 * real WebRTC viewer.
 *
 * Two capture modes:
 * - 'game'   — a playable canvas Breakout (gaming vertical)
 * - 'screen' — getDisplayMedia screen share (music/sports event verticals)
 */

interface IvsStage {
  join: () => Promise<void>;
  leave: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

interface IvsClient {
  Stage: new (token: string, strategy: unknown) => IvsStage;
  LocalStageStream: new (track: MediaStreamTrack) => unknown;
  SubscribeType: { NONE: string };
  StageEvents: { STAGE_CONNECTION_STATE_CHANGED: string };
}

function getIvs(): IvsClient | undefined {
  return (window as unknown as { IVSBroadcastClient?: IvsClient }).IVSBroadcastClient;
}

export interface GoLiveSession {
  streamId: string;
  viewerUrl: string;
}

export default function GoLivePanel({
  accent,
  brandName,
  playerName,
  sdkLoaded,
  mode = 'game',
  onLive,
  onStopped,
}: {
  accent: string;
  brandName: string;
  playerName: string;
  sdkLoaded: boolean;
  mode?: 'game' | 'screen';
  onLive: (session: GoLiveSession) => void;
  onStopped: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<{ streamId: string; stage: IvsStage; canvasStream: MediaStream } | null>(null);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Compact Breakout, themed with the demo site's accent color
  useEffect(() => {
    if (mode !== 'game') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1280, H = 720;
    const paddleW = 130, paddleH = 16, paddleY = H - 44;
    const rows = 5, cols = 10;
    const blockW = (W - 40) / cols, blockH = 26, pad = 4;

    type Block = { x: number; y: number; alive: boolean; alpha: number };
    const initBlocks = (): Block[] => {
      const blocks: Block[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          blocks.push({ x: 20 + c * blockW, y: 64 + r * (blockH + pad), alive: true, alpha: 1 - r * 0.14 });
      return blocks;
    };

    const state = {
      paddleX: W / 2 - paddleW / 2, ballX: W / 2, ballY: H / 2,
      ballDX: 4.5, ballDY: -4.5, score: 0, blocks: initBlocks(),
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.paddleX = Math.max(0, Math.min(W - paddleW, (e.clientX - rect.left) * (W / rect.width) - paddleW / 2));
    };
    canvas.addEventListener('mousemove', onMove);

    let raf: number;
    const loop = () => {
      ctx.fillStyle = '#0e0e10';
      ctx.fillRect(0, 0, W, H);

      for (const b of state.blocks) {
        if (!b.alive) continue;
        ctx.globalAlpha = Math.max(0.35, b.alpha);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, blockW - pad, blockH, 5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(state.paddleX, paddleY, paddleW, paddleH, 8);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.shadowColor = accent; ctx.shadowBlur = 16;
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
        state.ballDX = ((state.ballX - state.paddleX) / paddleW - 0.5) * 9;
      }

      for (const b of state.blocks) {
        if (!b.alive) continue;
        if (state.ballX + 10 > b.x && state.ballX - 10 < b.x + blockW - pad && state.ballY + 10 > b.y && state.ballY - 10 < b.y + blockH) {
          b.alive = false; state.ballDY = -state.ballDY; state.score += 10;
        }
      }

      if (state.ballY - 10 > H) {
        state.ballX = W / 2; state.ballY = H / 2;
        state.ballDX = 4.5 * (Math.random() > 0.5 ? 1 : -1); state.ballDY = -4.5;
      }
      if (state.blocks.every((b) => !b.alive)) {
        state.blocks = initBlocks();
        state.ballDX *= 1.08; state.ballDY *= 1.08;
      }

      ctx.fillStyle = '#fff';
      ctx.font = '600 22px system-ui';
      ctx.fillText(`${brandName} · Score ${state.score}`, 20, 40);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('mousemove', onMove); };
  }, [accent, brandName, mode]);

  const stop = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setPhase('idle');
    onStopped();
    if (!session) return;
    session.canvasStream.getTracks().forEach((t) => t.stop());
    try { session.stage.leave(); } catch { /* already gone */ }
    try {
      await fetch('/api/streams/web-publish', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
        body: JSON.stringify({ streamId: session.streamId }),
      });
    } catch { /* non-critical */ }
  }, [onStopped]);

  // stop the stream if the panel unmounts (e.g. user closes it while live)
  useEffect(() => () => { if (sessionRef.current) void stop(); }, [stop]);

  async function start() {
    const ivs = getIvs();
    if (!ivs || (mode === 'game' && !canvasRef.current)) {
      setErrorMsg('Streaming SDK still loading — try again in a second.');
      setPhase('error');
      return;
    }
    setPhase('connecting');
    setErrorMsg('');

    // Capture the source first (screen share needs a user-gesture prompt)
    let canvasStream: MediaStream;
    try {
      if (mode === 'screen') {
        canvasStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = canvasStream;
          void videoRef.current.play().catch(() => {});
        }
        // browser-level "stop sharing" button should end the stream too
        canvasStream.getVideoTracks()[0]?.addEventListener('ended', () => void stop());
      } else {
        canvasStream = canvasRef.current!.captureStream(30);
      }
    } catch {
      setErrorMsg('Screen share was cancelled or blocked.');
      setPhase('error');
      return;
    }

    try {
      const res = await fetch('/api/streams/web-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
        body: JSON.stringify({
          childId: 'demo-child-001',
          orgId: 'org-substream-demo',
          streamerName: playerName,
          title: `${playerName} live on ${brandName}`,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const info = await res.json();
      const { Stage, LocalStageStream, SubscribeType, StageEvents } = ivs;
      const localStreams = canvasStream.getTracks().map((t) => new LocalStageStream(t));
      const strategy = {
        stageStreamsToPublish: () => localStreams,
        shouldPublishParticipant: () => true,
        shouldSubscribeToParticipant: () => SubscribeType.NONE,
      };
      const stage = new Stage(info.publishToken, strategy);
      stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, (...args: unknown[]) => {
        if ((args[0] as string) === 'connected') {
          setPhase('live');
          onLive({ streamId: info.streamId, viewerUrl: info.viewerUrl });
        }
      });
      await stage.join();
      sessionRef.current = { streamId: info.streamId, stage, canvasStream };
    } catch (err) {
      canvasStream.getTracks().forEach((t) => t.stop());
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start stream');
      setPhase('error');
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-white/10">
        {mode === 'game' ? (
          <canvas ref={canvasRef} width={1280} height={720} className="w-full bg-[#0e0e10] cursor-crosshair block" />
        ) : (
          <div className="relative w-full aspect-video bg-[#0e0e10]">
            <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-contain" />
            {phase === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <span className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl">🖥</span>
                <p className="text-sm text-white/40 max-w-xs">
                  Share your screen and it becomes a live broadcast on {brandName} — through the real pipeline.
                </p>
              </div>
            )}
          </div>
        )}
        {phase === 'live' && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white bg-red-600">
            <span className="size-1.5 rounded-full bg-white animate-pulse" /> BROADCASTING
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {phase !== 'live' ? (
          <button
            onClick={start}
            disabled={phase === 'connecting' || !sdkLoaded}
            className="inline-flex items-center justify-center h-10 rounded-full px-5 text-sm font-semibold text-white active:scale-95 transition-all disabled:opacity-40"
            style={{ background: accent }}
          >
            {phase === 'connecting' ? 'Connecting…' : !sdkLoaded ? 'Loading SDK…' : mode === 'screen' ? 'Share screen & broadcast' : 'Start broadcasting'}
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center justify-center h-10 rounded-full border border-white/20 px-5 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all"
          >
            End stream
          </button>
        )}
        <p className="text-xs text-white/40 flex-1 min-w-[200px]">
          {mode === 'game' ? 'Move your mouse to play. ' : ''}This is a{' '}
          <span className="text-white/70 font-medium">real WebRTC stream</span> through Substream&apos;s pipeline — not a
          simulation.
        </p>
      </div>
      {phase === 'error' && <p className="text-sm text-red-400">{errorMsg}</p>}
    </div>
  );
}
