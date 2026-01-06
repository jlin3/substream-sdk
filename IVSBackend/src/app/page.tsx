export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>IVS Streaming Backend</h1>
      <p>This is the IVS streaming backend for Substream SDK.</p>
      
      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>POST /api/streams/children/:childId/ingest</code> - Get RTMPS ingest credentials</li>
        <li><code>GET /api/streams/children/:childId/playback</code> - Get playback URL and token</li>
        <li><code>POST /api/streams/children/:childId/sessions</code> - Create streaming session</li>
        <li><code>GET /api/streams/children/:childId/vods</code> - List recorded sessions</li>
        <li><code>GET /api/streams/sessions/:sessionId</code> - Get session info</li>
        <li><code>DELETE /api/streams/sessions/:sessionId</code> - End session</li>
        <li><code>POST /api/streams/sessions/:sessionId/heartbeat</code> - Send heartbeat</li>
      </ul>
      
      <h2>Quick Start</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`# 1. Install dependencies
pnpm install

# 2. Copy environment template
cp .env.example .env

# 3. Generate Prisma client
pnpm db:generate

# 4. Run database migrations
pnpm db:migrate

# 5. Start the server
pnpm dev`}
      </pre>
      
      <h2>Documentation</h2>
      <p>See <code>IVS_SETUP.md</code> in the repository root for complete setup instructions.</p>
    </main>
  );
}
