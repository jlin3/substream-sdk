'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });

const HOSTED_API = 'https://substream-sdk-production.up.railway.app';

// Substream wave mark (matches substream.ai navbar logo)
function SubstreamLogo({ className }: { className?: string }) {
  return (
    <svg width="42" height="24" viewBox="0 0 42 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g clipPath="url(#ss_clip)">
        <path
          d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z"
          fill="#2B7FFF"
        />
        <path
          d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z"
          fill="#2B7FFF"
        />
      </g>
      <defs>
        <clipPath id="ss_clip">
          <rect width="42" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

// ============================================================
// Integration code samples (the "plug into any game" story)
// ============================================================

type IntegrationKey = 'web' | 'unity' | 'ios' | 'script';

const INTEGRATIONS: Record<
  IntegrationKey,
  { label: string; engines: string; code: string }
> = {
  web: {
    label: 'Web / WebGL',
    engines: 'Phaser, Three.js, PixiJS, Cocos, Construct, Unity WebGL',
    code: `import Substream from '@substream/web-sdk';

// Any HTML5 <canvas> game goes live in 5 lines.
const session = await Substream.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  streamerId: 'player-456',
  authToken: 'sk_live_...',
});

// This URL renders the live player on YOUR website.
console.log('Live! Embed this:', session.viewerUrl);`,
  },
  unity: {
    label: 'Unity Native',
    engines: 'Windows, macOS, Quest 2/3/Pro',
    code: `using Substream.Streaming;

// 1. Add WhipStreamControl to a GameObject
// 2. Set Backend URL + Streamer ID + Auth Token in the Inspector
// 3. Start streaming from code (or press 'U' to toggle):
streamControl.StartStreaming();

// Viewers watch on your site via the returned viewer URL:
string viewerUrl = streamControl.GetViewerUrl();`,
  },
  ios: {
    label: 'iOS Native',
    engines: 'Metal, MTKView, SpriteKit, SceneKit, UIKit, ReplayKit',
    code: `import SubstreamSDK

let session = try await Substream.startStream(
  .init(
    backendUrl: URL(string: "https://your-api.com")!,
    authToken: "sk_live_...",
    streamerId: "player-456",
    capture: .metalView(self.gameView)   // or .spriteKit, .replayKit
  )
)

print("Live!", session.viewerUrl)`,
  },
  script: {
    label: 'Script tags',
    engines: 'No npm, no bundler — drop into any page',
    code: `<script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
<script src="substream.js"></script>
<script>
  const session = await Substream.startStream({
    canvas: document.getElementById('game-canvas'),
    backendUrl: 'https://your-api.com',
    streamerId: 'player-456',
    authToken: 'sk_live_...',
  });
  console.log('Viewer URL:', session.viewerUrl);
</script>`,
  },
};

const EMBED_SNIPPET = `<!-- Drop the live player straight onto your site -->
<iframe
  src="https://your-api.com/viewer/STREAM_ID"
  allow="autoplay; fullscreen"
  style="width:100%; aspect-ratio:16/9; border:0; border-radius:12px"
></iframe>`;

// ============================================================
// Monetization (mirrors the dashboard billing model)
// ============================================================

const PRICING = [
  { component: 'Stream hours', rate: '$0.12 / hr', note: 'Time players spend broadcasting' },
  { component: 'Viewer hours', rate: '$0.03 / hr', note: 'Time viewers spend watching' },
  { component: 'AI highlights', rate: '$0.50 / each', note: 'Each generated highlight reel' },
];

const REVENUE_MODELS = [
  {
    title: 'Streaming as a feature',
    body: 'Charge players to go live in your game, or bundle it into a premium tier. You own the relationship and the pricing.',
  },
  {
    title: 'Watch parties & viewer tiers',
    body: 'Monetize viewing with subscriptions, gifted access, or ad-supported tiers. Viewer-hours are tracked per stream.',
  },
  {
    title: 'Highlight & clip marketplace',
    body: 'Auto-generated highlight reels are shareable content that drives organic acquisition — or premium downloadable clips.',
  },
];

// ============================================================
// Highlight pipeline (game-agnostic + custom model)
// ============================================================

const PIPELINE = [
  { step: 'Scene analysis', detail: 'Cloud Video Intelligence detects shots, labels, objects, and on-screen text.' },
  { step: 'Audio analysis', detail: 'RMS energy analysis finds spikes — crowd noise, explosions, callouts.' },
  { step: 'AI scoring', detail: 'Gemini scores each segment by visual action and game context.' },
  { step: 'Selection', detail: 'Weighted scoring picks the strongest moments across all signals.' },
  { step: 'Assembly', detail: 'FFmpeg compiles segments with crossfades and normalized audio.' },
];

const DEMO_STEPS = [
  {
    n: '1',
    title: 'Watch a game go live',
    body: 'Open the interactive demo. A Breakout canvas game uses the SDK to start streaming over WebRTC in one click.',
    href: '/demo',
    cta: 'Open the live demo',
  },
  {
    n: '2',
    title: 'See it on a website player',
    body: 'The SDK returns a viewer URL. That same URL is what your company embeds on its own site — no OBS, no third-party app.',
    href: '/dashboard/browse',
    cta: 'Open the content feed',
  },
  {
    n: '3',
    title: 'Own the data & content',
    body: 'Every session lands in the dashboard: live status, duration, viewers, recordings, and events — all queryable and yours.',
    href: '/api/auth/demo-auto',
    cta: 'Explore the dashboard',
  },
  {
    n: '4',
    title: 'Generate AI highlights',
    body: 'Pick a recording and generate a highlight reel. Watch the pipeline score and select the best moments automatically.',
    href: '/dashboard/highlights',
    cta: 'View highlights',
  },
  {
    n: '5',
    title: 'Tune a custom model',
    body: 'Upload examples of what "exciting" means in your game, then A/B the base model against a tuned one built for your title.',
    href: '/dashboard/highlights/training',
    cta: 'Open model training',
  },
];

const FAQS = [
  {
    q: 'Does this work with our engine?',
    a: 'Yes. Anything that renders to a canvas (Phaser, Three.js, PixiJS, Cocos, Construct, Unity WebGL) uses the Web SDK. Unity native uses WHIP, and iOS uses the native SDK. Same backend, same viewer, same dashboard.',
  },
  {
    q: 'Do players need OBS or a third-party app?',
    a: 'No. Streaming happens inside your game from a few lines of SDK code. Players tap one button; viewers watch on your website.',
  },
  {
    q: 'Where does the video play?',
    a: 'On your own site. The SDK returns a viewer URL you can link or iframe directly. The IVS Real-Time player delivers sub-second latency.',
  },
  {
    q: 'Who owns the content and data?',
    a: 'You do. Streams, recordings, viewer metrics, and generated highlights all belong to your organization and are exposed through the dashboard and API.',
  },
  {
    q: 'Can the highlights understand our game?',
    a: 'The base model is game-agnostic and works out of the box. For your title, you can fine-tune on your own examples so "exciting" means what it means in your game.',
  },
];

// Shared button styles (match substream.ai)
const BTN_PRIMARY =
  'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_8px_rgba(43,127,255,0.35)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 active:scale-95 transition-all ease-out';
const BTN_OUTLINE =
  'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out';

export default function ProductDemoPage() {
  const [tab, setTab] = useState<IntegrationKey>('web');

  return (
    <div className={`${geist.className} min-h-screen flex flex-col bg-[#18181B] text-[#FAFAFA] tracking-tight`}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#18181B]/85 backdrop-blur-lg z-20">
        <Link href="/" className="flex items-center gap-2.5">
          <SubstreamLogo className="h-5 w-auto" />
          <span className="text-lg font-semibold">Substream</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">
            Docs
          </Link>
          <Link href="/api/auth/demo-auto" className={BTN_OUTLINE + ' h-9'}>
            Dashboard
          </Link>
          <Link href="/demo" className={BTN_PRIMARY + ' h-9'}>
            Live Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden px-6 pt-24 pb-20 text-center border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[440px] w-full"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 0%, #18181B 52%, rgba(43,127,255,0.28) 100%)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto space-y-7">
          <p className="inline-flex h-8 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white/70">
            <span className="size-1.5 rounded-full bg-[#2B7FFF]" />
            White-label streaming &amp; monetization for games
          </p>
          <h1 className="text-balance text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tighter leading-[1.05]">
            Turn any game into a
            <br />
            <span className="text-[#2B7FFF]">live, monetizable platform.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base md:text-lg text-white/55 leading-relaxed">
            Substream drops into your game, streams gameplay to your own website,
            and hands you the data, the content, the monetization, and AI highlights
            tuned to your title — all from one SDK.
          </p>
          <div className="flex gap-3 justify-center pt-2 flex-wrap">
            <a href="#run-the-demo" className={BTN_PRIMARY}>
              Run the 5-minute demo
            </a>
            <Link href="/demo" className={BTN_OUTLINE}>
              See a game stream live
            </Link>
          </div>
        </div>
      </header>

      {/* The full loop — 5 pillars */}
      <section className="px-6 py-20 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-medium tracking-tighter text-center mb-3">The full loop</h2>
          <p className="text-center text-white/50 mb-14 max-w-2xl mx-auto">
            Five capabilities, one integration. This is the entire product in the order
            you would demo it.
          </p>

          {/* Flow strip */}
          <div className="flex flex-wrap items-stretch justify-center gap-3 mb-14 text-sm">
            {[
              'Any game',
              'Substream SDK',
              'Your website',
              'Data & content',
              'Monetization',
              'AI highlights',
            ].map((node, i, arr) => (
              <div key={node} className="flex items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 font-medium">
                  {node}
                </span>
                {i < arr.length - 1 && <span className="text-[#2B7FFF]">→</span>}
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5">
            <Pillar num="1" title="Plugs into any game" body="5 lines of SDK code. Web, Unity, and iOS — any engine that renders frames." anchor="#integrate" />
            <Pillar num="2" title="Streams to your website" body="A viewer URL you can link or iframe. Sub-second latency, on your domain." anchor="#website" />
            <Pillar num="3" title="Data & content you own" body="Streams, recordings, viewers, and events — all in your dashboard and API." anchor="#data" />
            <Pillar num="4" title="Monetization options" body="Usage-based billing plus revenue models: subscriptions, watch parties, clips." anchor="#monetize" />
            <Pillar num="5" title="Highlights + custom models" body="AI clips out of the box, then fine-tuned to what's exciting in your game." anchor="#highlights" />
          </div>
        </div>
      </section>

      {/* 1. Integrate */}
      <Section id="integrate" eyebrow="Pillar 1" title="Plugs into any game">
        <p className="text-white/55 max-w-2xl mb-8">
          Capture happens inside your game and publishes over WebRTC — no OBS, no
          external broadcaster. Pick the surface that matches your stack; the backend,
          viewer, and dashboard are identical for all of them.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          {/* Tabs */}
          <div className="flex flex-wrap border-b border-white/10">
            {(Object.keys(INTEGRATIONS) as IntegrationKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'text-white border-b-2 border-[#2B7FFF] bg-[#2B7FFF]/10'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {INTEGRATIONS[key].label}
              </button>
            ))}
          </div>
          <div className="p-5">
            <p className="text-xs text-white/40 mb-3">Works with: {INTEGRATIONS[tab].engines}</p>
            <pre className="text-sm font-mono text-white/80 overflow-x-auto leading-relaxed">
              <code>{INTEGRATIONS[tab].code}</code>
            </pre>
          </div>
        </div>
      </Section>

      {/* 2. Website */}
      <Section id="website" eyebrow="Pillar 2" title="Streams to your company website">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-white/55 mb-6">
              Every stream returns a <code className="text-[#2B7FFF]">viewerUrl</code> pointing at
              the IVS Real-Time player. Link it, pop it in a tab, or iframe it directly into your
              product. Viewers watch on your domain with sub-second latency — not a third-party
              platform.
            </p>
            <ul className="space-y-3 text-sm text-white/70">
              <FeatureLi>Sub-second, glass-to-glass latency via IVS Real-Time stages.</FeatureLi>
              <FeatureLi>No app install — it runs in the browser.</FeatureLi>
              <FeatureLi>Token-scoped access so private streams stay private.</FeatureLi>
              <FeatureLi>Same URL backs the dashboard&apos;s live watch and Browse feed.</FeatureLi>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10 text-xs text-white/30 font-mono">
              your-site.html
            </div>
            <pre className="p-5 text-sm font-mono text-white/80 overflow-x-auto leading-relaxed">
              <code>{EMBED_SNIPPET}</code>
            </pre>
          </div>
        </div>
      </Section>

      {/* 3. Data & content */}
      <Section id="data" eyebrow="Pillar 3" title="The data and content are yours">
        <p className="text-white/55 max-w-2xl mb-8">
          Substream is the infrastructure layer — your organization owns what comes out of it.
          The dashboard turns raw streams into a content library and an analytics surface.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <InfoCard title="Live streams" body="Real-time status, duration, and concurrent viewers for every active session." />
          <InfoCard title="Recordings / VODs" body="Every stream is auto-recorded to S3 and replayable as a VOD." />
          <InfoCard title="Content feed" body="A Twitch-style Browse view of live, recorded, and highlight content." />
          <InfoCard title="Webhooks & events" body="stream.started, stream.stopped, viewer.joined/left — pushed to your backend, HMAC-signed." />
        </div>
      </Section>

      {/* 4. Monetize */}
      <Section id="monetize" eyebrow="Pillar 4" title="Built-in monetization options">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h3 className="text-lg font-semibold mb-4">Usage-based pricing</h3>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-left">
                    <th className="px-4 py-3 font-medium">Component</th>
                    <th className="px-4 py-3 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING.map((row) => (
                    <tr key={row.component} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.component}</div>
                        <div className="text-xs text-white/40">{row.note}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#2B7FFF] whitespace-nowrap">{row.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-white/40 mt-3">
              The dashboard&apos;s Usage &amp; Billing tab shows live cost breakdowns and plan tiers.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Revenue models you can build</h3>
            <div className="space-y-4">
              {REVENUE_MODELS.map((m) => (
                <div key={m.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <h4 className="font-semibold mb-1">{m.title}</h4>
                  <p className="text-sm text-white/50 leading-relaxed">{m.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 5. Highlights + custom model */}
      <Section id="highlights" eyebrow="Pillar 5" title="AI highlights — tuned to your game">
        <p className="text-white/55 max-w-2xl mb-8">
          The highlight service turns a long recording into a shareable reel automatically. It works
          out of the box on any game, and it can be fine-tuned so &quot;exciting&quot; means what it means
          in your title.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50 mb-5">
            The pipeline
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PIPELINE.map((p, i) => (
              <div key={p.step} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2B7FFF]/15 border border-[#2B7FFF]/30 text-[#2B7FFF] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="font-medium text-sm">{p.step}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-[#2B7FFF]/30 bg-[#2B7FFF]/[0.08] p-6">
            <h4 className="font-semibold mb-2">Custom model for your title</h4>
            <p className="text-sm text-white/65 leading-relaxed mb-3">
              Upload labelled examples of great moments from your game. Substream exports training
              data and fine-tunes a Gemini model so segment scoring reflects your genre — a headshot
              in an FPS, a comeback in a racer, a boss kill in an RPG.
            </p>
            <p className="text-xs text-white/45">
              Positive feedback on generated highlights is captured automatically to grow the
              training set over time.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h4 className="font-semibold mb-2">Prove it with A/B comparison</h4>
            <p className="text-sm text-white/65 leading-relaxed mb-3">
              The Compare view runs the base model against your tuned model on the same recording, so
              you can see — segment by segment — how much the custom model improves selection before
              you roll it out.
            </p>
            <Link href="/dashboard/highlights/compare" className="text-sm text-[#2B7FFF] hover:underline">
              Open the model comparison →
            </Link>
          </div>
        </div>
      </Section>

      {/* Run the demo */}
      <section id="run-the-demo" className="px-6 py-20 border-b border-white/10 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest text-center mb-2">
            Guided walkthrough
          </p>
          <h2 className="text-3xl font-medium tracking-tighter text-center mb-3">Run the demo in 5 minutes</h2>
          <p className="text-center text-white/50 mb-12 max-w-2xl mx-auto">
            Follow these five steps in order to tell the whole story — integration to monetization to
            custom AI. Everything is live on the hosted environment; no setup required.
          </p>

          <div className="space-y-4">
            {DEMO_STEPS.map((s) => (
              <div
                key={s.n}
                className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="w-10 h-10 shrink-0 rounded-full bg-[#2B7FFF]/15 border border-[#2B7FFF]/30 flex items-center justify-center text-[#2B7FFF] font-bold">
                  {s.n}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{s.body}</p>
                </div>
                <Link href={s.href} className={BTN_PRIMARY + ' h-10 shrink-0 text-center'}>
                  {s.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Demo credentials */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50 mb-4">
              Demo credentials
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Cred label="API" value={HOSTED_API} />
              <Cred label="Streamer ID" value="demo-child-001" />
              <Cred label="Publish token" value="demo-token" />
              <Cred label="Viewer token" value="demo-viewer-token" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20 border-b border-white/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-medium tracking-tighter text-center mb-12">Common questions</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer font-medium">
                  {f.q}
                  <span className="text-[#2B7FFF] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="text-sm text-white/55 leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-6 py-20 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[300px] w-full"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 100%, #18181B 55%, rgba(43,127,255,0.22) 100%)',
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-medium tracking-tighter">Ready to see it on your game?</h2>
          <p className="text-white/55">
            Start with the live demo, then explore the dashboard. When you&apos;re ready, the
            integration is the same five lines you saw above.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/demo" className={BTN_PRIMARY}>
              Try the Live Demo
            </Link>
            <Link href="/docs" className={BTN_OUTLINE}>
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-white/40">
            <SubstreamLogo className="h-4 w-auto opacity-70" />
            Substream &mdash; live streaming infrastructure for games
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

// ============================================================
// Small presentational helpers
// ============================================================

function Pillar({ num, title, body, anchor }: { num: string; title: string; body: string; anchor: string }) {
  return (
    <a
      href={anchor}
      className="block rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-[#2B7FFF]/40 hover:bg-white/[0.04] transition-colors"
    >
      <div className="w-8 h-8 rounded-full bg-[#2B7FFF]/15 border border-[#2B7FFF]/30 flex items-center justify-center text-[#2B7FFF] font-bold text-sm mb-3">
        {num}
      </div>
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{body}</p>
    </a>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="px-6 py-20 border-b border-white/10 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-medium text-[#2B7FFF] uppercase tracking-widest mb-2">{eyebrow}</p>
        <h2 className="text-3xl font-medium tracking-tighter mb-8">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function FeatureLi({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="text-[#2B7FFF] mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{body}</p>
    </div>
  );
}

function Cred({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#18181B] px-4 py-3">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className="text-sm break-all font-mono text-[#2B7FFF]">{value}</div>
    </div>
  );
}
