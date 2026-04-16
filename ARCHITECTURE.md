# Substream SDK — Architecture & System Design

## Overview

Substream is a streaming SDK + platform that lets game developers add live streaming to any canvas-based web game or Unity title with a few lines of code. The system handles video ingest via AWS IVS Real-Time, automatic cloud recording, AI-powered highlight generation, and a full operator dashboard.

This monorepo contains both the SDK (for game developers) and the platform backend (for operators). A future split is planned per the Repo Separation section below.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              substream-sdk/                                 │
│                                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐  ┌───────────┐ │
│  │ packages/    │  │ IVSBackend/      │  │ highlight-     │  │ docs-     │ │
│  │ web-sdk/     │  │ (Next.js 15)     │  │ service/       │  │ site/     │ │
│  │              │  │                  │  │ (FastAPI)      │  │ (Docusau- │ │
│  │ @substream/  │  │ API routes       │  │                │  │  rus)     │ │
│  │ web-sdk      │  │ Dashboard UI     │  │ Video Intel    │  │           │ │
│  │ on npm       │  │ Auth system      │  │ Gemini AI      │  │ docs.     │ │
│  │              │  │ Prisma/Postgres  │  │ FFmpeg          │  │ livewave  │ │
│  │              │  │ IVS integration  │  │                │  │ .ai       │ │
│  └──────────────┘  └──────────────────┘  └────────────────┘  └───────────┘ │
│  ┌──────────────┐  ┌──────────────────┐                                     │
│  │ UnityProject/│  │ examples/        │                                     │
│  │ Unity 6 SDK  │  │ web-game-demo/   │                                     │
│  │ scripts      │  │ web-viewer/      │                                     │
│  └──────────────┘  └──────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
Game Client                      Platform Backend                    Viewers
┌──────────────┐                 ┌─────────────────────┐           ┌──────────┐
│ @substream/  │  POST /api/     │ IVSBackend          │           │ Browser  │
│ web-sdk      │──streams/──────>│  ├ Auth (JWT/API key)│           │ /viewer/ │
│   or         │  web-publish    │  ├ Prisma → Postgres │           │ [id]     │
│ Unity SDK    │                 │  ├ IVS Stage Pool    │──WebRTC──>│          │
│              │──WebRTC────────>│  ├ S3 Recording      │           └──────────┘
│ canvas +     │  via IVS Stage  │  ├ Webhooks          │
│ audio        │                 │  └ Stream/Highlight DB│
└──────────────┘                 │                      │
                                 │  highlight-service   │
                                 │  ├ Video Intelligence│
                                 │  ├ Gemini scoring    │
                                 │  └ FFmpeg assembly   │
                                 └─────────────────────┘
```

**Streaming lifecycle:**
1. SDK calls `POST /api/streams/web-publish` with a Bearer token (API key or demo token)
2. Backend allocates an IVS Real-Time stage, creates a `Stream` record, fires `stream.started` webhook
3. SDK joins the stage via WebRTC using the returned `publishToken`
4. Viewers connect via `GET /api/streams/[streamId]/viewer` which returns a subscribe token
5. On stop, SDK calls `DELETE /api/streams/web-publish`, backend updates the stream to ENDED/RECORDED
6. Optionally, the highlight service analyzes the recording and generates a highlight reel

---

## Database Schema

Four models in PostgreSQL via Prisma:

```
Organization ──< Stream ──< Highlight
     │
     └──< ApiKey
