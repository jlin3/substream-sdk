'use client';

/**
 * Hero demo for /sports: a league's own streaming page with a revenue
 * console beside it. Pick a revenue line and the player shows what the
 * fan sees. Pure SVG/CSS, no footage, no network.
 *
 * Everything on screen (teams, score, prices, odds) is illustrative.
 */

import { useEffect, useId, useState } from 'react';
import { BRAND } from '@/components/site/shared';
import { REVENUE_STREAMS, type RevenueKey } from '@/lib/sports';

const CYCLE_MS = 3800;

// ============================================================
// Stylised cricket broadcast frame
// ============================================================

export function PitchScene({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `${name}-${uid}`;
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060a13" />
          <stop offset="1" stopColor="#111c30" />
        </linearGradient>
        <radialGradient id={id('turf')} cx="50%" cy="30%" r="85%">
          <stop offset="0" stopColor="#2f9e57" />
          <stop offset="0.55" stopColor="#1c7340" />
          <stop offset="1" stopColor="#0c371f" />
        </radialGradient>
        <pattern id={id('crowd')} width="6" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="rgba(255,255,255,0.17)" />
          <circle cx="4.5" cy="3.8" r="0.9" fill="rgba(255,255,255,0.09)" />
        </pattern>
        <radialGradient id={id('flood')}>
          <stop offset="0" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <clipPath id={id('ground')}>
          <ellipse cx="160" cy="152" rx="232" ry="96" />
        </clipPath>
      </defs>

      {/* Night sky, stands, floodlights */}
      <rect width="320" height="180" fill={`url(#${id('sky')})`} />
      <rect y="12" width="320" height="46" fill={`url(#${id('crowd')})`} />
      <circle cx="38" cy="10" r="28" fill={`url(#${id('flood')})`} />
      <circle cx="282" cy="10" r="28" fill={`url(#${id('flood')})`} />

      {/* Boundary boards */}
      <rect y="54" width="320" height="8" fill="#0a111d" />
      {[14, 74, 134, 194, 254].map((x) => (
        <rect key={x} x={x} y="55.5" width="46" height="5" rx="1" fill="rgba(255,255,255,0.07)" />
      ))}

      {/* Outfield with mowing stripes */}
      <ellipse cx="160" cy="152" rx="232" ry="96" fill={`url(#${id('turf')})`} />
      <g clipPath={`url(#${id('ground')})`}>
        {Array.from({ length: 11 }).map((_, i) => (
          <rect key={i} x={i * 32 - 8} y="56" width="16" height="130" fill="rgba(255,255,255,0.035)" />
        ))}
      </g>
      <ellipse cx="160" cy="130" rx="124" ry="42" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" strokeDasharray="3 4" />

      {/* Pitch, creases, stumps */}
      <polygon points="149,86 171,86 181,150 139,150" fill="#cdb682" opacity="0.92" />
      <line x1="147" y1="92" x2="173" y2="92" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
      <line x1="140" y1="143" x2="180" y2="143" stroke="rgba(255,255,255,0.85)" strokeWidth="0.9" />
      {[158.4, 160, 161.6].map((x) => (
        <line key={`t${x}`} x1={x} y1="84.5" x2={x} y2="89" stroke="#f4ead0" strokeWidth="0.6" />
      ))}
      {[157.4, 160, 162.6].map((x) => (
        <line key={`b${x}`} x1={x} y1="139" x2={x} y2="147" stroke="#f4ead0" strokeWidth="0.9" />
      ))}

      {/* Players */}
      {[
        [160, 96, 1.4], [152, 142, 2.2], [169, 90, 1.3], [96, 112, 1.6], [226, 118, 1.7],
        [60, 150, 2.1], [262, 156, 2.2], [120, 80, 1.2], [204, 82, 1.2], [160, 70, 1.1],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y + r * 1.9} rx={r * 1.5} ry={r * 0.5} fill="rgba(0,0,0,0.28)" />
          <ellipse cx={x} cy={y} rx={r} ry={r * 1.8} fill="#f8fafc" />
        </g>
      ))}
      {/* Ball */}
      <circle cx="158" cy="118" r="1" fill="#ef4444" />
    </svg>
  );
}

