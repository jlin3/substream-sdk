# Architecture & Repo Separation

This monorepo contains both the **Substream SDK** (for game developers) and the **platform backend** (for operators). They are designed to be split into separate repos.

## SDK (stays in `substream-sdk`)

Code that game developers use to integrate streaming:

| Directory | Description |
|-----------|-------------|
| `packages/web-sdk/` | `@substream/web-sdk` npm package |
| `examples/web-game-demo/` | Standalone web game streaming demo |
| `examples/web-viewer/` | Stream viewer page |
| `UnityProject/` | Unity SDK scripts and plugins |
| `SDK_STREAMING_GUIDE.md` | Integration guide for game developers |
| `README.md` | SDK overview and quick start |

## Platform (migrates to `substream-platform`)

Operator infrastructure for hosting the streaming service:

| Directory | Description |
|-----------|-------------|
| `IVSBackend/src/app/dashboard/` | Dashboard UI (overview, browse, watch, streams, VODs, highlights, billing) |
| `IVSBackend/src/app/api/` | REST API routes (streaming, auth, webhooks, orgs) |
| `IVSBackend/src/app/login/` | Auth UI |
| `IVSBackend/src/lib/` | Auth, Prisma, streaming services |
| `IVSBackend/prisma/` | Database schema and migrations |
| `highlight-service/` | AI highlight generation (Python/FastAPI) |
| `IVS_BACKEND_SETUP.md` | Operator deployment guide |

## Demo (shared)

The `/demo` page and landing page live in `IVSBackend` currently but serve as the SDK's interactive demo. When splitting repos:

- The landing page and `/demo` should either stay in the SDK repo (as a lightweight demo server) or be deployed independently as a marketing site
- The dashboard is platform code and moves entirely

## Data Flow

```
Game (SDK)                    Platform (Backend)              Viewers
┌────────────┐               ┌──────────────────┐           ┌─────────┐
│ web-sdk or │──POST /api/──>│ IVSBackend       │           │ Browser │
│ Unity SDK  │  web-publish  │   ├ Prisma/DB    │           │ Viewer  │
│            │               │   ├ IVS Stages   │──WebRTC──>│         │
│ canvas +   │──WebRTC────-->│   ├ S3 Recording │           └─────────┘
│ audio      │  IVS Stage    │   └ Webhooks     │
└────────────┘               │                  │
                             │ highlight-service│
                             │   └ AI analysis  │
                             └──────────────────┘
```

## Archived

| Directory | Reason |
|-----------|--------|
| `_archive/WebappBackend/` | Superseded by IVSBackend (old WebRTC signaling server) |
| `_archive/docs-webrtc/` | WebRTC-era documentation |
| `_archive/docs-legacy/` | Outdated setup guides and migration docs |
