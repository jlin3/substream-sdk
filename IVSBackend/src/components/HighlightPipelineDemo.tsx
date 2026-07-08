'use client';

/**
 * Animated visualization of the Gemini highlight pipeline.
 *
 * Uses the real pipeline output from a Halo Infinite CTF session
 * (same data that powers the dashboard demo): a scan line sweeps the
 * source timeline, segments light up with their Gemini scores as they
 * are "found", then the selected moments collapse into a highlight
 * reel. Loops forever; honors prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from 'react';

const BRAND = '#2B7FFF';

// Real segments from the Halo CTF pipeline run (source: 480s session)
const SOURCE_DURATION = 480;
const SEGMENTS = [
  { start: 107.0, end: 116.1, score: 50, label: 'Player grabs the enemy flag' },
  { start: 184.0, end: 186.1, score: 79, label: 'Sniping an enemy on a moving vehicle' },
  { start: 199.0, end: 201.1, score: 51, label: 'Standard multiplayer firefight' },
  { start: 296.0, end: 298.5, score: 66, label: 'Sniper Rifle kill' },
  { start: 340.0, end: 345.7, score: 59, label: 'Ambushing enemies near a Warthog' },
  { start: 370.0, end: 412.7, score: 50, label: 'Kills and a destroyed vehicle' },
  { start: 426.0, end: 436.8, score: 56, label: 'Active Camo stealth attack' },
];

const STEPS = [
  { name: 'Scene analysis', detail: 'Shot detection, labels, object tracking' },
  { name: 'Audio analysis', detail: 'RMS energy spikes' },
  { name: 'Gemini scoring', detail: '51 segments scored from sampled frames' },
  { name: 'Selection', detail: 'Weighted: Gemini 50% · Video 25% · Audio 25%' },
  { name: 'Assembly', detail: 'FFmpeg crossfades + loudness normalization' },
];

const LOOP_MS = 14000;
const SCAN_END = 0.62; // scan phase share of the loop
const REEL_START = 0.68;

export default function HighlightPipelineDemo() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }
    let start: number | null = null;
    const frame = (t: number) => {
      if (start === null) start = t;
      setProgress(((t - start) % LOOP_MS) / LOOP_MS);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView]);

  const scanT = Math.min(1, progress / SCAN_END); // 0..1 scan position
  const scanTime = scanT * SOURCE_DURATION;
  const reelT = Math.max(0, Math.min(1, (progress - REEL_START) / (1 - REEL_START)));

  const activeStep =
    progress < 0.2 ? 0 : progress < 0.35 ? 1 : progress < SCAN_END ? 2 : progress < REEL_START ? 3 : 4;

  // Currently "found" segment for the label callout
  const foundIdx = SEGMENTS.reduce((acc, s, i) => (scanTime >= s.start ? i : acc), -1);
  const found = foundIdx >= 0 ? SEGMENTS[foundIdx] : null;

  const reelTotal = SEGMENTS.reduce((sum, s) => sum + (s.end - s.start), 0);

  return (
    <div ref={containerRef} className="rounded-2xl border border-white/10 bg-[#0e0e10] p-5 sm:p-7 shadow-xl shadow-black/40 overflow-hidden">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#2B7FFF]/15 border border-[#2B7FFF]/30">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Halo Infinite — CTF session</p>
            <p className="text-[11px] text-white/40 leading-tight">Full recording · 8:00 · analyzed by Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/45 tabular-nums">
          <span className={`size-1.5 rounded-full ${progress < REEL_START ? 'ss-pulse bg-[#2B7FFF]' : 'bg-emerald-400'}`} />
          {progress < REEL_START ? 'Analyzing…' : 'Reel ready'}
        </div>
      </div>

      {/* Source timeline */}
      <div className="relative mb-2">
        <div className="relative h-14 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
          {/* Filmstrip ticks */}
          {Array.from({ length: 32 }, (_, i) => (
            <span key={i} className="absolute top-0 bottom-0 w-px bg-white/[0.04]" style={{ left: `${((i + 1) / 33) * 100}%` }} />
          ))}
          {/* Segments */}
          {SEGMENTS.map((s, i) => {
            const lit = scanTime >= s.start;
            return (
              <div
                key={i}
                className="absolute top-1.5 bottom-1.5 rounded-[3px] transition-all duration-500"
                style={{
                  left: `${(s.start / SOURCE_DURATION) * 100}%`,
                  width: `${Math.max(0.8, ((s.end - s.start) / SOURCE_DURATION) * 100)}%`,
                  background: lit ? `rgba(43,127,255,${0.35 + (s.score / 100) * 0.55})` : 'rgba(255,255,255,0.07)',
                  boxShadow: lit ? '0 0 12px rgba(43,127,255,0.5)' : 'none',
                }}
              />
            );
          })}
          {/* Scan line */}
          {progress < SCAN_END && (
            <div className="absolute top-0 bottom-0 w-[2px]" style={{ left: `${scanT * 100}%`, background: BRAND, boxShadow: `0 0 14px 2px ${BRAND}` }}>
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 size-1.5 rounded-full" style={{ background: BRAND }} />
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-mono text-white/30 tabular-nums">
          <span>0:00</span>
          <span>full session</span>
          <span>8:00</span>
        </div>
      </div>

      {/* Found-segment callout */}
      <div className="h-9 mb-4 flex items-center">
        <div
          key={foundIdx}
          className="flex items-center gap-2 transition-all duration-300"
          style={{ opacity: found && progress < REEL_START ? 1 : 0 }}
        >
          {found && (
            <>
              <span className="rounded-md border border-[#2B7FFF]/40 bg-[#2B7FFF]/15 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#7EB1FF] tabular-nums">
                {found.score}
              </span>
              <span className="text-xs text-white/70">{found.label}</span>
              <span className="text-[10px] font-mono text-white/30 tabular-nums">
                {`${Math.floor(found.start / 60)}:${String(Math.floor(found.start % 60)).padStart(2, '0')}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow + reel */}
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Highlight reel</p>
        <span className="text-[10px] font-mono text-white/30 tabular-nums">{Math.round(reelTotal)}s from 480s · 7 clips</span>
      </div>
      <div className="flex gap-1.5 h-11 mb-6">
        {SEGMENTS.map((s, i) => {
          const appear = Math.max(0, Math.min(1, reelT * SEGMENTS.length - i));
          return (
            <div
              key={i}
              className="relative rounded-md border border-[#2B7FFF]/35 overflow-hidden"
              style={{
                flex: `${s.end - s.start} 1 0`,
                minWidth: 18,
                opacity: appear,
                transform: `translateY(${(1 - appear) * 14}px) scale(${0.85 + appear * 0.15})`,
                transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)',
                background: `linear-gradient(135deg, rgba(43,127,255,${0.25 + (s.score / 100) * 0.4}), rgba(43,127,255,0.1))`,
              }}
              title={s.label}
            >
              <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-white/70 tabular-nums">
                {(s.end - s.start).toFixed(0)}s
              </span>
            </div>
          );
        })}
      </div>

      {/* Pipeline steps */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STEPS.map((st, i) => {
          const active = i === activeStep;
          const done = i < activeStep;
          return (
            <div
              key={st.name}
              className="rounded-lg border px-2.5 py-2 transition-all duration-500"
              style={{
                borderColor: active ? 'rgba(43,127,255,0.5)' : 'rgba(255,255,255,0.08)',
                background: active ? 'rgba(43,127,255,0.08)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`size-1.5 rounded-full ${active ? 'ss-pulse' : ''}`}
                  style={{ background: done ? '#34d399' : active ? BRAND : 'rgba(255,255,255,0.2)' }}
                />
                <span className={`text-[11px] font-semibold ${active || done ? 'text-white/90' : 'text-white/40'}`}>{st.name}</span>
              </div>
              <p className="text-[9px] leading-snug text-white/35">{st.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