// ============================================================
// Per-revenue-line overlays (what the fan sees)
// ============================================================

function Overlay({ mode }: { mode: RevenueKey }) {
  switch (mode) {
    case 'ppv':
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <div className="w-[62%] max-w-[210px] rounded-xl border border-white/15 bg-[#101321]/95 p-3 text-center shadow-xl shadow-black/50">
            <span className="mx-auto mb-1.5 flex size-6 items-center justify-center rounded-full bg-[#2B7FFF]/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <p className="text-[10px] font-semibold text-white">Match pass</p>
            <p className="text-[9px] text-white/55">Early-bird price until first ball</p>
            <p className="mt-1.5 rounded-full bg-[#2B7FFF] py-1 text-[9px] font-semibold text-white">Unlock the stream · $9.99</p>
          </div>
        </div>
      );
    case 'subs':
      return (
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-lg border border-white/12 bg-[#101321]/90 px-2.5 py-1.5 backdrop-blur">
          <span className="text-[9px] leading-tight text-white/85">
            Free preview
            <span className="block text-white/50 tabular-nums">0:45 left</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#2B7FFF] px-2.5 py-1 text-[9px] font-semibold text-white">Season pass · $7.99/mo</span>
        </div>
      );
    case 'ads':
      return (
        <>
          <span className="absolute right-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-semibold text-white/90 tabular-nums">Ad · 0:12</span>
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg border border-white/12 bg-white/95 px-2.5 py-1.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded bg-[#18181B] text-[8px] font-bold text-white">AD</span>
            <span className="min-w-0 text-[9px] font-semibold leading-tight text-[#18181B]">
              Your ad partner
              <span className="block truncate font-normal text-black/55">Mid-roll, inserted server-side</span>
            </span>
          </div>
        </>
      );
    case 'merch':
      return (
        <div className="absolute bottom-2 right-2 w-[46%] max-w-[150px] rounded-lg border border-white/12 bg-[#101321]/92 p-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3 3 6l2 4 2-1v11h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" />
              </svg>
            </span>
            <span className="min-w-0 text-[9px] leading-tight text-white/90">
              <span className="block truncate font-semibold">Home jersey</span>
              <span className="text-white/50">$65</span>
            </span>
          </div>
          <p className="mt-1.5 rounded-full bg-[#2B7FFF] py-1 text-center text-[9px] font-semibold text-white">Buy now</p>
        </div>
      );
    case 'sponsor':
      return (
        <>
          <span className="absolute right-2 top-2 rounded-md border border-white/15 bg-black/55 px-2 py-1 text-right text-[7px] uppercase tracking-wider text-white/55 backdrop-blur">
            Presented by
            <span className="block text-[9px] font-bold tracking-normal text-white">Your sponsor</span>
          </span>
          <div className="absolute inset-x-2 bottom-2 rounded-lg border border-[#2B7FFF]/40 bg-[#101321]/90 px-2.5 py-1.5 text-[9px] text-white/85 backdrop-blur">
            <span className="font-semibold text-white">Powerplay</span> brought to you by Your sponsor
          </div>
        </>
      );
    case 'betting':
      return (
        <>
          <div className="absolute right-2 top-2 w-[40%] max-w-[128px] rounded-lg border border-white/12 bg-[#101321]/92 p-1.5 backdrop-blur">
            <p className="text-[7px] font-semibold uppercase tracking-wider text-white/45">Match winner</p>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] font-semibold tabular-nums">
              <span className="rounded bg-[#2B7FFF] py-0.5 text-center text-white">Home +150</span>
              <span className="rounded bg-white/[0.08] py-0.5 text-center text-white/85">Away -180</span>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/75 px-2 py-1 text-[8px] text-white/80 tabular-nums">
            <span className="rounded bg-[#2B7FFF] px-1 py-px font-bold text-white">ODDS</span>
            <span className="truncate">Total runs O/U 165.5 <b className="text-white">-110</b> · Powerplay <b className="text-white">+125</b></span>
          </div>
        </>
      );
  }
}