```

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **Organization** | `id`, `name`, `slug` | Tenant/org grouping for streams and keys |
| **ApiKey** | `hashedKey` (SHA-256), `prefix`, `scopes[]`, `revokedAt` | SDK authentication; plaintext shown once at creation |
| **Stream** | `streamerId`, `status` (IDLE/LIVE/ENDED/RECORDED), `ivsStageArn`, `durationSecs` | Tracks every streaming session |
| **Highlight** | `streamId?`, `status` (PENDING/PROCESSING/COMPLETED/FAILED), `pipelineData` (JSON), `jobId` | AI-generated highlight reels |

---

## Authentication

Three auth methods, resolved in order by `src/lib/auth/middleware.ts`:

| Method | Format | When Used |
|--------|--------|-----------|
| **Demo tokens** | `Bearer demo-token` / `Bearer demo-viewer-token` | Non-production, or when `DEMO_ORG_CODE` is set |
| **API keys** | `Bearer sk_live_...` | SDK integration; validated against `ApiKey` table by SHA-256 hash |
| **JWT** | `Bearer eyJ...` | Programmatic API access; signed with `JWT_SECRET` (HS256) |

Dashboard auth uses a separate HTTP-only session cookie (`lw_session`) with its own JWT, managed by `src/lib/auth/session.ts`. The Next.js middleware at `src/middleware.ts` protects all `/dashboard/*` routes.

---

## API Routes

### Streaming

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/streams/web-publish` | POST, DELETE, GET | POST/DELETE: Bearer | Allocate/release IVS stage, create/end stream |
| `/api/streams/whip` | POST, DELETE, GET | POST: Bearer | WHIP ingest protocol for Unity/native clients |
| `/api/streams/[streamId]/viewer` | GET, POST | Bearer | Get subscribe token for viewing a live stream |
| `/api/streams/realtime/signal` | POST, GET | No | Experimental WebRTC signaling bridge (returns 501) |

### Organization & Dashboard

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/orgs/[slug]` | GET | Session cookie | Org summary with stream/highlight counts |
| `/api/orgs/[slug]/streams` | GET | Session cookie | Paginated stream list, filterable by status |
| `/api/orgs/[slug]/streams/[id]` | PATCH | Session cookie | Update stream metadata |
| `/api/orgs/[slug]/highlights` | GET, POST | Session cookie | List highlights; trigger highlight generation |
| `/api/orgs/[slug]/highlights/[id]` | GET | Session cookie | Highlight detail with pipeline status polling |

### Auth & Keys

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/demo-auto` | GET | No | Auto-login to demo org, set session cookie, redirect |
| `/api/auth/demo-login` | POST | No | Login with org slug + access code |
| `/api/auth/logout` | POST | No | Clear session cookie |
| `/api/keys` | GET, POST, DELETE | Session cookie | CRUD for org API keys |
| `/api/webhooks` | GET, POST, DELETE | No | Register/list/delete webhook endpoints (in-memory) |

### Infrastructure

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/health` | GET | No | Service health: DB, AWS, IVS, stage pool status |
| `/api/version` | GET | No | Version metadata and feature list |

---

## Page Routes

| URL | Type | Description |
|-----|------|-------------|
| `/` | Server | Marketing landing page with hero, code sample, feature cards |
| `/demo` | Client | Interactive Breakout game that streams via the SDK |
| `/docs` | Server | In-app documentation page |
| `/login` | Client | Org slug + access code login form |
| `/viewer/[streamId]` | Client | Live stream viewer using IVS Real-Time subscribe |
| `/dashboard` | Server | Overview: stats, recent streams, recent highlights |
| `/dashboard/browse` | Server | Featured content hub with carousels |
| `/dashboard/watch` | Server+Client | Video player for live/recorded/highlight content |
| `/dashboard/streams` | Server | Live and past stream listings |
| `/dashboard/streams/[id]` | Server+Client | Stream detail with live viewer or VOD playback |
| `/dashboard/vods` | Server | Recordings grid with highlight generation |
| `/dashboard/highlights` | Server | Highlights grid |
| `/dashboard/highlights/[id]` | Server+Client | Highlight detail with pipeline visualization |
| `/dashboard/billing` | Server | Usage metrics, cost estimates, pricing tiers |
| `/dashboard/keys` | Client | API key management (create, list, revoke) |

---

## Backend Libraries (`IVSBackend/src/lib/`)

| Module | Exports | Purpose |
|--------|---------|---------|
| `auth/middleware.ts` | `authenticate`, `requireAuth`, `requireScopes` | Request auth resolution (demo → API key → JWT) |
| `auth/session.ts` | `createSessionToken`, `verifySessionToken`, `getSession` | Dashboard JWT sessions via `lw_session` cookie |
| `auth/jwt.ts` | `signJwt`, `verifyJwt` | HS256 JWT for API authentication |
| `auth/api-keys.ts` | `generateApiKeyPair`, `hashApiKey`, `isApiKeyFormat` | `sk_live_` key generation and SHA-256 hashing |
| `prisma.ts` | `prisma` singleton | PrismaClient with pg adapter and pool tuning |
| `streaming/stage-pool.ts` | `allocateStage`, `releaseStage`, `getStagePoolStatus` | IVS Real-Time stage allocation and publish/subscribe tokens |
| `streaming/ivs-client.ts` | `createChannel`, `getChannel`, `createStreamKey`, etc. | IVS Low-Latency channel control plane |
| `streaming/ivs-realtime-client.ts` | `getStage` | IVS Real-Time stage SDK helpers |
| `streaming/playback-auth.ts` | `generatePlaybackToken`, `generateCloudFrontSignedUrl` | Viewer playback authorization |
| `streaming/encryption.ts` | `encryptStreamKey`, `decryptStreamKey` | AES encryption for stream key storage |
| `webhooks/webhook-service.ts` | `registerWebhook`, `dispatchWebhookEvent` | In-memory webhook registry with HMAC signing |

---

## Highlight Service (`highlight-service/`)

FastAPI application that generates AI-powered highlight reels from stream recordings.

**Pipeline stages:**
1. **Download** — Fetch recording from S3/GCS
2. **Scene Analysis** — Google Cloud Video Intelligence (shot detection, labels, text, object tracking)
3. **Audio Analysis** — FFmpeg extract + pydub/numpy energy peaks
4. **Segment Scoring** — Vertex AI Gemini multimodal scoring (frames + labels + audio)
5. **Selection** — Weighted algorithm picks best segments to target duration
6. **Assembly** — FFmpeg crossfade transitions + loudnorm audio normalization

**API endpoints** (under `/api/v1`):

| Route | Method | Purpose |
|-------|--------|---------|
| `/highlights` | POST | Start async highlight job from `video_uri` |
| `/highlights/upload` | POST | Multipart upload → GCS → job |
| `/highlights` | GET | List all jobs |
| `/highlights/{job_id}` | GET | Job status and result |
| `/signed-url` | GET | Signed download URL for `gs://` URIs |
| `/health` | GET | Service health check |

---

## Web SDK (`packages/web-sdk/`)

Published as `@substream/web-sdk` on npm. Single-file TypeScript SDK.

**Exports:** `SubstreamSDK` class (also default export), `SubstreamConfig`, `SubstreamSession`

**Key API:**
- `SubstreamSDK.captureAudio()` — Call before game engine init to monkey-patch `AudioNode.connect` for audio capture
- `SubstreamSDK.startStream(config)` → `SubstreamSession` — Requests publish token, captures canvas, joins IVS stage
- `session.stop()` — Stops tracks, leaves stage, notifies backend

**Config fields:** `backendUrl`, `canvasElement`, `streamerId`, `authToken`, `orgId?`, `streamerName?`, `title?`, `fps?` (default 30), `audio?` (default true), `onLive?`, `onError?`, `onStopped?`, `onReconnecting?`

---

## Unity SDK (`UnityProject/`)

Unity 6 project with multiple streaming paths:

| Script | Path | Purpose |
|--------|------|---------|
| `IVSRealTimeStreamControl.cs` | WebRTC | Unity WebRTC peer connection to IVS Real-Time stage |
| `WhipStreamControl.cs` | WHIP | End-to-end WHIP protocol via `/api/streams/whip` |
| `WhipClient.cs` | WHIP | HTTP/WebRTC WHIP client (SDP, ICE) |
| `IVSStreamControl.cs` | RTMPS | FFmpeg-based RTMP/RTMPS ingest to IVS |
| `FFmpegRTMPPublisher.cs` | RTMPS | Native FFmpeg publish loop |
| `NativeFFmpegBridge.cs` | RTMPS | P/Invoke to `ffmpeg_rtmp` native library |
| `RenderStreamControl.cs` | Legacy | Unity Render Streaming signaling integration |

---

## Deployment

| Service | Platform | Build | Health |
|---------|----------|-------|--------|
| **IVSBackend** | Railway (Nixpacks) | `npm install` → `prisma generate` → `next build` | `/api/health` |
| **highlight-service** | Railway (Dockerfile) | Python 3.12-slim + ffmpeg + uvicorn | `/health` |
| **docs-site** | GitHub Pages | Docusaurus build via Actions workflow | Static site |

**CI/CD workflows** (`.github/workflows/`):
- `ci.yml` — Backend typecheck + Web SDK typecheck/build on push/PR to main
- `deploy-docs.yml` — Build and deploy docs-site to GitHub Pages on push to `docs-site/**`
- `claude-review.yml` — AI code review on PRs via Anthropic API (advisory, non-blocking)

---

## Environment Variables

### IVSBackend (Required)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_REGION` | AWS region for IVS |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `JWT_SECRET` | Signs API JWTs and dashboard sessions (required in production) |

### IVSBackend (Optional)

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEMO_ORG_CODE` | Demo login access code | `livewave123` |
| `IVS_STAGE_ARN` | Pre-provisioned IVS Real-Time stage | — |
| `IVS_CHANNEL_ARN` | IVS Low-Latency channel | — |
| `IVS_RECORDING_CONFIG_ARN` | IVS recording configuration | — |
| `IVS_PLAYBACK_KEY_PAIR_ID` | Playback authorization key pair | — |
| `IVS_PLAYBACK_PRIVATE_KEY` | Playback authorization private key | — |
| `S3_RECORDING_BUCKET` | Bucket for recording URLs | — |
| `STREAM_KEY_ENCRYPTION_KEY` | AES key for stream key encryption | — |
| `HIGHLIGHT_SERVICE_URL` | Highlight service endpoint | `http://localhost:8080` |
| `DB_POOL_MAX` / `DB_POOL_MIN` | Postgres pool tuning | `20` / `2` |

### Highlight Service

| Variable | Purpose |
|----------|---------|
| `GCP_PROJECT` | Google Cloud project ID |
| `GCS_SOURCE_BUCKET` | Source video bucket |
| `GCS_HIGHLIGHTS_BUCKET` | Output highlights bucket |
| `GEMINI_MODEL` | Vertex AI model (default `gemini-3.1-pro-preview`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP service account key path |

---

## Docs Site (`docs-site/`)

Docusaurus 3 site deployed to GitHub Pages at `docs.livewave.ai`.

**Sidebar structure:**
- Introduction
- **Quick Start:** Web (5 min), Unity, Script Tags (2 min)
- **Concepts:** Streams, Recordings, Highlights, Webhooks
- API Reference, SDK Reference, Monetization

---

## Relationship to `substream-platform`

The platform repo ([github.com/jlin3/substream-platform](https://github.com/jlin3/substream-platform)) is a separate Next.js 15 app that extends the SDK backend with multi-tenant, engagement, and analytics features. Both repos can serve as a `backendUrl` for the SDK -- the browser/Unity client doesn't care which backend it talks to.

### How They Connect

```
Browser / Unity Game
       │
       │  SubstreamSDK.startStream({ backendUrl: '...' })
       │
       ▼
┌──────────────────────┐          ┌────────────────────────────┐
│ substream-sdk        │          │ substream-platform         │
│ (IVSBackend)         │          │                            │
│                      │          │                            │
│ /api/streams/*       │◄── OR ──►│ /api/streams/*             │
│ /api/health          │          │ /api/orgs/[orgId]/apps     │
│ /api/keys            │          │ /api/orgs/[orgId]/keys     │
│ /api/webhooks        │          │ /api/orgs/[orgId]/analytics│
│                      │          │ /api/streams/[id]/chat     │
│ Demo dashboard       │          │ /api/streams/[id]/reactions│
│ Highlight service    │          │ /api/streams/[id]/events   │
│ AI pipeline          │          │ /api/apps/[appId]/tokens   │
│                      │          │ /api/metrics (Prometheus)  │
│ Railway (production) │          │ Embeddable viewer widget   │
└──────────────────────┘          └────────────────────────────┘
       │                                    │
       ▼                                    ▼
  Same IVS stages                    Same IVS stages
  Same AWS credentials               Same AWS credentials
  Separate Postgres DB               Separate Postgres DB
```

The SDK client connects to whichever `backendUrl` it's configured with. Both backends implement the same core streaming contract (`/api/streams/web-publish`, `/api/streams/whip`, `/api/streams/[streamId]/viewer`), so the SDK works identically against either.

### What Each Repo Owns

| Capability | SDK Repo (this repo) | Platform Repo |
|-----------|---------------------|---------------|
| **Core streaming** (publish, view, stop) | Yes | Yes (same API contract) |
| **Auth** (JWT, API keys, demo tokens) | Yes | Yes (same pattern, duplicated code) |
| **Organization model** | Simple (name, slug) | Extended (plan tier, limits, members) |
| **API keys** | Org-scoped, `sk_live_*` | Org-scoped + rate limits, expiry |
| **Streams** | Org-scoped | App-scoped (App belongs to Org) |
| **Highlights / AI pipeline** | Yes (highlight-service) | No |
| **Chat & reactions** | No | Yes (IVS Chat + HTTP routes) |
| **Analytics dashboard** | No | Yes (org analytics API + UI) |
| **Embeddable viewer widget** | No | Yes (`public/embed.js`) |
| **Webhooks** | In-memory | Persisted (DB + BullMQ) |
| **Multi-tenancy** | Single org | Full (Org → App → Stream hierarchy) |
| **Dashboard** | Full (browse, watch, streams, VODs, highlights, billing, keys) | Minimal (analytics viewer) |
| **Demo / landing page** | Yes (Breakout game, marketing page) | API docs landing |
| **Docs site** | Yes (Docusaurus at docs.livewave.ai) | No |
| **npm package** | Yes (`@substream/web-sdk`) | No |
| **Unity SDK** | Yes | No |
| **Redis / BullMQ** | No | Yes |
| **Prometheus metrics** | No | Yes |
| **Legacy family/child models** | Removed (archived) | Still present in schema |

### Schema Comparison

Both repos use Prisma + PostgreSQL with **separate databases**.

| Model | SDK Schema | Platform Schema |
|-------|-----------|----------------|
| `Organization` | `id`, `name`, `slug`, `logoUrl` | Same + `plan`, `maxApps`, `maxStreamsPerApp`, `maxViewersPerStream` |
| `ApiKey` | `hashedKey`, `prefix`, `scopes[]`, `revokedAt` | `keyHash`, `prefix`, `scopes[]`, `isActive`, `expiresAt`, `rateLimit` |
| `Stream` | `orgId`, `streamerId`, `status`, highlights relation | `appId`, `streamerId`, `status`, VOD fields, viewer metrics, no highlights |
| `Highlight` | Full model with pipeline data | Not present |
| `App` | Not present | `orgId`, `name`, `platform`, token management |
| `OrgMember` | Not present | `orgId`, `userId`, `role` (OWNER/ADMIN/MEMBER) |
| `ChatRoom` | Not present | `streamId`, IVS chat ARN |
| `WebhookEndpoint/Delivery` | Not present (in-memory only) | Full persisted models |

### Shared Code (Duplicated, Not Shared)

The following modules exist in both repos with the same logic but separate implementations:

- `src/lib/auth/middleware.ts` — Bearer token resolution (demo → API key → JWT)
- `src/lib/auth/jwt.ts` — HS256 JWT signing/verification, issuer `substream`
- `src/lib/auth/api-keys.ts` — `sk_live_` format, SHA-256 hashing
- `src/lib/streaming/stage-pool.ts` — IVS Real-Time stage allocation
- `src/lib/prisma.ts` — PrismaClient singleton with pg adapter

If both backends share the same `JWT_SECRET`, tokens issued by one are valid on the other.

### Current Deployment State

| Repo | Deployed | URL |
|------|----------|-----|
| `substream-sdk` (IVSBackend) | Railway | `substream-sdk-production.up.railway.app` |
| `substream-platform` | Not deployed (4 commits, development stage) | — |

The SDK repo's IVSBackend is the live production backend. The platform repo is a young, development-stage codebase (initial feature commit + hardening PR) that is not yet deployed.

---

## Future Repo Separation

When the platform matures, the plan is:

**Stays in `substream-sdk`:**
- `packages/web-sdk/` — npm package
- `examples/` — standalone demos
- `UnityProject/` — Unity SDK
- `docs-site/` — documentation
- Minimal demo backend for the `/demo` page
- SDK guides (`SDK_STREAMING_GUIDE.md`, `README.md`)

**Moves to / already in `substream-platform`:**
- Full dashboard UI with analytics
- Multi-tenant org/app management
- Chat, reactions, engagement features
- Embeddable viewer widget
- Persistent webhooks (DB + BullMQ)
- Redis scaling layer
- Prometheus metrics
- Highlight service integration (currently only in SDK repo)

---

## Archived Code (`_archive/`)

| Directory | Reason |
|-----------|--------|
| `_archive/WebappBackend/` | Superseded by IVSBackend (old WebRTC signaling server) |
| `_archive/docs-webrtc/` | WebRTC-era documentation |
| `_archive/docs-legacy/` | Outdated setup guides and migration docs |
| `_archive/legacy-streaming-routes/` | Legacy child/session API routes using removed Prisma models |
| `_archive/legacy-streaming-services/` | Legacy streaming service modules using removed Prisma models |
