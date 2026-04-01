import Link from 'next/link';

const SECTIONS = [
  {
    title: 'Quick Start',
    items: [
      {
        title: 'Web Games (5 min)',
        description: 'Stream any HTML5 canvas game with 5 lines of code. Works with Phaser, Three.js, PixiJS, Unity WebGL, and more.',
        code: `import Substream from '@substream/web-sdk';

const session = await Substream.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: 'https://your-api.com',
  authToken: 'your-token',
});`,
      },
      {
        title: 'Unity Native',
        description: 'Copy the SDK scripts into your Unity project, add the streaming component, and configure your backend URL.',
        code: `// 1. Add IVSRealTimeStreamControl to a GameObject
// 2. Configure in Inspector:
//    Backend URL: https://your-api.com
//    Streamer ID: player-123
//    Auth Token:  your-token
// 3. Start streaming:
streamControl.StartStreaming(); // or press 'U'`,
      },
      {
        title: 'Script Tags (zero build step)',
        description: 'For the simplest integration, just add two script tags. No npm, no bundler.',
        code: `<script src="https://web-broadcast.live-video.net/1.32.0/amazon-ivs-web-broadcast.js"></script>
<script src="substream.js"></script>
<script>
  const session = await Substream.startStream({
    canvas: document.getElementById('game-canvas'),
    backendUrl: 'https://your-api.com',
    childId: 'player-123',
    authToken: 'your-token',
  });
</script>`,
      },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      {
        title: 'Streams',
        description: 'A stream is created when a player starts broadcasting. The SDK captures the canvas, encodes it via WebRTC, and publishes to an IVS Real-Time stage. Streams are tracked in the dashboard with live status, duration, and viewer count.',
      },
      {
        title: 'Recordings',
        description: 'Every stream is automatically recorded to S3 via IVS. Recordings appear in the dashboard once the stream ends. They can be played back as VODs or used as input for AI highlight generation.',
      },
      {
        title: 'AI Highlights',
        description: 'The highlight service analyzes recordings using Google Cloud Video Intelligence and Gemini to identify the best moments. It scores segments by visual action, audio intensity, and AI analysis, then assembles a polished highlight reel with crossfade transitions.',
      },
      {
        title: 'Webhooks',
        description: 'Register webhook endpoints to receive real-time notifications. Events include stream.started, stream.stopped, viewer.joined, and viewer.left. Payloads are HMAC-signed for security.',
      },
    ],
  },
];

const API_REFERENCE = [
  { method: 'POST', path: '/api/streams/web-publish', description: 'Start a stream (allocate IVS stage, get publish token)' },
  { method: 'DELETE', path: '/api/streams/web-publish', description: 'Stop a stream (release stage)' },
  { method: 'GET', path: '/api/streams/web-publish', description: 'Check stage pool status' },
  { method: 'POST', path: '/api/streams/whip', description: 'Start a stream via WHIP (Unity)' },
  { method: 'GET', path: '/api/streams/{streamId}/viewer', description: 'Get viewer subscribe token' },
  { method: 'POST', path: '/api/webhooks', description: 'Register a webhook endpoint' },
  { method: 'GET', path: '/api/webhooks', description: 'List registered webhooks' },
  { method: 'DELETE', path: '/api/webhooks', description: 'Remove a webhook' },
  { method: 'GET', path: '/api/health', description: 'Service health check' },
];

