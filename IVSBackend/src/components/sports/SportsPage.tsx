'use client';

/**
 * /sports: "Sports & Live Events".
 *
 * The original substream.ai site (white-label streaming for leagues,
 * events and creators) restored as a second front door next to the
 * game-studio home. Same tokens, type scale and section rhythm as
 * src/app/page.tsx; copy lives in src/lib/sports.ts.
 */

import Link from 'next/link';
import { useState } from 'react';
import { Geist } from 'next/font/google';
import SiteNav from '@/components/site/SiteNav';
import { BRAND, BTN_OUTLINE, BTN_PRIMARY, CountUp, Reveal, SubstreamLogo } from '@/components/site/shared';
import MatchdayDemo, { PitchScene } from '@/components/sports/MatchdayDemo';
import RoiCalculator from '@/components/sports/RoiCalculator';
import {
  CRICKET_PROOF_LEAGUE,
  CRICKET_PROOF_LOGO,
  DATA_POINTS,
  DEMO_BOOKING_URL,
  DEMO_MARKETS,
  FIELD_STORIES,
  OPERATOR_POINTS,
  OPERATOR_SETTINGS,
  REVENUE_EXTRAS,
  REVENUE_STREAMS,
  SPORTS_COMPARISON,
  SPORTS_FAQS,
  SPORTS_FEATURES,
  SPORTS_FLOW,
  SPORTS_METRICS,
  SPORTS_PLANS,
} from '@/lib/sports';

const geist = Geist({ subsets: ['latin'] });

// ============================================================
// Icons
// ============================================================

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: BRAND, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'bolt': return <svg {...common}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg>;
    case 'camera': return <svg {...common}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3" /></svg>;
    case 'globe': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" /></svg>;
    case 'data': return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case 'window': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></svg>;
    case 'clip': return <svg {...common}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 7.5 20 17M8 16.5 20 7" /></svg>;
    case 'translate': return <svg {...common}><path d="M3 5h10M8 3v2M5 5c.6 3.4 3 6.3 6 8M11 5c-.7 4-3.4 7.4-7 9" /><path d="m12 21 4.5-10L21 21M13.5 18h6" /></svg>;
    case 'share': return <svg {...common}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8 15.8 6.2M8.2 13.2 15.8 17.8" /></svg>;
    case 'chart': return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case 'archive': return <svg {...common}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" /></svg>;
    case 'badge': return <svg {...common}><path d="M12 2 4 5.5v6c0 5 3.4 8.6 8 10.5 4.6-1.9 8-5.5 8-10.5v-6L12 2Z" /><path d="m8.5 12 2.5 2.5L16 9" /></svg>;
    case 'ppv': return <svg {...common}><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z" /><path d="M14 5v3M14 11v2M14 16v3" /></svg>;
    case 'subs': return <svg {...common}><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" /><path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2" /></svg>;
    case 'ads': return <svg {...common}><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></svg>;
    case 'merch': return <svg {...common}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V7a3 3 0 0 1 6 0v1" /></svg>;
    case 'sponsor': return <svg {...common}><path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4l-5.3 2.7 1-5.8L3.5 9.2l5.9-.9L12 3Z" /></svg>;
    case 'betting': return <svg {...common}><path d="M4 18 9 12l4 3 7-9" /><path d="M15 6h5v5" /></svg>;
    default: return null;
  }
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-medium uppercase tracking-widest text-[#5C9DFF]">{children}</p>;
}

const CARD = 'rounded-2xl border border-white/10 bg-white/[0.02]';

// ============================================================
// Page
// ============================================================

