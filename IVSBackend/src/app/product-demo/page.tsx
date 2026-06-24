'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });

const BRAND = '#2B7FFF';

// Substream wave mark (matches substream.ai navbar logo)
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

// ============================================================
// Data
// ============================================================

type IntegrationKey = 'web' | 'unity' | 'ios' | 'script';

const INTEGRATIONS: Record<IntegrationKey, { label: string; engines: string; code: string }> = {
  web: {
    label: 'Web / WebGL',
    engines: 'Phaser · Three.js · PixiJS · Cocos · Unity WebGL',
    code: `import Substream from '@substream/web-sdk';

const session = await Substream.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  streamerId: 'player-456',
  authToken: 'sk_live_...',
});

console.log('Live!', session.viewerUrl);`,
  },
  unity: {
    label: 'Unity',
    engines: 'Windows · macOS · Quest 2/3/Pro',
    code: `using Substream.Streaming;

// Add WhipStreamControl to a GameObject, then:
streamControl.StartStreaming();

string viewerUrl = streamControl.GetViewerUrl();`,
  },
  ios: {
    label: 'iOS',
    engines: 'Metal · SpriteKit · SceneKit · ReplayKit',
    code: `import SubstreamSDK

let session = try await Substream.startStream(.init(
  backendUrl: URL(string: "https://your-api.com")!,
  authToken: "sk_live_...",
  streamerId: "player-456",
  capture: .metalView(self.gameView)
))

print("Live!", session.viewerUrl)`,
  },
  script: {
    label: 'Script tag',
    engines: 'No npm · no bundler',
    code: `<script src="substream.js"></script>
<script>
  const session = await Substream.startStream({
    canvas: document.getElementById('game'),
    backendUrl: 'https://your-api.com',
    streamerId: 'player-456',
    authToken: 'sk_live_...',
  });
</script>`,
  },
};

const ENGINES = ['Unity', 'Unreal', 'WebGL', 'Phaser', 'Three.js', 'PixiJS', 'Cocos', 'Godot', 'Construct'];

const VIDEO = {
  id: 'e4798d41d35046468db7ef4d035f7087',
  title: 'Stream your gameplay live',
  label: 'Watch a Unity game go live with the Substream SDK',
};

const FEATURES = [
  { icon: 'plug', title: 'Plugs into any game', body: '5 lines. Web, Unity, or iOS.' },
  { icon: 'globe', title: 'Streams to your site', body: 'A viewer URL you embed. Sub-second latency.' },
  { icon: 'data', title: 'Data & content you own', body: 'Streams, VODs, viewers, events — all yours.' },
  { icon: 'cash', title: 'Monetization built in', body: 'Subscriptions, watch parties, clip sales.' },
  { icon: 'spark', title: 'AI highlights', body: 'Auto reels, tuned to your game.' },
];

const METRICS = [
  { value: '5 lines', label: 'to integrate' },
  { value: '<500ms', label: 'glass-to-glass latency' },
  { value: '100%', label: 'on your domain' },
  { value: '1 model', label: 'tuned per game' },
];

const FLOW = [
  { k: 'Any game', d: 'Web · Unity · iOS' },
  { k: 'Substream SDK', d: 'Capture + publish' },
  { k: 'Your website', d: 'Embedded viewer' },
  { k: 'Dashboard', d: 'Data + content' },
  { k: 'AI highlights', d: 'Shareable clips' },
];

// ============================================================
// Icons
// ============================================================

function Icon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: BRAND, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'plug': return <svg {...common}><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v6" /></svg>;
    case 'globe': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" /></svg>;
    case 'data': return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case 'cash': return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case 'spark': return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>;
    default: return null;
  }
}

// ============================================================
// Scroll reveal
// ============================================================

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// Animated browser / player mock
// ============================================================

function PlayerMock() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="rounded-2xl border border-white/10 bg-[#0e0e10] shadow-2xl shadow-black/60 overflow-hidden">
        {/* browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <div className="ml-3 flex-1 rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-white/40 font-mono">
            yourgame.com/live
          </div>
        </div>
        {/* video surface */}
        <div className="relative aspect-video bg-gradient-to-br from-[#13233f] via-[#0e0e10] to-[#1a1030]">
          {/* animated "gameplay" orbs */}
          <span className="ss-orb absolute size-24 rounded-full blur-2xl" style={{ background: 'rgba(43,127,255,0.5)', top: '20%', left: '15%' }} />
          <span className="ss-orb2 absolute size-20 rounded-full blur-2xl" style={{ background: 'rgba(147,51,234,0.45)', bottom: '18%', right: '18%' }} />
          {/* moving puck */}
          <span className="ss-puck absolute size-3 rounded-full bg-white shadow-[0_0_12px_4px_rgba(255,255,255,0.6)]" style={{ top: '50%', left: '10%' }} />
          {/* LIVE badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[11px] font-semibold">
            <span className="ss-pulse size-2 rounded-full bg-red-500" />
            LIVE
          </div>
          {/* viewer count */}
          <div className="absolute bottom-3 left-3 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[11px] text-white/80">
            <span className="ss-count">1,248</span> watching
          </div>
        </div>
      </div>
      {/* floating embed snippet */}
      <div className="ss-float absolute -bottom-5 -right-3 hidden sm:block rounded-xl border border-white/10 bg-[#0e0e10] px-3.5 py-2.5 shadow-xl shadow-black/50">
        <code className="text-[11px] font-mono text-white/70">
          &lt;iframe src=<span style={{ color: BRAND }}>&quot;…/viewer/ID&quot;</span> /&gt;
        </code>
      </div>
    </div>
  );
}

