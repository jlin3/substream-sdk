---
sidebar_position: 8
title: Monetization
---

# Monetization

Substream provides usage-based billing so you can build a streaming business on top of your game.

## How Pricing Works

Billing is usage-based across three metered dimensions. These are the units that show up on your invoice and in the dashboard:

| Component | Metered by | Description |
|-----------|------------|-------------|
| **Stream hours** | Each hour a player is live | Time your players spend streaming, counted whether or not anyone is watching |
| **Viewer hours** | Each hour watched, per viewer | Time viewers spend watching streams, so this tracks audience size |
| **AI highlights** | Each generated reel | Auto-generated highlight reels |

Stream hours and viewer hours are metered separately because they scale independently. A stream nobody watches still costs ingest and transcode; a stream with a large audience is mostly delivery. AI highlights are metered per reel because annotation cost follows stream time rather than audience size.

**Rates are quoted per agreement.** Substream is pre-general-availability, and we don't publish per-unit rates yet. Your region, delivery architecture, and committed volume each move the underlying cost by more than a rounding error, so a single published number would be wrong for most teams in one direction or the other. [Tell us about your title](https://substream.ai/try) and we'll quote against your actual volumes.

## Plans

| Plan | Included | Best for |
|------|----------|----------|
| **Starter** | 100 stream hours/month | Evaluating the SDK and shipping a prototype |
| **Growth** | 1,000 stream hours/month | A single live title |
| **Scale** | 10,000 stream hours/month | Several titles, or one with a large concurrent audience |
| **Enterprise** | Unlimited, plus SLA and dedicated support | Portfolio deployments with procurement and uptime requirements |

Every plan meters the three dimensions above once you pass its included allowance. Plan pricing, and what the Starter allowance costs, are both settled during onboarding — [get in touch](https://substream.ai/try) to size a plan.

## Dashboard

The **Usage & Billing** tab in the dashboard shows:

- Total stream hours this month
- Estimated viewer hours
- AI highlights generated
- Cost breakdown by component
- Weekly usage trends
- Current plan and upgrade options

## API Keys

Generate API keys from the **API Keys** tab in the dashboard. Include them as Bearer tokens in all SDK and API requests:

```javascript
const session = await SubstreamSDK.startStream({
  canvasElement: canvas,
  backendUrl: 'https://your-api.com',
  authToken: 'sk_live_your_key_here',  // Your API key
  streamerId: 'player-123',
});
```

## Revenue Opportunities

### For Game Studios

- **Player streaming subscriptions** — Let players go live in your game; charge for the feature
- **Highlight reels** — Auto-generate shareable clips that drive organic user acquisition
- **Watch parties** — Enable viewers to watch gameplay together; monetize with viewer-tier features

### For Platform Operators

- **Usage-based SaaS** — Charge game studios per stream-hour or per concurrent viewer
- **Highlight marketplace** — AI-generated clips as premium content
- **Analytics upsell** — Advanced streaming analytics as a paid tier
