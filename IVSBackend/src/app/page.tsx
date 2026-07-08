'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Geist } from 'next/font/google';
import TwitchSiteDemo from '@/components/TwitchSiteDemo';
import HeroPlatformDemo from '@/components/HeroPlatformDemo';
import HighlightPipelineDemo from '@/components/HighlightPipelineDemo';
import Globe from '@/components/ui/Globe';
import FlickeringGrid from '@/components/ui/FlickeringGrid';
import SecurityShield from '@/components/ui/SecurityShield';
import { FAQS } from '@/lib/faqs';

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

// Metrics band: numeric target + prefix/suffix for count-up animation
const METRICS = [
  { target: 5, prefix: '', suffix: ' lines', label: 'to integrate', icon: 'code' },
  { target: 500, prefix: '<', suffix: 'ms', label: 'glass-to-glass latency', icon: 'bolt' },
  { target: 100, prefix: '', suffix: '%', label: 'on your domain', icon: 'globe' },
  { target: 90, prefix: '', suffix: ' days', label: 'zero-cost proof of concept', icon: 'calendar' },
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
    body: '100% of media revenue stays with the studio. Pick the monetization vectors that fit your community.',
    points: ['Sovereign advertising: video, banner, programmatic — your partners, your frequency', 'Superfan subscriptions: extended replays, early access, creator highlights', 'Contextual commerce: merch, DLC, and item upsells at peak emotional engagement', 'No platform take rate — ever'],
  },
  {
    icon: 'people',
    title: 'Your community',
    body: 'Give players a reason to come back between sessions. Highlights and livestreams turn passive players into an engaged community.',
    points: ['Post-session highlight reels, automated', 'Livestreams directly on your site or app', 'Community highlight feeds by game mode', 'Shareable clips that drive organic reach'],
  },
];

// Third-party platforms vs. first-party comparison (attention-loop framing)
const COMPARISON = [
  {
    dim: 'Data ownership',
    them: 'Platforms own the relationship, emails, and behavioral graphs.',
    us: 'You capture every view, click, replay, and share.',
  },
  {
    dim: 'Engagement location',
    them: 'Off-platform — pulling players away from active game sessions.',
    us: 'Hosted on your launcher, client widget, or website.',
  },
  {
    dim: 'Monetization',
    them: 'Platforms capture the ad spend and subscription margins.',
    us: '100% of ads, subscriptions, and commerce goes to the studio.',
  },
  {
    dim: 'Re-engagement',
    them: 'Generic, easily ignored push notifications and mass emails.',
    us: 'Personalized post-session highlights that trigger return sessions.',
  },
];

// How the fine-tuned highlight model turns raw gameplay into share-ready clips
const HIGHLIGHTS = [
  {
    icon: 'brain',
    step: 'Trained on your game',
    body: 'We fine-tune a highlight model on your titles, modes, and events — it learns what matters in your world: a clutch round, a boss kill, a personal best.',
  },
  {
    icon: 'clip',
    step: 'Auto-clipped in seconds',
    body: 'Gemini scores every segment of every session. Reels land within ~60 seconds of a match ending — no editors, no manual tagging.',
  },
  {
    icon: 'share',
    step: 'Branded & ready to share',
    body: 'Vertical and landscape cuts, captioned and watermarked with your brand, drop straight into your feed and players\u2019 socials.',
  },
];

// Security cards (bento tiles for SOC 2 + globe handled separately)
const SECURITY = [
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
    icon: 'server',
    title: 'Managed infrastructure',
    body: 'We run the ingest, delivery, recording, and ML pipeline. Your only lift is the SDK integration.',
  },
];

// FAQ content shared with the FAQPage JSON-LD in layout.tsx

const VIDEO = {
  id: 'e4798d41d35046468db7ef4d035f7087',
  title: 'Stream your gameplay live',
  label: 'Watch a Unity game go live with the Substream SDK',
};

// The actual Gemini-generated Halo highlight reel (from an 8-minute CTF session)
const HALO_HIGHLIGHT_ID = 'Wh1tHg1Ytcs';

// ============================================================
// Icons
// ============================================================

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: BRAND, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
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
    case 'code': return <svg {...common}><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg>;
    case 'bolt': return <svg {...common}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
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
// Count-up metric
// ============================================================

function CountUp({ target, prefix, suffix }: { target: number; prefix: string; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      io.disconnect();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setValue(target);
        return;
      }
      const duration = 1200;
      const t0 = performance.now();
      const frame = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{value}{suffix}
    </span>
  );
}

// ============================================================
// Shared styles
// ============================================================

const BTN_PRIMARY = 'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_12px_rgba(43,127,255,0.4)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_6px_20px_rgba(43,127,255,0.5)] active:scale-95 transition-all ease-out';
const BTN_OUTLINE = 'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out';

