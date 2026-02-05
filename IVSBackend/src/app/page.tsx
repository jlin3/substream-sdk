export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>IVS Streaming Backend</h1>
      <p>This is the IVS streaming backend for Substream SDK, supporting both RTMPS and WHIP streaming.</p>
      
      <h2>Streaming Modes</h2>
      <ul>
        <li><strong>RTMPS Mode</strong> - Traditional streaming via FFmpeg (higher latency, more reliable)</li>
        <li><strong>WHIP Mode</strong> - WebRTC-based streaming via IVS Real-Time (sub-second latency)</li>
      </ul>
      
      <h2>API Endpoints</h2>
      <h3>Common</h3>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>GET /api/version</code> - Version info</li>
      </ul>
      
      <h3>RTMPS Streaming</h3>
      <ul>
        <li><code>POST /api/streams/children/:childId/ingest</code> - Get RTMPS ingest credentials</li>
        <li><code>GET /api/streams/children/:childId/playback</code> - Get playback URL and token</li>
        <li><code>POST /api/streams/children/:childId/sessions</code> - Create streaming session</li>
        <li><code>GET /api/streams/children/:childId/vods</code> - List recorded sessions</li>
      </ul>
      
      <h3>WHIP (WebRTC) Streaming</h3>
      <ul>
        <li><code>POST /api/streams/whip</code> - WHIP endpoint (SDP offer/answer)</li>
        <li><code>POST /api/streams/:streamId/viewer</code> - Get subscribe token for viewing</li>
        <li><code>POST /api/streams/realtime/signal</code> - Real-time signaling endpoint</li>
      </ul>
      
      <h3>Sessions</h3>
      <ul>
        <li><code>GET /api/streams/sessions/:sessionId</code> - Get session info</li>
        <li><code>DELETE /api/streams/sessions/:sessionId</code> - End session</li>
        <li><code>POST /api/streams/sessions/:sessionId/heartbeat</code> - Send heartbeat</li>
      </ul>
      
      <h2>Web Viewer</h2>
      <p>Parents can view streams at: <code>/viewer/:streamId</code></p>
      <p>Query parameters:</p>
      <ul>
        <li><code>auth</code> - Authorization token (optional)</li>
        <li><code>parentId</code> - Parent user ID</li>
        <li><code>childId</code> - Child ID (for validation)</li>
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
      <p>See <code>IVS_BACKEND_SETUP.md</code> and <code>SDK_STREAMING_GUIDE.md</code> in the repository root for setup instructions.</p>
    </main>
  );
}
