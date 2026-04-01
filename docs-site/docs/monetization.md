---
sidebar_position: 8
title: Monetization
---

# Monetization

Substream provides usage-based billing so you can build a streaming business on top of your game.

## How Pricing Works

| Component | Rate | Description |
|-----------|------|-------------|
| **Stream hours** | $0.12/hr | Time your players spend streaming |
| **Viewer hours** | $0.03/hr | Time viewers spend watching streams |
| **AI highlights** | $0.50/each | Auto-generated highlight reels |

## Plans

| Plan | Price | Included |
|------|-------|----------|
| **Starter** | Free | 100 stream hours/month |
| **Growth** | $99/mo | 1,000 stream hours/month |
| **Scale** | $499/mo | 10,000 stream hours/month |
| **Enterprise** | Custom | Unlimited + SLA + dedicated support |

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
