# Substream SDK — Medium-Term Roadmap

4-week plan targeting game studios (B2B deals), indie developers (adoption), and investors (metrics story).

## Week 1: Foundations + Developer Experience

### Real API Key System
- Add `ApiKey` model to Prisma schema: `id`, `orgId`, `name`, `hashedKey`, `prefix`, `scopes`, `createdAt`, `lastUsedAt`, `revokedAt`
- Add `POST/GET/DELETE /api/keys` routes with proper auth
- Update `/dashboard/keys` to use real DB-backed keys instead of client-side demo state
- Update auth middleware to validate `sk_live_*` tokens against the database
- **Audience:** All

### Docs Site Live
- Deploy `docs-site/` to Vercel or GitHub Pages with custom domain (e.g. `docs.substream.dev`)
- Update nav links across the app to point to the real docs site
- **Audience:** Indie devs, studios

### npm Publish
- Publish `@substream/web-sdk@1.0.0` to npm
- Create a CDN-hosted UMD bundle (via esbuild) for script-tag users at a stable URL
- Add badges to GitHub README: npm version, CI status, license
- **Audience:** Indie devs

---

## Week 2: Monetization + Platform Split

### Stripe Billing Integration
- Add Stripe Checkout for plan upgrades (Starter -> Growth -> Scale)
- Create `UsageRecord` model to meter stream hours and viewer hours per org
- Show real metered usage on the billing page instead of estimates
- Add invoice history to the billing dashboard
- **Audience:** Studios, investors

### Platform Repo Migration
- Follow `ARCHITECTURE.md` to split repos:
  - `substream-platform`: Dashboard, auth, Prisma, org management, billing, highlight-service
  - `substream-sdk` (this repo): SDK packages, examples, Unity, minimal demo backend, docs
- Set up CI/CD on the platform repo (Railway auto-deploy)
- Update SDK repo to point at the hosted platform API as default
- **Audience:** Engineering hygiene

---

## Week 3: Growth + Examples

### Example Integrations
- `examples/phaser-demo/` — Phaser.js game with streaming integration
- `examples/threejs-demo/` — Three.js 3D scene with streaming
- `examples/unity-webgl-demo/` — Unity WebGL build with web SDK
- Each example gets its own README with a "Deploy to Vercel" one-click button
- **Audience:** Indie devs, studios

### Analytics Dashboard
- Add `/dashboard/analytics` page showing:
  - Daily/weekly/monthly active streamers
  - Total stream hours trend (line chart)
  - Viewer-to-streamer ratio
  - Highlight generation rate
  - API call volume
- Wire to real data from `Stream`, `Highlight`, and `ApiKey` models
- **Audience:** Investors, studios

### GitHub + Social Presence
- Add an animated GIF showing the demo flow to the README
- Write a "Why Substream?" section in the README
- Create a short demo video (90 seconds)
- **Audience:** All

---

## Week 4: Sales Enablement + Launch

### Custom Demo Environments
- Add `POST /api/orgs` for self-service org creation
- Each prospect gets their own org with isolated data
- Optional: pre-seed with prospect's game branding/assets
- **Audience:** Studios

### One-Pager PDF Generator
- Auto-generate a branded PDF from dashboard data showing:
  - Usage metrics and growth trends
  - Cost projections at scale (10x, 100x current usage)
  - Feature comparison vs building streaming in-house
  - Integration timeline estimate (hours, not months)
- **Audience:** Studios, investors

### Launch Prep
- Product Hunt listing draft + assets
- Hacker News "Show HN" post draft
- Blog post: "How to add live streaming to any web game in 5 minutes"
- Twitter/X thread with demo GIFs
- **Audience:** All

---

## Success Metrics

| Metric | Week 1 | Week 2 | Week 3 | Week 4 |
|--------|--------|--------|--------|--------|
| npm weekly downloads | 10+ | 25+ | 50+ | 100+ |
| Demo page unique visitors | 50+ | 100+ | 250+ | 500+ |
| API keys created | 5+ | 10+ | 15+ | 25+ |
| Streams via SDK | 10+ | 25+ | 50+ | 100+ |
| Studio conversations | 2+ | 3+ | 4+ | 5+ |

---

## Dependencies + Manual Steps

| Task | Depends On | Owner |
|------|-----------|-------|
| npm publish | npm login + @substream org creation | Jesse |
| Stripe integration | Stripe account setup | Jesse |
| Custom domain for docs | Domain DNS setup | Jesse |
| Railway reseed | Railway DB access | Jesse |
| Demo video | All Phase 1 changes deployed | Jesse |
| Product Hunt | Demo video + polished README | Jesse |