// ============================================================
// Shared styles
// ============================================================

const BTN_PRIMARY = 'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_12px_rgba(43,127,255,0.4)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_6px_20px_rgba(43,127,255,0.5)] active:scale-95 transition-all ease-out';
const BTN_OUTLINE = 'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out';

export default function ProductDemoPage() {
  const [tab, setTab] = useState<IntegrationKey>('web');

  return (
    <div className={`${geist.className} min-h-screen flex flex-col bg-[#18181B] text-[#FAFAFA] tracking-tight`}>
      <style>{`
        @keyframes ssMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes ssPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.35; transform: scale(0.8);} }
        @keyframes ssFloat { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-8px);} }
        @keyframes ssOrb { 0%,100% { transform: translate(0,0);} 50% { transform: translate(30px,18px);} }
        @keyframes ssOrb2 { 0%,100% { transform: translate(0,0);} 50% { transform: translate(-26px,-16px);} }
        @keyframes ssPuck { 0%{left:8%;top:42%} 25%{left:70%;top:60%} 50%{left:40%;top:30%} 75%{left:80%;top:48%} 100%{left:8%;top:42%} }
        @keyframes ssDash { to { stroke-dashoffset: 0; } }
        .ss-marquee { animation: ssMarquee 28s linear infinite; }
        .ss-pulse { animation: ssPulse 1.4s ease-in-out infinite; }
        .ss-float { animation: ssFloat 4s ease-in-out infinite; }
        .ss-orb { animation: ssOrb 7s ease-in-out infinite; }
        .ss-orb2 { animation: ssOrb2 9s ease-in-out infinite; }
        .ss-puck { animation: ssPuck 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ss-marquee,.ss-pulse,.ss-float,.ss-orb,.ss-orb2,.ss-puck { animation: none !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#18181B]/85 backdrop-blur-lg z-30">
        <Link href="/" className="flex items-center gap-2.5">
          <SubstreamLogo className="h-5 w-auto" />
          <span className="text-lg font-semibold">Substream</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">Docs</Link>
          <Link href="/api/auth/demo-auto" className={BTN_OUTLINE + ' h-9'}>Dashboard</Link>
          <Link href="/demo" className={BTN_PRIMARY + ' h-9'}>Live Demo</Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden px-6 pt-20 pb-24 border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] w-full"
          style={{ background: 'radial-gradient(120% 100% at 50% 0%, #18181B 50%, rgba(43,127,255,0.30) 100%)' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-7 text-center lg:text-left">
            <p className="inline-flex h-8 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white/70">
              <span className="ss-pulse size-1.5 rounded-full bg-[#2B7FFF]" />
              White-label streaming for games
            </p>
            <h1 className="text-balance text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tighter leading-[1.05]">
              Your own private Twitch
              <br />
              <span className="text-[#2B7FFF]">for your community.</span>
            </h1>
            <p className="max-w-md mx-auto lg:mx-0 text-base md:text-lg text-white/55 leading-relaxed">
              One SDK to stream gameplay to your own site, own the content and data, monetize it, and auto-generate AI highlights.
            </p>
            <div className="flex gap-3 justify-center lg:justify-start flex-wrap">
              <Link href="/demo" className={BTN_PRIMARY}>Try the live demo</Link>
              <a href="#watch" className={BTN_OUTLINE}>Watch the videos</a>
            </div>
          </div>
          <Reveal delay={120}>
            <PlayerMock />
          </Reveal>
        </div>
      </header>

      {/* Engine marquee */}
      <section className="border-b border-white/10 py-8 overflow-hidden">
        <p className="text-center text-xs uppercase tracking-widest text-white/35 mb-5">Works with any engine that renders frames</p>
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="ss-marquee flex shrink-0 items-center gap-12 pr-12">
            {[...ENGINES, ...ENGINES].map((e, i) => (
              <span key={i} className="text-lg font-medium text-white/40 whitespace-nowrap">{e}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="border-b border-white/10 py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 80} className="text-center">
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-[#2B7FFF]">{m.value}</div>
              <div className="text-sm text-white/50 mt-1">{m.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Animated flow */}
      <section className="py-20 px-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">The whole loop, one integration</h2>
          </Reveal>
          <div className="relative">
            {/* connecting line */}
            <svg aria-hidden className="absolute left-0 right-0 top-[26px] hidden lg:block w-full h-1" preserveAspectRatio="none" viewBox="0 0 100 1">
              <line x1="2" y1="0.5" x2="98" y2="0.5" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              <line x1="2" y1="0.5" x2="98" y2="0.5" stroke={BRAND} strokeWidth="0.5" strokeDasharray="96" strokeDashoffset="96" style={{ animation: 'ssDash 2.4s ease-out forwards' }} />
            </svg>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
              {FLOW.map((f, i) => (
                <Reveal key={f.k} delay={i * 120} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 mb-4 flex size-13 items-center justify-center rounded-full border border-[#2B7FFF]/30 bg-[#18181B] text-[#2B7FFF] font-semibold" style={{ width: 52, height: 52 }}>
                    {i + 1}
                  </div>
                  <div className="font-semibold">{f.k}</div>
                  <div className="text-sm text-white/45 mt-0.5">{f.d}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Video proof */}
      <section id="watch" className="py-20 px-6 border-b border-white/10 bg-white/[0.015] scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">See it in action</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">{VIDEO.title}</h2>
            <p className="text-white/50 mt-3">{VIDEO.label}</p>
          </Reveal>
          <Reveal delay={120}>
            <div className="group rounded-2xl border border-white/10 bg-[#0e0e10] overflow-hidden shadow-2xl shadow-black/50 transition-all duration-500 hover:border-[#2B7FFF]/40 hover:shadow-[0_32px_80px_rgba(43,127,255,0.2)]">
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.loom.com/embed/${VIDEO.id}?hide_owner=true&hide_share=true&hideEmbedTopBar=true`}
                  title={VIDEO.title}
                  allow="fullscreen; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-20 px-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">Everything a studio needs</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-500 hover:-translate-y-1 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04]">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#2B7FFF]/12 border border-[#2B7FFF]/25 transition-transform duration-500 group-hover:scale-110">
                    <Icon name={f.icon} />
                  </div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Integration code */}
      <section className="py-20 px-6 border-b border-white/10 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-10">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">Integrate</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">Live in five lines</h2>
          </Reveal>
          <Reveal>
            <div className="rounded-2xl border border-white/10 bg-[#0e0e10] overflow-hidden shadow-xl shadow-black/40">
              <div className="flex flex-wrap border-b border-white/10">
                {(Object.keys(INTEGRATIONS) as IntegrationKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-5 py-3 text-sm font-medium transition-colors ${tab === key ? 'text-white border-b-2 border-[#2B7FFF] bg-[#2B7FFF]/10' : 'text-white/45 hover:text-white'}`}
                  >
                    {INTEGRATIONS[key].label}
                  </button>
                ))}
              </div>
              <div className="p-5">
                <p className="text-xs text-white/35 mb-3 font-mono">{INTEGRATIONS[tab].engines}</p>
                <pre className="text-sm font-mono text-white/80 overflow-x-auto leading-relaxed"><code>{INTEGRATIONS[tab].code}</code></pre>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Custom model */}
      <section className="py-20 px-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">AI, tuned to your game</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter mb-4">Highlights that know what matters</h2>
            <p className="text-white/55 leading-relaxed mb-5 max-w-md">
              The base model works on any game. Fine-tune it on your own clips so a headshot, a comeback, or a boss kill scores the way it should.
            </p>
            <Link href="/dashboard/highlights/compare" className="text-sm text-[#2B7FFF] hover:underline">Compare base vs tuned →</Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              {[
                { label: 'Base model', score: 62, tone: 'bg-white/30' },
                { label: 'Tuned for your game', score: 94, tone: 'bg-[#2B7FFF]' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white/70">{row.label}</span>
                    <span className="font-mono text-white/50">{row.score}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                    <ScoreBar width={row.score} tone={row.tone} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-white/35 pt-1">Highlight-quality score on the same recording.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24 px-6 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[360px] w-full" style={{ background: 'radial-gradient(120% 100% at 50% 100%, #18181B 52%, rgba(43,127,255,0.24) 100%)' }} />
        <Reveal className="relative z-10 max-w-2xl mx-auto space-y-7">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tighter">See it on your game.</h2>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/demo" className={BTN_PRIMARY}>Try the live demo</Link>
            <Link href="/api/auth/demo-auto" className={BTN_OUTLINE}>Explore the dashboard</Link>
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
            <Link href="/demo" className="text-white/40 hover:text-white transition-colors">Demo</Link>
            <Link href="https://github.com/jlin3/substream-sdk" className="text-white/40 hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// animated score bar that fills when scrolled into view
function ScoreBar({ width, tone }: { width: number; tone: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setW(width); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [width]);
  return <div ref={ref} className={`h-full rounded-full ${tone}`} style={{ width: `${w}%`, transition: 'width 1.1s cubic-bezier(0.22,1,0.36,1)' }} />;
}
