# Substream Demo Guide

A runbook for demoing the Substream Gaming SDK to game studios and platform
buyers. It pairs a business talk track with exact clicks, a no-network fallback,
and answers to the questions that come up.

> **Fastest path:** open the guided walkthrough page at
> [`/product-demo`](https://substream-sdk-production.up.railway.app/product-demo).
> It lays out the same five-pillar story below with one-click links into each
> step of the demo.

---

## The story you're telling

Substream turns **any game** into a **live, monetizable platform** without the
studio building streaming infrastructure. Five capabilities, one integration:

| # | Pillar | The one-liner |
|---|--------|---------------|
| 1 | **Plugs into any game** | 5 lines of SDK code — web, Unity, or iOS. |
| 2 | **Streams to your website** | A viewer URL you embed on your own domain, sub-second latency. |
| 3 | **Data & content you own** | Streams, recordings, viewers, and events in your dashboard + API. |
| 4 | **Monetization options** | Usage-based billing plus subscription, watch-party, and clip revenue. |
| 5 | **Highlights + custom models** | AI clips out of the box, then fine-tuned to your game. |

The whole demo follows that order: integrate → watch on a site → own the data →
monetize → generate (and tune) highlights.

---

## Option A: Hosted demo (no setup)

Everything is deployed. These are the only links you need:

| Step | URL |
|------|-----|
| **Product walkthrough** | https://substream-sdk-production.up.railway.app/product-demo |
| **Landing page** | https://substream-sdk-production.up.railway.app |
| **Interactive demo** | https://substream-sdk-production.up.railway.app/demo |
| **Dashboard (auto-login)** | https://substream-sdk-production.up.railway.app/api/auth/demo-auto |

### Guided walkthrough (≈5 minutes)

1. **Open `/product-demo`.** Use it as your slide deck — scroll the five pillars
   so the buyer sees the whole loop before any clicks.
2. **Pillar 1 — Plugs into any game.** On `/demo`, click **Start Streaming**.
   The Breakout canvas goes live over WebRTC. Point out the event log: token
   request → canvas capture → IVS stage → connected. *"That's the entire
   integration — five lines, no OBS."*
3. **Pillar 2 — Streams to your website.** Click **Open viewer** on the demo to
   show the live player. *"This is the viewer URL the SDK returns. You embed it
   on your own site — players watch on your domain, not a third-party app."*
4. **Pillar 3 — Data & content you own.** Open the **Dashboard**. Show **Live
   Streams** (your session is there), then **Recordings** (auto-recorded VOD),
   then **Browse** (the content feed). *"Every session becomes owned content and
   queryable data."*
5. **Pillar 4 — Monetization.** Open **Usage & Billing**. Walk the cost
   breakdown and plan tiers. *"Stream-hours, viewer-hours, and highlights are
   metered. On top of that you can charge players, run watch parties, or sell
   clips."*
6. **Pillar 5 — Highlights + custom models.** On a recording, click **Generate
   Highlight**, then open the highlight detail to show the pipeline scoring and
   segment selection. Finish on **Highlights → Training** and **Compare**: *"The
   base model works on any game; you fine-tune it on your own clips so
   'exciting' means what it means in your title, and A/B it before rollout."*

---

## Option B: Local development (full E2E)

### Prerequisites

- PostgreSQL running locally
- Node 20+, pnpm
- AWS credentials configured in `.env` (only needed for real live streaming)

### Step 1: Run the backend

```bash
cd IVSBackend
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

### Step 2: Open the demo

Navigate to `http://localhost:3000`:

- **Product walkthrough** → `/product-demo`
- **Try the Live Demo** → `/demo` (interactive Breakout game)
- **Explore the Dashboard** → `/api/auth/demo-auto` (auto-login)

### Step 3: Stream from the standalone game demo (optional)

```bash
cd examples/web-game-demo
python3 -m http.server 8080
```

Open `http://localhost:8080` and point the config at `http://localhost:3000`.
This is the closest thing to a real third-party integration.

---

## Demo levels

| Level | What it shows | Requirements |
|-------|---------------|--------------|
| **0: Hosted** | Full story via deployed URLs | Browser only |
| **1: Local** | Backend + dashboard + game demo | Database + Node |
| **2: Full IVS** | Real live WebRTC streaming | AWS credentials |
| **3: Unity** | Native game → same viewer/dashboard | All above + Unity |
| **4: AI highlights** | Real highlight pipeline | highlight-service + GCP creds |
| **5: Custom model** | Tuned per-game scoring | Vertex AI tuning + `GEMINI_TUNED_MODEL` |

---

## Demo credentials

| Setting | Value |
|---------|-------|
| **API** | `https://substream-sdk-production.up.railway.app` |
| **Streamer ID** | `demo-child-001` |
| **Publish token** | `demo-token` |
| **Viewer token** | `demo-viewer-token` |
| **Dashboard** | Auto-login via `/api/auth/demo-auto` |

For manual login: org slug `substream-demo`, code is the `DEMO_ORG_CODE` env var.

---

## Fallback: when the network won't cooperate

Live WebRTC depends on the venue's network (corporate firewalls often block
UDP). The seed data is built so the story holds up even if you can't go live:

- **Seeded streams & highlights** mean the Dashboard, Browse, Recordings, and
  Highlights views are fully populated without streaming anything.
- If **Start Streaming** fails, switch to the **Dashboard** and narrate pillars
  3–5 entirely from seeded content — the buyer still sees the data, content,
  monetization, and highlight pipeline.
- For highlight generation specifically, lean on an already-`COMPLETED` seeded
  highlight to show the pipeline visualization rather than waiting on a fresh
  job.

Run `pnpm db:seed` (Level 1+) to get this content locally; the hosted demo is
already seeded.

---

## Tailoring the talk track

**Game studio (product/partnerships):** lead with pillars 1–2 (drop-in
integration, streaming on their own site) and 5 (highlights as organic growth).

**Platform / publisher (revenue):** lead with pillars 3–4 (owned data and
content, usage-based economics and revenue models), then show 5 as the
content-quality multiplier.

**Engineering evaluator:** start on `/demo` and the event log, open the
`/viewer/{streamId}` player, then the API reference in `/docs`. Emphasize that
web, Unity, and iOS all hit the same backend, viewer, and dashboard.

---

## FAQ / objection handling

**"Does this work with our engine?"** Anything that renders to a canvas (Phaser,
Three.js, PixiJS, Cocos, Construct, Unity WebGL) uses the Web SDK; Unity native
uses WHIP; iOS uses the native SDK. One backend for all of them.

**"Do players need OBS?"** No. Capture happens inside the game from SDK code.
One button for the player; viewers watch on your website.

**"Where does the video actually play?"** On your domain. The SDK returns a
viewer URL you can link or iframe. See `SDK_STREAMING_GUIDE.md` →
*Streaming to your website*.

**"Who owns the content and data?"** The studio. Streams, recordings, viewer
metrics, and highlights belong to your organization and are exposed through the
dashboard and API.

**"Can the AI understand our game?"** The base model is game-agnostic. For your
title, upload labelled examples and fine-tune so segment scoring matches your
genre. The Compare view proves the lift before you ship it.

---

## Sample data

The seed script creates:

- **10 streams** with YouTube gaming content (Halo, Fortnite, Rocket League,
  Valorant, Apex, Minecraft)
- **6 highlights** with real AI pipeline data (segment scoring, processing steps)
- **Demo users** for streaming and viewing
- **Demo organization** (`substream-demo`)

All streams have thumbnails and recording URLs pointing to real gaming videos
for a polished demo experience.