const DEMO_CREDS = [
  { label: 'API URL', value: 'https://substream-sdk-production.up.railway.app' },
  { label: 'Child ID', value: 'demo-child-001' },
  { label: 'Auth Token', value: 'demo-token' },
  { label: 'Viewer Token', value: 'demo-viewer-token' },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-brand-400">sub</span>stream
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/demo" className="text-sm text-white/60 hover:text-white transition-colors">
            Demo
          </Link>
          <Link href="/api/auth/demo-auto" className="text-sm text-white/60 hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link
            href="https://github.com/jlin3/substream-sdk"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            GitHub
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Documentation</h1>
          <p className="text-lg text-white/60">
            Everything you need to add live streaming to your game.
          </p>
        </div>

        {/* Demo credentials */}
        <section className="rounded-xl border border-brand-500/20 bg-brand-600/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-brand-400">Try It Now</h2>
          <p className="text-sm text-white/60">
            Use these credentials to test streaming immediately against our hosted API.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {DEMO_CREDS.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-surface-200 px-4 py-2.5">
                <span className="text-xs text-white/50">{label}</span>
                <code className="text-sm font-mono text-white/80">{value}</code>
              </div>
            ))}
          </div>
        </section>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <section key={section.title} className="space-y-8">
            <h2 className="text-2xl font-bold">{section.title}</h2>
            {section.items.map((item) => (
              <div key={item.title} className="space-y-3">
                <h3 className="text-lg font-semibold text-white/90">{item.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{item.description}</p>
                {'code' in item && item.code && (
                  <pre className="rounded-xl border border-white/10 bg-surface-100 p-4 text-sm font-mono text-white/70 overflow-x-auto">
                    <code>{item.code}</code>
                  </pre>
                )}
              </div>
            ))}
          </section>
        ))}

        {/* API Reference */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold">API Reference</h2>
          <p className="text-sm text-white/60">
            All endpoints require an <code className="text-white/80 bg-surface-200 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer {'<token>'}</code> header.
          </p>
          <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden divide-y divide-white/5">
            {API_REFERENCE.map((endpoint, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  endpoint.method === 'GET' ? 'bg-green-900/30 text-green-400' :
                  endpoint.method === 'POST' ? 'bg-blue-900/30 text-blue-400' :
                  'bg-red-900/30 text-red-400'
                }`}>
                  {endpoint.method}
                </span>
                <code className="text-sm font-mono text-white/70">{endpoint.path}</code>
                <span className="text-xs text-white/40 ml-auto">{endpoint.description}</span>
              </div>
            ))}
          </div>
        </section>

        {/* SDK Reference */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold">SDK Reference</h2>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold font-mono text-brand-400">SubstreamSDK.startStream(config)</h3>
              <p className="text-sm text-white/60">Start streaming a canvas element. Returns a session object with <code className="text-white/80 bg-surface-200 px-1.5 py-0.5 rounded text-xs">stop()</code>, <code className="text-white/80 bg-surface-200 px-1.5 py-0.5 rounded text-xs">streamId</code>, <code className="text-white/80 bg-surface-200 px-1.5 py-0.5 rounded text-xs">viewerUrl</code>, and <code className="text-white/80 bg-surface-200 px-1.5 py-0.5 rounded text-xs">isLive</code>.</p>
              <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden divide-y divide-white/5">
                {[
                  ['canvasElement', 'HTMLCanvasElement', 'Yes', 'The canvas to capture'],
                  ['backendUrl', 'string', 'Yes', 'Substream API URL'],
                  ['streamerId', 'string', 'Yes', 'Unique player/streamer ID'],
                  ['authToken', 'string', 'Yes', 'API key or JWT'],
                  ['orgId', 'string', 'No', 'Organization ID'],
                  ['title', 'string', 'No', 'Stream title'],
                  ['fps', 'number', 'No', 'Frame rate (default: 30)'],
                  ['audio', 'boolean', 'No', 'Include audio (default: true)'],
                  ['onLive', 'function', 'No', 'Called when live'],
                  ['onError', 'function', 'No', 'Called on error'],
                  ['onStopped', 'function', 'No', 'Called when stopped'],
                ].map(([name, type, required, desc]) => (
                  <div key={name} className="px-5 py-2.5 grid grid-cols-4 gap-4 text-sm">
                    <code className="font-mono text-white/80">{name}</code>
                    <span className="text-white/50 font-mono text-xs">{type}</span>
                    <span className="text-white/40">{required}</span>
                    <span className="text-white/50">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold font-mono text-brand-400">SubstreamSDK.captureAudio()</h3>
              <p className="text-sm text-white/60">
                Enable automatic audio capture. Must be called <strong>before</strong> the game engine creates its AudioContext.
                Monkey-patches AudioNode.connect to tee audio into a MediaStream. Audio still plays through speakers normally.
              </p>
            </div>
          </div>
        </section>

        {/* Footer links */}
        <section className="border-t border-white/10 pt-8 flex flex-wrap gap-6 text-sm">
          <Link href="/demo" className="text-brand-400 hover:text-brand-300">Interactive Demo</Link>
          <Link href="/api/auth/demo-auto" className="text-brand-400 hover:text-brand-300">Dashboard</Link>
          <Link href="https://github.com/jlin3/substream-sdk" className="text-brand-400 hover:text-brand-300">GitHub</Link>
          <Link href="https://github.com/jlin3/substream-sdk/tree/main/packages/web-sdk" className="text-brand-400 hover:text-brand-300">npm Package</Link>
        </section>
      </div>
    </div>
  );
}
