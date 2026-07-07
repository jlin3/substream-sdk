'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Geist } from 'next/font/google';
import TwitchSiteDemo from '@/components/TwitchSiteDemo';

const geist = Geist({ subsets: ['latin'] });

const BRAND = '#2B7FFF';

// Substream wave mark (matches substream.ai navbar logo)
function SubstreamLogo({ className }: { className?: string }) {
  return (
    <svg width="42" height="24" viewBox="0 0 42 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g clipPath="url(#ss_clip_home)">
        <path d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z" fill={BRAND} />
        <path d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z" fill={BRAND} />
      </g>
      <defs><clipPath id="ss_clip_home"><rect width="42" height="24" fill="white" /></clipPath></defs>
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

const METRICS = [
  { value: '5 lines', label: 'to integrate' },
  { value: '<500ms', label: 'glass-to-glass latency' },
  { value: '100%', label: 'on your domain' },
  { value: '90 days', label: 'zero-cost proof of concept' },
];

const FLOW = [
  { k: 'Any game', d: 'Web · Unity · iOS' },
  { k: 'Substream SDK', d: 'Capture + publish' },
  { k: 'Your website', d: 'Embedded viewer' },
  { k: 'Dashboard', d: 'Data + content' },
  { k: 'AI highlights', d: 'Shareable clips' },
];

const PILLARS = [
  {
    icon: 'data',
    title: 'Your data',
    body: 'Every view, click, replay, and share happens on your properties. You own the engagement graph — not a third-party platform.',
    points: ['Player watch & replay behavior', 'Highlight engagement by title and mode', 'Session frequency and return rates', 'Exportable to your analytics stack'],
  },
  {
    icon: 'cash',
    title: 'Your revenue',
    body: 'Multiple monetization levers built in. You choose what works for your community.',
    points: ['Ads: video, banner, programmatic', 'Subscriptions: premium tiers for superfans', 'Merch & DLC upsell in highlight feeds', 'Revenue you own, on your platform'],
  },
  {
    icon: 'people',
    title: 'Your community',
    body: 'Give players a reason to come back between sessions. Highlights and livestreams turn passive players into an engaged community.',
    points: ['Post-session highlight reels, automated', 'Livestreams directly on your site or app', 'Community highlight feeds by game mode', 'Shareable clips that drive organic reach'],
  },
];

// How the fine-tuned highlight model turns raw gameplay into share-ready clips
const HIGHLIGHTS = [
  {
    icon: 'brain',
    step: 'Trained on your game',
    body: 'We train and fine-tune a highlight model on your titles, modes, and events — so it learns what actually matters in your world: a clutch round, a boss kill, a personal best.',
  },
  {
    icon: 'clip',
    step: 'Auto-clipped in seconds',
    body: 'Every session is analyzed as it happens. Reels are generated within ~60 seconds of a match ending — no editors, no manual tagging, no highlight team.',
  },
  {
    icon: 'share',
    step: 'Branded & ready to share',
    body: 'Vertical and landscape cuts, captioned and watermarked with your brand, drop straight into your feed and players\u2019 socials to drive organic reach.',
  },
];

const SECURITY = [
  {
    icon: 'badge',
    title: 'SOC 2, GDPR & PCI DSS',
    body: 'Enterprise compliance across the stack — SOC 2, GDPR, and PCI DSS. The controls your security and legal teams review before they sign.',
  },
  {
    icon: 'lock',
    title: 'Encrypted end to end',
    body: 'Streams travel over encrypted WebRTC transport (TLS + SRTP). Stream keys are AES-encrypted at rest — never stored in plaintext.',
  },
  {
    icon: 'shieldData',
    title: 'DRM & geo-blocking',
    body: 'Studio-grade content protection with DRM and geo-restrictions, so streams and VODs only play where — and how — you allow.',
  },
  {
    icon: 'key',
    title: 'Scoped API tokens',
    body: 'Server-issued, scoped tokens authorize every publish. Your backend stays in control of who can go live and when.',
  },
  {
    icon: 'data',
    title: 'Your data stays yours',
    body: 'Streams, VODs, viewers, and events live on your properties. Nothing is shared with a third-party audience platform.',
  },
  {
    icon: 'child',
    title: 'Youth-safe by design',
    body: 'For players under the age of digital consent, highlights route through k-ID verified parent accounts — compliant across 240+ jurisdictions.',
  },
  {
    icon: 'sliders',
    title: 'You set the rules',
    body: 'Streaming and highlights are configurable per game mode and content rating. Turn surfaces on or off per audience.',
  },
  {
    icon: 'globe',
    title: 'Global scale & SSO',
    body: 'Multi-CDN delivery with a 99.995% uptime SLA and SAML SSO for your team — built to pass enterprise security review.',
  },
  {
    icon: 'server',
    title: 'Managed infrastructure',
    body: 'We run the ingest, delivery, recording, and ML pipeline. Your only lift is the SDK integration.',
  },
];

const VIDEO = {
  id: 'e4798d41d35046468db7ef4d035f7087',
  title: 'Stream your gameplay live',
  label: 'Watch a Unity game go live with the Substream SDK',
};

// ============================================================
// Icons
// ============================================================

function Icon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: BRAND, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'data': return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case 'cash': return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case 'people': return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c1.9.8 3 2.5 3 5.6" /></svg>;
    case 'lock': return <svg {...common}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case 'key': return <svg {...common}><circle cx="8" cy="14" r="4.5" /><path d="M11.5 10.5 20 2M16 6l3 3M13 9l2 2" /></svg>;
    case 'shieldData': return <svg {...common}><path d="M12 2 4 5.5v6c0 5 3.4 8.6 8 10.5 4.6-1.9 8-5.5 8-10.5v-6L12 2Z" /><path d="M8.5 12.5 11 15l4.5-5" /></svg>;
    case 'child': return <svg {...common}><circle cx="12" cy="7" r="3.5" /><path d="M5.5 21c.6-4 3-6.5 6.5-6.5s5.9 2.5 6.5 6.5" /></svg>;
    case 'sliders': return <svg {...common}><path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2" /><circle cx="10" cy="16" r="2" /></svg>;
    case 'server': return <svg {...common}><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>;
    case 'brain': return <svg {...common}><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.5A3 3 0 0 0 6 17a3 3 0 0 0 6 .5V4.5A1.5 1.5 0 0 0 10.5 3 1.5 1.5 0 0 0 9 3Z" /><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5.5A3 3 0 0 1 18 17a3 3 0 0 1-6 .5" /></svg>;
    case 'clip': return <svg {...common}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 7.5 20 17M8 16.5 20 7M14 12l6-5M14 12l6 5" /></svg>;
    case 'share': return <svg {...common}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8 15.8 6.2M8.2 13.2 15.8 17.8" /></svg>;
    case 'badge': return <svg {...common}><path d="M12 2 4 5.5v6c0 5 3.4 8.6 8 10.5 4.6-1.9 8-5.5 8-10.5v-6L12 2Z" /><path d="m8.5 12 2.5 2.5L16 9" /></svg>;
    case 'globe': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" /></svg>;
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
// Shared styles
// ============================================================

const BTN_PRIMARY = 'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_12px_rgba(43,127,255,0.4)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_6px_20px_rgba(43,127,255,0.5)] active:scale-95 transition-all ease-out';
const BTN_OUTLINE = 'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out';

export default function LandingPage() {
  const [tab, setTab] = useState<IntegrationKey>('web');

  return (
    <div className={`${geist.className} min-h-screen flex flex-col bg-[#18181B] text-[#FAFAFA] tracking-tight`}>
      <style>{`
        @keyframes ssPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.35; transform: scale(0.8);} }
        @keyframes ssDash { to { stroke-dashoffset: 0; } }
        .ss-pulse { animation: ssPulse 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ss-pulse { animation: none !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#18181B]/85 backdrop-blur-lg z-30">
        <Link href="/" className="flex items-center gap-2.5">
          <SubstreamLogo className="h-5 w-auto" />
          <span className="text-lg font-semibold">Substream</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">Docs</Link>
          <Link href="/api/auth/demo-auto" className="hidden sm:block text-sm text-white/60 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/try" className={BTN_PRIMARY + ' h-9'}>See your platform</Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden px-6 pt-20 pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[560px] w-full"
          style={{ background: 'radial-gradient(120% 100% at 50% 0%, #18181B 50%, rgba(43,127,255,0.30) 100%)' }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-7">
          <p className="inline-flex h-8 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white/70">
            <span className="ss-pulse size-1.5 rounded-full bg-[#2B7FFF]" />
            White-label streaming for game studios
          </p>
          <h1 className="text-balance text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tighter leading-[1.05]">
            Your own private Twitch
            <br />
            <span className="text-[#2B7FFF]">for your community.</span>
          </h1>
          <p className="max-w-xl mx-auto text-base md:text-lg text-white/55 leading-relaxed">
            One SDK lets your players stream gameplay to your own site — you own the
            content, the data, and the revenue. AI highlights included.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/try" className={BTN_PRIMARY}>See your own streaming platform</Link>
            <a href="#demo" className={BTN_OUTLINE}>Watch it in action</a>
          </div>
          <p className="text-sm text-white/35">
            Enter your website — we generate a fully branded streaming experience in about a minute.
          </p>
        </div>
      </header>

      {/* Metrics */}
      <section className="border-y border-white/10 py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 80} className="text-center">
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-[#2B7FFF]">{m.value}</div>
              <div className="text-sm text-white/50 mt-1">{m.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Interactive Twitch-style demo */}
      <section id="demo" className="py-20 px-6 border-b border-white/10 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-10">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">This is what your players get</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">A live hub on your domain</h2>
            <p className="text-white/50 mt-3 max-w-xl mx-auto">
              Channels, player, real-time chat — running on your site, under your brand.
              Try the chat. It&apos;s live.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <TwitchSiteDemo />
          </Reveal>
          <Reveal delay={200} className="text-center mt-8">
            <Link href="/try" className="text-sm text-[#2B7FFF] hover:underline">
              Make it yours in 60 seconds — your logo, your colors →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Loom video */}
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

      {/* Problem framing + value pillars */}
      <section className="py-20 px-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="max-w-3xl mx-auto text-center mb-14">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">The problem</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter mb-4">
              Twitch, YouTube, and TikTok own the relationship with your players.
            </h2>
            <p className="text-white/55 leading-relaxed">
              When players clip, stream, and share your game on someone else&apos;s platform, you get
              zero data back. No emails, no watch patterns, no re-engagement lever — and no
              content-driven reason for a lapsed player to return. Substream flips that.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04]">
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#2B7FFF]/12 border border-[#2B7FFF]/25 transition-transform duration-500 group-hover:scale-110">
                    <Icon name={p.icon} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-4">{p.body}</p>
                  <ul className="space-y-2">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm text-white/60">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="mt-10 rounded-2xl border border-[#2B7FFF]/25 bg-[#2B7FFF]/[0.06] px-6 py-7 text-center">
              <p className="text-lg md:text-xl font-medium tracking-tight">
                You keep the player. You keep the data. You keep the revenue.
              </p>
              <p className="text-sm text-white/45 mt-2">
                Every view is a re-engagement event. Every replay increases LTV. Every share drives organic acquisition.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SDK / How it works */}
      <section id="sdk" className="py-20 px-6 border-b border-white/10 bg-white/[0.015] scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">The SDK</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">Players go live from inside your game.</h2>
            <p className="text-white/50 mt-3 max-w-xl mx-auto">
              No OBS, no stream keys to copy, no third-party app. The SDK captures gameplay
              and audio, publishes over WebRTC, and hands you a viewer URL to embed anywhere.
            </p>
          </Reveal>

          {/* Flow strip */}
          <div className="relative mb-14">
            <svg aria-hidden className="absolute left-0 right-0 top-[26px] hidden lg:block w-full h-1" preserveAspectRatio="none" viewBox="0 0 100 1">
              <line x1="2" y1="0.5" x2="98" y2="0.5" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              <line x1="2" y1="0.5" x2="98" y2="0.5" stroke={BRAND} strokeWidth="0.5" strokeDasharray="96" strokeDashoffset="96" style={{ animation: 'ssDash 2.4s ease-out forwards' }} />
            </svg>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
              {FLOW.map((f, i) => (
                <Reveal key={f.k} delay={i * 120} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 mb-4 flex items-center justify-center rounded-full border border-[#2B7FFF]/30 bg-[#18181B] text-[#2B7FFF] font-semibold" style={{ width: 52, height: 52 }}>
                    {i + 1}
                  </div>
                  <div className="font-semibold">{f.k}</div>
                  <div className="text-sm text-white/45 mt-0.5">{f.d}</div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Integration code tabs */}
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
          <Reveal delay={120} className="text-center mt-8">
            <Link href="/docs" className="text-sm text-[#2B7FFF] hover:underline">Read the integration docs →</Link>
          </Reveal>
        </div>
      </section>

      {/* AI highlight generation */}
      <section id="highlights" className="py-20 px-6 border-b border-white/10 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">AI highlights</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">
              A model that learns your game — and clips the best moments.
            </h2>
            <p className="text-white/50 mt-3 leading-relaxed">
              We train and fine-tune a highlight model on your specific game, then run it on every
              session. Players walk away with share-ready reels automatically — no editors, no
              highlight team, no manual tagging.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {HIGHLIGHTS.map((h, i) => (
              <Reveal key={h.step} delay={i * 100}>
                <div className="group relative h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04]">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-[#2B7FFF]/12 border border-[#2B7FFF]/25 transition-transform duration-500 group-hover:scale-110">
                      <Icon name={h.icon} />
                    </div>
                    <span className="text-xs font-mono text-white/35">0{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{h.step}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{h.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={220}>
            <div className="mt-10 rounded-2xl border border-[#2B7FFF]/25 bg-[#2B7FFF]/[0.06] px-6 py-7 text-center">
              <p className="text-lg md:text-xl font-medium tracking-tight">
                Fine-tuned per game. Sharper with every session.
              </p>
              <p className="text-sm text-white/45 mt-2 max-w-2xl mx-auto">
                The model gets better as it learns which clips your community actually watches and
                shares — turning every match into a re-engagement and acquisition loop you own.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Security & trust */}
      <section id="security" className="py-20 px-6 border-b border-white/10 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">Security &amp; compliance</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">Built to pass security review — and answer to players and parents.</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-500 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04]">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#2B7FFF]/12 border border-[#2B7FFF]/25">
                    <Icon name={s.icon} />
                  </div>
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <p className="mt-8 text-center text-sm text-white/40 max-w-2xl mx-auto">
              Twitch is 13+. YouTube Gaming moved to 16+. Your under-16 players — and their parents —
              have no engagement surface. With k-ID compliance infrastructure, Substream serves the
              segment your competitors can&apos;t.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden py-24 px-6 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[360px] w-full" style={{ background: 'radial-gradient(120% 100% at 50% 100%, #18181B 52%, rgba(43,127,255,0.24) 100%)' }} />
        <Reveal className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tighter">See your own streaming platform.</h2>
          <p className="text-white/55 leading-relaxed max-w-lg mx-auto">
            Tell us about your game and we&apos;ll spin up a branded live-streaming experience —
            your logo, your colors, your community. Then start a 90-day proof of concept at zero cost.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/try" className={BTN_PRIMARY}>See your own streaming platform</Link>
          </div>
          <p className="text-sm text-white/35">
            You keep all the data. If it works, we scale. If it doesn&apos;t, clean wind-down — no strings.
          </p>
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
            <Link href="/docs" className="text-white/40 hover:text-white transition-colors">Docs</Link>
            <Link href="/product-demo" className="text-white/40 hover:text-white transition-colors">Product</Link>
            <Link href="/demo" className="text-white/40 hover:text-white transition-colors">SDK Demo</Link>
            <Link href="https://github.com/jlin3/substream-sdk" className="text-white/40 hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