// ============================================================
// Demo
// ============================================================

export default function MatchdayDemo() {
  const [mode, setMode] = useState<RevenueKey>('ppv');
  const [auto, setAuto] = useState(true);

  // Walk through the revenue lines until the visitor picks one
  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      setMode((m) => {
        const i = REVENUE_STREAMS.findIndex((r) => r.key === m);
        return REVENUE_STREAMS[(i + 1) % REVENUE_STREAMS.length].key;
      });
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [auto]);

  const active = REVENUE_STREAMS.find((r) => r.key === mode)!;

  return (
    <div className="relative" aria-label="Preview of a league's own streaming page with revenue controls">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[32px] opacity-60"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(43,127,255,0.22), transparent 70%)' }}
      />
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0e0e10] shadow-2xl shadow-black/60">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.02] px-3.5 py-2.5">
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <div className="ml-2.5 max-w-[180px] flex-1 truncate rounded-md bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-white/45">
            yourleague.com/live
          </div>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/50">
            Your brand
          </span>
        </div>

        <div className="grid sm:grid-cols-[1fr_156px]">
          {/* Player */}
          <div className="flex min-w-0 flex-col border-b border-white/10 sm:border-b-0 sm:border-r">
            <div className="relative aspect-video overflow-hidden bg-black select-none">
              <PitchScene />
              <div className="absolute left-2 top-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <span className="ss-pulse size-1 rounded-full bg-white" />
                  LIVE
                </span>
                <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white tabular-nums backdrop-blur">
                  LIO 142/3 <span className="font-normal text-white/60">16.2 ov</span>
                </span>
              </div>
              <div key={mode} className="ss-overlay-in absolute inset-0">
                <Overlay mode={mode} />
              </div>
            </div>

            {/* Match bar */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1c7340] text-[10px] font-bold text-white">L</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-white/90">Lions v Titans</span>
                <span className="block truncate text-[9px] text-white/45">Matchday 12 · 4.2k watching</span>
              </span>
              <span className="hidden rounded-full border border-[#2B7FFF]/35 bg-[#2B7FFF]/10 px-2 py-1 text-[9px] font-medium text-[#9EC3FF] sm:inline">
                {active.label}
              </span>
            </div>
          </div>

          {/* Revenue console */}
          <div className="flex flex-col bg-white/[0.01]">
            <div className="border-b border-white/10 px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-widest text-white/45">
              Revenue console
            </div>
            <div className="grid flex-1 grid-cols-2 content-center gap-1 p-2 sm:flex sm:flex-col sm:justify-center sm:gap-0.5 sm:p-1.5">
              {REVENUE_STREAMS.map((r) => {
                const on = r.key === mode;
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setAuto(false); setMode(r.key); }}
                    className={`flex items-center justify-between gap-1.5 rounded-md px-2 py-2 text-left text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-[#2B7FFF] sm:px-1.5 sm:py-[5px] sm:text-[10px] ${
                      on ? 'bg-[#2B7FFF]/15 text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'
                    }`}
                  >
                    <span className="truncate">{r.label}</span>
                    <span
                      aria-hidden
                      className={`relative h-2.5 w-[18px] shrink-0 rounded-full transition-colors ${on ? 'bg-[#2B7FFF]' : 'bg-white/15'}`}
                    >
                      <span
                        className={`absolute top-[2px] size-1.5 rounded-full bg-white transition-all ${on ? 'left-[10px]' : 'left-[2px]'}`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-white/50">
        Pick a revenue line to see it on the stream. Illustrative preview.
      </p>
    </div>
  );
}
