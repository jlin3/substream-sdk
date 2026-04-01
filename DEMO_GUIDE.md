# Substream Demo Guide

End-to-end demo of the Substream SDK streaming platform.

## Demo Flow

The demo showcases three capabilities:

1. **SDK Integration** — A web game uses the Substream SDK to go live
2. **Dashboard** — Browse live streams, recordings, and AI highlights
3. **AI Highlights** — Generate highlight reels from recordings automatically

---

## Option A: Hosted Demo (No Setup)

Everything is deployed. Just open these links:

1. **Landing page**: https://substream-sdk-production.up.railway.app
2. **Interactive demo**: https://substream-sdk-production.up.railway.app/demo
3. **Dashboard** (auto-login): https://substream-sdk-production.up.railway.app/api/auth/demo-auto

### Walkthrough

1. Open the **Landing page** — shows the value prop and code snippet
2. Click **Try the Live Demo** — you'll see a Breakout game on a canvas
3. Click **Start Streaming** — the game goes live via IVS WebRTC
4. Click **Open Dashboard** in the top nav — auto-logs you into the dashboard
5. Go to **Live Streams** — your stream appears with a LIVE badge
6. Stop streaming, then navigate to **Recordings** — the VOD appears
7. Click **Generate Highlight** on any recording
8. Check **Highlights** — see completed AI highlight reels with pipeline visualization

---

## Option B: Local Development (Full E2E)

### Prerequisites

- PostgreSQL running locally
- Node 20+, pnpm
- AWS credentials configured in `.env`

### Step 1: Set Up the Backend

```bash
cd IVSBackend
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

### Step 2: Open the Demo

Navigate to `http://localhost:3000`. The landing page loads with:
- **Try the Live Demo** → `/demo` (interactive Breakout game)
- **Explore the Dashboard** → `/api/auth/demo-auto` (auto-login, no credentials needed)

### Step 3: Stream from the Standalone Game Demo (Optional)

```bash
cd examples/web-game-demo
python3 -m http.server 8080
```

Open `http://localhost:8080`. Update the config to point at `http://localhost:3000`.

---

## Demo Levels

| Level | What It Shows | Requirements |
|-------|---------------|--------------|
| **Level 0: Hosted** | Full demo via deployed URLs | Browser only |
| **Level 1: Local** | Backend + dashboard + game demo | Database + Node |
| **Level 2: Full IVS** | Live streaming with real IVS stages | AWS credentials |
| **Level 3: Unity** | Complete system with Unity SDK | All above + Unity |

---

## Demo Credentials

| Setting | Value |
|---------|-------|
| **API** | `https://substream-sdk-production.up.railway.app` |
| **Child ID** | `demo-child-001` |
| **Auth Token** | `demo-token` |
| **Viewer Token** | `demo-viewer-token` |
| **Dashboard** | Auto-login via `/api/auth/demo-auto` |

For manual login: org slug `substream-demo`, code is the `DEMO_ORG_CODE` env var (default: `livewave123`).

---

## What to Demo (Script)

### For Technical Audiences

1. Show the landing page — code snippet demonstrates simplicity
2. Open the live demo — play the game, start streaming, show the event log
3. Open the dashboard — show live stream appearing in real-time
4. Navigate recordings — show automatic cloud recording
5. Generate a highlight — show the AI pipeline visualization
6. Show the highlight detail — pipeline steps, segment scoring, source vs output

### For Business Audiences

1. Landing page — "5 lines of code to add streaming to any game"
2. Dashboard overview — stats, streams, recordings, highlights at a glance
3. Browse tab — Twitch-style content discovery feed
4. Highlights — AI-generated content that drives engagement
5. Usage/billing tab — stream hours, viewer counts, estimated revenue

---

## Sample Data

The seed script creates:

- **10 streams** with YouTube gaming content (Halo, Fortnite, Rocket League, Valorant, Apex, Minecraft)
- **6 highlights** with real AI pipeline data (segment scoring, processing steps)
- **Demo users** for streaming and viewing
- **Demo organization** (`substream-demo`)

All streams have thumbnails and recording URLs pointing to real YouTube gaming videos for a polished demo experience.
