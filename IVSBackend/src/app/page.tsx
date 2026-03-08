import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-brand-400">live</span>wave
        </span>
        <Link
          href="/login"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 transition-colors"
        >
          Log In
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
            Stream any game.
            <br />
            <span className="text-brand-400">Instantly.</span>
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            Plug our SDK into your game and give players the power to stream.
            Watch live, browse recordings, and get AI-generated highlights
            &mdash; all from one dashboard.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold hover:bg-brand-500 transition-colors"
            >
              Open Dashboard
            </Link>
            <a
              href="#how-it-works"
              className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              How It Works
            </a>
          </div>
        </div>
      </main>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-white/10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Three Steps to Live Streaming</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <Step
              number="1"
              title="Integrate the SDK"
              description="Drop a few lines of code into your web or Unity game. The Substream SDK captures the canvas and audio, then streams via WebRTC."
            />
            <Step
              number="2"
              title="Watch & Record"
              description="Players go live and viewers watch in real-time on your dashboard. Every session is automatically recorded to the cloud."
            />
            <Step
              number="3"
              title="AI Highlights"
              description="Our highlight service analyzes recordings and generates polished highlight reels with the best moments, automatically."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 px-6 text-center text-sm text-white/40">
        Powered by Substream SDK
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