export default function LandingPage() {
  const [tab, setTab] = useState<IntegrationKey>('web');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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

      {/* Hero — copy left, live platform demo right */}
      <header className="relative overflow-hidden px-6 pt-16 pb-16 lg:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[640px] w-full"
          style={{ background: 'radial-gradient(120% 100% at 50% 0%, #18181B 50%, rgba(43,127,255,0.30) 100%)' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px] gap-12 lg:gap-14 items-center">
          <div className="space-y-7 text-center lg:text-left">
            <p className="inline-flex h-8 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white/70">
              <span className="ss-pulse size-1.5 rounded-full bg-[#2B7FFF]" />
              White-label streaming for game studios
            </p>
            <h1 className="text-balance text-4xl sm:text-5xl xl:text-6xl font-medium tracking-tighter leading-[1.05]">
              Your own private Twitch
              <br className="hidden sm:block" />
              <span className="text-[#2B7FFF]"> for your community.</span>
            </h1>
            <p className="max-w-xl mx-auto lg:mx-0 text-base md:text-lg text-white/55 leading-relaxed">
              One SDK lets your players stream gameplay to your own site — you own the
              content, the data, and the revenue. AI highlights included.
            </p>
            <div className="flex gap-3 justify-center lg:justify-start flex-wrap">
              <Link href="/try" className={BTN_PRIMARY}>See your own streaming platform</Link>
              <a href="#demo" className={BTN_OUTLINE}>Try the live demo</a>
            </div>
            <p className="text-sm text-white/35">
              Enter your website — we generate a fully branded streaming experience in about a minute.
            </p>
          </div>
          <Reveal delay={150} className="max-w-[520px] w-full mx-auto lg:mx-0">
            <HeroPlatformDemo />
          </Reveal>
        </div>
      </header>

      {/* Metrics band */}
      <section className="relative border-y border-white/10 py-10 px-6 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(43,127,255,0.6), transparent)' }}
        />
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {METRICS.map((m, i) => (
            <Reveal
              key={m.label}
              delay={i * 90}
              className={`relative flex flex-col items-center text-center px-4 py-3 ${i > 0 ? 'md:border-l md:border-white/[0.07]' : ''} ${i % 2 === 1 ? 'border-l border-white/[0.07] md:border-l' : ''}`}
            >
              <span className="mb-2.5 flex size-9 items-center justify-center rounded-lg bg-[#2B7FFF]/10 border border-[#2B7FFF]/20">
                <Icon name={m.icon} size={17} />
              </span>
              <div
                className="text-3xl md:text-4xl font-semibold tracking-tight bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(180deg, #9EC3FF 0%, #2B7FFF 100%)' }}
              >
                <CountUp target={m.target} prefix={m.prefix} suffix={m.suffix} />
              </div>
              <div className="text-[13px] text-white/45 mt-1.5">{m.label}</div>
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
              You&apos;re funding your own player attrition.
            </h2>
            <p className="text-white/55 leading-relaxed">
              When players clip, stream, and share your game on Twitch, YouTube, or TikTok, those
              platforms capture 100% of the audience relationship. You get zero data back — no emails,
              no watch patterns, no churn feedback loop. Worse: those networks use your players&apos;
              engagement to retarget them with ads for competing games. Substream flips that.
            </p>
          </Reveal>

          {/* Them vs. you comparison */}
          <Reveal delay={80}>
            <div className="mb-12 rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr] sm:grid-cols-[140px_1fr_1fr] text-sm">
                <div className="hidden sm:block px-4 py-3 bg-white/[0.02] border-b border-white/10" />
                <div className="px-4 py-3 bg-white/[0.02] border-b border-white/10 text-white/45 font-medium">
                  Twitch · YouTube · TikTok
                </div>
                <div className="px-4 py-3 bg-[#2B7FFF]/[0.08] border-b border-white/10 border-l border-white/10 font-semibold text-[#7EB1FF]">
                  Your platform, powered by Substream
                </div>
                {COMPARISON.map((row, i) => (
                  <div key={row.dim} className="contents">
                    <div className={`hidden sm:flex items-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-white/40 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                      {row.dim}
                    </div>
                    <div className={`px-4 py-3.5 text-white/45 leading-relaxed ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                      <span className="sm:hidden block text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-1">{row.dim}</span>
                      {row.them}
                    </div>
                    <div className={`px-4 py-3.5 leading-relaxed border-l border-white/10 bg-[#2B7FFF]/[0.04] text-white/80 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                      {row.us}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

          {/* LTV callout */}
          <Reveal delay={200}>
            <div className="mt-10 rounded-2xl border border-[#2B7FFF]/25 bg-[#2B7FFF]/[0.06] px-6 py-8 text-center">
              <p className="font-mono text-sm text-[#7EB1FF] mb-3 tracking-tight">
                LTV = ARPU ÷ churn
              </p>
              <p className="text-lg md:text-xl font-medium tracking-tight max-w-2xl mx-auto">
                Substream moves both variables: automated post-session highlights cut churn by pulling
                players back, and first-party ads, subscriptions, and commerce raise ARPU.
              </p>
              <p className="text-sm text-white/45 mt-3">
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
          <Reveal className="text-center mb-12 max-w-2xl mx-auto">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">AI highlights</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">
              Watch Gemini turn a full session into a highlight reel.
            </h2>
            <p className="text-white/50 mt-3 leading-relaxed">
              This is the real pipeline, running on a real Halo Infinite session: Gemini scores every
              segment, the best moments are selected, and FFmpeg assembles a share-ready reel of
              15–30 second clips — about 60 seconds after the match ends.
            </p>
          </Reveal>

          {/* Animated pipeline + result video */}
          <div className="grid lg:grid-cols-2 gap-6 mb-12 items-stretch">
            <Reveal delay={80}>
              <HighlightPipelineDemo />
            </Reveal>
            <Reveal delay={180}>
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0e0e10] overflow-hidden shadow-xl shadow-black/40">
                <div className="relative aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${HALO_HIGHLIGHT_ID}?autoplay=1&mute=1&loop=1&playlist=${HALO_HIGHLIGHT_ID}&controls=1&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3`}
                    title="AI-generated Halo Infinite highlight reel"
                    allow="autoplay; encrypted-media; fullscreen"
                    className="absolute inset-0 h-full w-full"
                  />
                  <div className="absolute top-3 left-3 pointer-events-none inline-flex items-center gap-1.5 rounded-md border border-[#2B7FFF]/40 bg-[#101321]/85 backdrop-blur px-2 py-1 text-[10px] font-semibold text-white/90">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
                    </svg>
                    AI-generated reel
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-center px-5 py-4">
                  <p className="text-sm font-semibold">The output — untouched by human hands</p>
                  <p className="text-xs text-white/45 mt-1 leading-relaxed">
                    Generated automatically from the full Halo session on the left. Seven moments,
                    75 seconds, crossfade transitions, normalized audio. No editor involved.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {['7 clips selected', '51 segments scored', '~60s after match end', 'fine-tuned per title'].map((chip) => (
                      <span key={chip} className="rounded-full border border-[#2B7FFF]/25 bg-[#2B7FFF]/[0.08] px-2.5 py-1 text-[10px] font-medium text-[#9EC3FF]">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

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

          {/* Feature bento: SOC 2 shield + rotating globe */}
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <Reveal>
              <div className="relative h-full min-h-[340px] rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-colors duration-500 hover:border-[#2B7FFF]/40">
                <div className="absolute inset-0 [mask-image:linear-gradient(to_top,transparent,black_55%)]">
                  <FlickeringGrid rgb="43, 127, 255" gridGap={4} squareSize={2} maxOpacity={0.22} className="mix-blend-screen" />
                </div>
                <SecurityShield className="absolute inset-x-0 top-6 bottom-24 mx-auto w-[210px]" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <h3 className="text-lg font-semibold tracking-tight">SOC 2, GDPR &amp; PCI DSS</h3>
                  <p className="text-sm text-white/50 mt-1">
                    Enterprise compliance across the stack — the controls your security and legal
                    teams review before they sign.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="relative h-full min-h-[340px] rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-colors duration-500 hover:border-[#2B7FFF]/40">
                <div className="absolute inset-x-0 top-10 bottom-16 [mask-image:linear-gradient(to_top,transparent_5%,black_45%)]">
                  <Globe />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <h3 className="text-lg font-semibold tracking-tight">Global scale &amp; SSO</h3>
                  <p className="text-sm text-white/50 mt-1">
                    Multi-CDN delivery with a 99.995% uptime SLA and SAML SSO for your team —
                    built for a worldwide player base.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 border-b border-white/10 bg-white/[0.015] scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-10">
            <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tighter">Questions game studios ask us</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={f.q} delay={i * 60}>
                  <div className={`rounded-2xl border transition-colors duration-300 ${open ? 'border-[#2B7FFF]/40 bg-[#2B7FFF]/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={open}
                    >
                      <span className="font-medium text-[15px]">{f.q}</span>
                      <svg
                        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`shrink-0 text-white/40 transition-transform duration-300 ${open ? 'rotate-180 text-[#2B7FFF]' : ''}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <div
                      className="grid transition-[grid-template-rows] duration-300 ease-out"
                      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm text-white/55 leading-relaxed">{f.a}</p>
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