export default function SportsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className={`${geist.className} min-h-screen flex flex-col bg-[#18181B] text-[#FAFAFA] tracking-tight [color-scheme:dark]`}>
      <style>{`
        @keyframes ssPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.35; transform: scale(0.8);} }
        @keyframes ssOverlayIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        .ss-pulse { animation: ssPulse 1.4s ease-in-out infinite; }
        .ss-overlay-in { animation: ssOverlayIn 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .ss-pulse, .ss-overlay-in { animation: none !important; }
          .ss-reveal { transition: none !important; }
          html { scroll-behavior: auto; }
        }
      `}</style>

      <SiteNav active="sports" />

      <main>
        {/* Hero: copy left, matchday demo right */}
        <header className="relative overflow-hidden px-6 pt-12 pb-14 lg:pt-20 lg:pb-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0"
            style={{ background: 'radial-gradient(120% 100% at 50% 0%, #18181B 50%, rgba(43,127,255,0.30) 100%)' }}
          />
          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_460px] lg:gap-14 xl:grid-cols-[1fr_500px]">
            <div className="space-y-7 text-center lg:text-left">
              <p className="inline-flex h-8 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white/75">
                <span className="ss-pulse size-1.5 rounded-full bg-[#2B7FFF]" />
                Streaming for leagues and live events
              </p>
              <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tighter sm:text-5xl xl:text-6xl">
                Stream every match on your own site.
                <span className="text-[#5C9DFF]"> Keep the fans and the revenue.</span>
              </h1>
              <p className="mx-auto max-w-xl text-base leading-relaxed text-white/65 md:text-lg lg:mx-0">
                Plug in a camera and go live worldwide. Tickets, subscriptions, ads, merch and AI
                highlights run on your domain, under your brand. No code, no gatekeepers.
              </p>
              <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
                  Book a live demo
                </a>
                <a href="#roi" className={BTN_OUTLINE}>Estimate your revenue</a>
              </div>
              <p className="text-sm text-white/50">
                A 20-minute walkthrough on your league, your event, your numbers.
              </p>
            </div>
            <Reveal delay={150} className="mx-auto w-full max-w-[540px] lg:mx-0">
              <MatchdayDemo />
            </Reveal>
          </div>

          {/* Proof strip */}
          <Reveal delay={250} className="relative z-10 mx-auto mt-12 max-w-4xl lg:mt-16">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#2B7FFF]/35 bg-[#131a2b]/80 backdrop-blur px-5 py-4 text-center sm:flex-row sm:gap-4 sm:text-left">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#2B7FFF]/30 bg-[#2B7FFF]/15">
                {CRICKET_PROOF_LOGO ? (
                  <img src={CRICKET_PROOF_LOGO} alt="" className="size-6 object-contain" />
                ) : (
                  <Icon name="badge" size={20} />
                )}
              </span>
              <p className="flex-1 text-[15px] leading-snug text-white/85">
                <span className="mr-2 inline-block rounded-full bg-[#2B7FFF]/20 px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wider text-[#9EC3FF]">
                  Just shipped
                </span>
                Substream just finished implementation for{' '}
                <span className="font-semibold text-white">{CRICKET_PROOF_LEAGUE}</span>.
              </p>
              <a
                href={DEMO_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-medium text-[#7EB1FF] hover:underline"
              >
                Talk to us about your league →
              </a>
            </div>
          </Reveal>
        </header>

        {/* Metrics band */}
        <section className="relative overflow-hidden border-y border-white/10 px-6 py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(43,127,255,0.6), transparent)' }}
          />
          <div className="mx-auto grid max-w-5xl grid-cols-2 md:grid-cols-4">
            {SPORTS_METRICS.map((m, i) => (
              <Reveal
                key={m.label}
                delay={i * 90}
                className={`relative flex flex-col items-center px-4 py-3 text-center ${i > 0 ? 'md:border-l md:border-white/[0.07]' : ''} ${i % 2 === 1 ? 'border-l border-white/[0.07]' : ''}`}
              >
                <span className="mb-2.5 flex size-9 items-center justify-center rounded-lg border border-[#2B7FFF]/20 bg-[#2B7FFF]/10">
                  <Icon name={m.icon} size={17} />
                </span>
                <div
                  className="bg-clip-text text-3xl font-semibold tracking-tight text-transparent md:text-4xl"
                  style={{ backgroundImage: 'linear-gradient(180deg, #9EC3FF 0%, #2B7FFF 100%)' }}
                >
                  {m.count ? <CountUp {...m.count} /> : <span className="tabular-nums">{m.value}</span>}
                </div>
                <div className="mt-1.5 text-[13px] text-white/55">{m.label}</div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Problem + comparison */}
        <section className="border-b border-white/10 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-12 max-w-3xl text-center">
              <Eyebrow>The problem</Eyebrow>
              <h2 className="mb-4 text-3xl font-medium tracking-tighter md:text-4xl">
                Your fans are watching. Someone else is getting paid.
              </h2>
              <p className="leading-relaxed text-white/65">
                Stream on a social platform and it keeps the viewer, runs its own ads and decides who
                sees your match. Sell your rights and you hand over the audience with them. Substream
                puts the stream, the fan relationship and every revenue line on a site you own.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-[1fr_1fr] text-sm sm:grid-cols-[140px_1fr_1fr]">
                  <div className="hidden border-b border-white/10 bg-white/[0.02] px-4 py-3 sm:block" />
                  <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3 font-medium text-white/60">
                    Social platforms
                  </div>
                  <div className="border-b border-l border-white/10 bg-[#2B7FFF]/[0.08] px-4 py-3 font-semibold text-[#7EB1FF]">
                    Your site, powered by Substream
                  </div>
                  {SPORTS_COMPARISON.map((row, i) => (
                    <div key={row.dim} className="contents">
                      <div className={`hidden items-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-white/55 sm:flex ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                        {row.dim}
                      </div>
                      <div className={`px-4 py-3.5 leading-relaxed text-white/60 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/50 sm:hidden">{row.dim}</span>
                        {row.them}
                      </div>
                      <div className={`border-l border-white/10 bg-[#2B7FFF]/[0.04] px-4 py-3.5 leading-relaxed text-white/85 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                        {row.us}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-28 border-b border-white/10 bg-white/[0.015] px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tighter md:text-4xl">From camera to checkout.</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/65">
                Substream works with any production setup. We handle everything after the camera, so
                your team stays on the event.
              </p>
            </Reveal>
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SPORTS_FLOW.map((f, i) => (
                <Reveal key={f.k} delay={i * 110}>
                  <li className={`${CARD} relative h-full list-none p-6 transition-colors duration-500 hover:border-[#2B7FFF]/40`}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full border border-[#2B7FFF]/35 bg-[#18181B] font-semibold text-[#5C9DFF]">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wider text-white/50">{f.d}</span>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">{f.k}</h3>
                    <p className="text-sm leading-relaxed text-white/60">{f.body}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Monetization */}
        <section id="revenue" className="scroll-mt-28 border-b border-white/10 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <Eyebrow>Monetization</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tighter md:text-4xl">Six revenue lines in one player.</h2>
              <p className="mt-3 leading-relaxed text-white/65">
                Turn on the ones that fit your audience. Each is a switch in your dashboard, and each
                dollar is tied to a fan you can reach again.
              </p>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {REVENUE_STREAMS.map((s, i) => (
                <Reveal key={s.key} delay={(i % 3) * 90}>
                  <div className={`${CARD} group h-full p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04]`}>
                    <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-[#2B7FFF]/25 bg-[#2B7FFF]/12 transition-transform duration-500 group-hover:scale-110">
                      <Icon name={s.key} />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold">{s.title}</h3>
                    <p className="mb-4 text-sm leading-relaxed text-white/60">{s.body}</p>
                    <ul className="space-y-2">
                      {s.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2 text-sm text-white/70">
                          <Check />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={160} className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-white/55">
              <span>Also built in:</span>
              {REVENUE_EXTRAS.map((x) => (
                <span key={x} className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-white/75">{x}</span>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Audience data */}
        <section id="data" className="scroll-mt-28 border-b border-white/10 bg-white/[0.015] px-6 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <Eyebrow>Audience ownership</Eyebrow>
              <h2 className="mb-4 text-3xl font-medium tracking-tighter md:text-4xl">
                Every viewer is a name and an email, not an anonymous view.
              </h2>
              <p className="mb-6 leading-relaxed text-white/65">
                Fans register on your site to watch. That turns a broadcast into a fan database you
                own: who watched, what they bought, and how to bring them back for the next match.
              </p>
              <ul className="space-y-3">
                {DATA_POINTS.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5 text-[15px] text-white/75">
                    <Check />
                    {pt}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={140}>
              {/* Fan CRM mock: illustrative rows */}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e10] shadow-xl shadow-black/40">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <span className="text-sm font-semibold">Fans</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/55">Export CSV</span>
                </div>
                <div className="divide-y divide-white/[0.06] text-sm">
                  {[
                    { n: 'Priya S.', e: 'priya@…', tag: 'Season pass', w: '11 matches' },
                    { n: 'Marcus T.', e: 'marcus@…', tag: 'Bought jersey', w: '6 matches' },
                    { n: 'Aisha K.', e: 'aisha@…', tag: 'Pay-per-view', w: '3 matches' },
                    { n: 'Daniel R.', e: 'daniel@…', tag: 'New this week', w: '1 match' },
                  ].map((f, i) => (
                    <div key={f.n} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: `hsl(${212 + i * 34},55%,42%)` }}
                      >
                        {f.n.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-white/90">{f.n}</span>
                        <span className="block truncate text-xs text-white/50">{f.e} · {f.w}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-[#2B7FFF]/30 bg-[#2B7FFF]/10 px-2.5 py-1 text-[11px] font-medium text-[#9EC3FF]">
                        {f.tag}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="border-t border-white/10 px-4 py-2.5 text-xs text-white/50">Illustrative data</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Platform features */}
        <section id="platform" className="scroll-mt-28 border-b border-white/10 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <Eyebrow>The platform</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tighter md:text-4xl">Everything you need to stream, monetize and scale.</h2>
              <p className="mt-3 leading-relaxed text-white/65">
                Built for leagues, clubs and federations. Equally at home with concerts, conferences,
                creators and church services.
              </p>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SPORTS_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 4) * 70}>
                  <div className={`${CARD} flex h-full gap-4 p-5 transition-all duration-500 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04] sm:block`}>
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#2B7FFF]/25 bg-[#2B7FFF]/12 sm:mb-3">
                      <Icon name={f.icon} />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">{f.title}</h3>
                      <p className="text-sm leading-relaxed text-white/60">{f.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Betting & prediction-market operators */}
        <section id="operators" className="scroll-mt-28 border-b border-white/10 bg-white/[0.015] px-6 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_520px]">
            <Reveal>
              <Eyebrow>For sportsbooks and prediction markets</Eyebrow>
              <h2 className="mb-4 text-3xl font-medium tracking-tighter md:text-4xl">
                Put the market on the match.
              </h2>
              <p className="mb-7 leading-relaxed text-white/65">
                Overlay your odds and bet cards on a first-party stream inside your own app or site.
                Fans watch and bet together, in sync, without leaving for someone else&apos;s platform.
              </p>
              <div className="space-y-5">
                {OPERATOR_POINTS.map((p) => (
                  <div key={p.title} className="flex gap-3">
                    <Check />
                    <div>
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-white/60">{p.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer" className={`${BTN_OUTLINE} mt-8`}>
                Talk to us about an operator pilot
              </a>
            </Reveal>

            <Reveal delay={140}>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e10] shadow-xl shadow-black/40">
                <div className="relative aspect-video overflow-hidden bg-black select-none">
                  <PitchScene />
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                      <span className="ss-pulse size-1.5 rounded-full bg-white" />
                      LIVE
                    </span>
                    <span className="rounded bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur">
                      LIO 142/3 <span className="font-normal text-white/65">16.2 ov</span>
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-black/75 px-3 py-1.5 text-[11px] text-white/85 tabular-nums">
                    <span className="rounded bg-[#2B7FFF] px-1.5 py-px text-[10px] font-bold text-white">LIVE ODDS</span>
                    <span className="truncate">
                      Match winner: Home <b className="text-white">+150</b> · Away <b className="text-white">-180</b>
                    </span>
                    <span className="ml-auto hidden shrink-0 text-[10px] text-white/55 sm:inline">Play responsibly</span>
                  </div>
                </div>

                <div className="grid gap-px bg-white/[0.06] sm:grid-cols-[1fr_200px]">
                  {/* Markets */}
                  <div className="space-y-2 bg-[#0e0e10] p-3.5">
                    {DEMO_MARKETS.map((m, i) => (
                      <div key={m.market} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
                        <p className="mb-1.5 text-xs font-medium text-white/75">{m.market}</p>
                        <div className="grid grid-cols-2 gap-1.5 text-xs tabular-nums">
                          <span className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${i === 0 ? 'bg-[#2B7FFF] font-semibold text-white' : 'bg-white/[0.05] text-white/85'}`}>
                            {m.a.label} <span className="font-mono">{m.a.odds}</span>
                          </span>
                          <span className="flex items-center justify-between rounded-md bg-white/[0.05] px-2.5 py-1.5 text-white/85">
                            {m.b.label} <span className="font-mono">{m.b.odds}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Operator settings */}
                  <div className="bg-[#0e0e10] p-3.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/50">Operator settings</p>
                    <dl className="space-y-1.5 text-xs">
                      {OPERATOR_SETTINGS.map((s) => (
                        <div key={s.label} className="flex items-center justify-between gap-2">
                          <dt className="text-white/60">{s.label}</dt>
                          <dd className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-medium text-white/85">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
                <p className="border-t border-white/10 px-3.5 py-2.5 text-xs text-white/50">
                  Illustrative markets and odds. Betting features are only enabled where they are legal.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ROI calculator */}
        <section id="roi" className="scroll-mt-28 border-b border-white/10 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <Eyebrow>Revenue estimator</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tighter md:text-4xl">Is streaming worth it for you?</h2>
              <p className="mt-3 leading-relaxed text-white/65">
                Set your audience and the revenue lines you would turn on. The estimate updates as you go.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <RoiCalculator />
            </Reveal>
          </div>
        </section>

        {/* In the field */}
        <section id="field" className="scroll-mt-28 border-b border-white/10 bg-white/[0.015] px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <Eyebrow>Broadcast-grade production</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tighter md:text-4xl">The production stack behind major events.</h2>
              <p className="mt-3 leading-relaxed text-white/65">
                Substream plugs into TVU Networks cloud production. These are TVU&apos;s published
                stories from productions run on that stack.
              </p>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FIELD_STORIES.map((s, i) => (
                <Reveal key={s.name} delay={i * 80}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${CARD} group flex h-full flex-col p-5 transition-all duration-500 hover:-translate-y-1 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B7FFF]`}
                  >
                    <span className="mb-4 self-start rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-medium text-white/65">
                      {s.tag}
                    </span>
                    <h3 className="mb-1.5 font-semibold">{s.name}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-white/60">{s.blurb}</p>
                    <span className="mt-4 text-sm font-medium text-[#7EB1FF] group-hover:underline">
                      TVU Networks case study ↗
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Ways to work with us */}
        <section id="plans" className="scroll-mt-28 border-b border-white/10 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <Eyebrow>Plans</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tighter md:text-4xl">We earn when you do.</h2>
              <p className="mt-3 leading-relaxed text-white/65">
                Build and Pro run on a revenue share with a one-time setup. Enterprise is custom.
                We settle the terms on a call, once we understand your event.
              </p>
            </Reveal>
            <div className="grid gap-5 lg:grid-cols-3">
              {SPORTS_PLANS.map((p, i) => (
                <Reveal key={p.name} delay={i * 90}>
                  <div className={`flex h-full flex-col rounded-2xl border p-6 ${p.featured ? 'border-[#2B7FFF]/45 bg-[#2B7FFF]/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold">{p.name}</h3>
                      {p.featured && (
                        <span className="rounded-full bg-[#2B7FFF]/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#9EC3FF]">
                          Recurring events
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#7EB1FF]">{p.terms}</p>
                    <p className="mb-5 mt-3 text-sm leading-relaxed text-white/60">{p.blurb}</p>
                    <ul className="mb-6 flex-1 space-y-2">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-white/75">
                          <Check />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={DEMO_BOOKING_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${p.featured ? BTN_PRIMARY : BTN_OUTLINE} w-full`}
                    >
                      Book a live demo
                    </a>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-28 border-b border-white/10 bg-white/[0.015] px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <Reveal className="mb-10 text-center">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tighter md:text-4xl">Questions leagues and event teams ask us</h2>
            </Reveal>
            <div className="space-y-3">
              {SPORTS_FAQS.map((f, i) => {
                const open = openFaq === i;
                return (
                  <Reveal key={f.q} delay={Math.min(i, 5) * 50}>
                    <div className={`rounded-2xl border transition-colors duration-300 ${open ? 'border-[#2B7FFF]/40 bg-[#2B7FFF]/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
                      <h3>
                        <button
                          type="button"
                          onClick={() => setOpenFaq(open ? null : i)}
                          className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-[#2B7FFF]"
                          aria-expanded={open}
                          aria-controls={`sports-faq-${i}`}
                        >
                          <span className="text-[15px] font-medium">{f.q}</span>
                          <svg
                            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#5C9DFF]' : 'text-white/50'}`}
                            aria-hidden
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      </h3>
                      <div
                        id={`sports-faq-${i}`}
                        className="grid transition-[grid-template-rows] duration-300 ease-out"
                        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                      >
                        <div className="overflow-hidden" inert={!open}>
                          <p className="px-5 pb-5 text-sm leading-relaxed text-white/65">{f.a}</p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden px-6 py-24 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 [mask-image:linear-gradient(to_bottom,transparent,black_55%)]" style={{ background: 'radial-gradient(120% 100% at 50% 100%, #18181B 52%, rgba(43,127,255,0.24) 100%)' }} />
          <Reveal className="relative z-10 mx-auto max-w-2xl space-y-6">
            <h2 className="text-3xl font-medium tracking-tighter md:text-5xl">Own your next broadcast.</h2>
            <p className="mx-auto max-w-lg leading-relaxed text-white/65">
              Show us your league or event and we&apos;ll walk through what a branded stream, a paywall
              and a fan database would look like on your site.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
                Book a live demo
              </a>
              <a href="#roi" className={BTN_OUTLINE}>Estimate your revenue</a>
            </div>
            <p className="text-sm text-white/50">
              Building a game instead?{' '}
              <Link href="/" className="text-[#7EB1FF] hover:underline">See Substream for game studios →</Link>
            </p>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5 text-sm text-white/55">
            <SubstreamLogo className="h-4 w-auto opacity-70" />
            Substream — live streaming you own
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/" className="text-white/55 transition-colors hover:text-white">Game studios</Link>
            <a href="#roi" className="text-white/55 transition-colors hover:text-white">Revenue estimator</a>
            <Link href="/docs" className="text-white/55 transition-colors hover:text-white">Docs</Link>
            <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-white/55 transition-colors hover:text-white">Book a demo</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
