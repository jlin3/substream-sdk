import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-brand-400">sub</span>stream
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/api/auth/demo-auto"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/demo"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 transition-colors"
          >
            Live Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm font-medium text-brand-400 uppercase tracking-widest">
            Streaming SDK for Game Developers
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
            Add live streaming
            <br />
            <span className="text-brand-400">to any game.</span>
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            5 lines of code. Canvas capture, WebRTC delivery, cloud recording,
            and AI-powered highlights &mdash; all from one SDK.
          </p>

          {/* Code snippet */}
          <div className="max-w-lg mx-auto rounded-xl border border-white/10 bg-surface-100 text-left overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/30 font-mono">your-game.js</span>
            </div>
            <pre className="p-4 text-sm font-mono text-white/80 overflow-x-auto">
              <code>{`import Substream from '@substream/web-sdk';

const session = await Substream.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  authToken: 'your-token',
});`}</code>
            </pre>
          </div>

          <div className="flex gap-4 justify-center pt-4 flex-wrap">
            <Link
              href="/demo"
              className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold hover:bg-brand-500 transition-colors"
            >
              Try the Live Demo
            </Link>
            <Link
              href="/api/auth/demo-auto"
              className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              Explore the Dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-white/10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-center text-white/50 mb-16 max-w-2xl mx-auto">
            From integration to monetization in three steps.
            Works with Unity, WebGL, Phaser, Three.js, PixiJS, or any canvas-based engine.
          </p>
          <div className="grid md:grid-cols-3 gap-12">
            <Step
              number="1"
              title="Integrate the SDK"
              description="Drop a few lines of code into your web or Unity game. The SDK captures your canvas and audio, then streams via WebRTC with sub-second latency."
            />
            <Step
              number="2"
              title="Watch, Record, Monetize"
              description="Players go live and viewers watch in real-time. Every session is automatically recorded to the cloud. Track usage and revenue from your dashboard."
            />
            <Step
              number="3"
              title="AI Highlights"
              description="Our highlight engine analyzes recordings and generates polished highlight reels with the best moments — ready to share and drive engagement."
            />
          </div>
        </div>
      </section>

      {/* Social Proof / Use Cases */}
      <section className="border-t border-white/10 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Built for Game Studios</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <UseCase
              title="In-Game Streaming"
              description="Let players broadcast gameplay directly from your game — no OBS required. Works on web and Unity."
            />
            <UseCase
              title="Content & Highlights"
              description="Auto-generate highlight reels from streams. Give players shareable clips that drive organic growth."
            />
            <UseCase
              title="Analytics & Revenue"
              description="Track stream hours, concurrent viewers, and engagement. Monetize with usage-based pricing or viewer subscriptions."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-white/40">
            Substream SDK &mdash; Live streaming infrastructure for games
          </span>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/docs" className="text-white/40 hover:text-white transition-colors">Docs</Link>
            <Link href="/demo" className="text-white/40 hover:text-white transition-colors">Demo</Link>
            <Link href="https://github.com/jlin3/substream-sdk" className="text-white/40 hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-lg">
        {number}
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function UseCase({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-100 p-6 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{description}</p>
    </div>
  );
}
