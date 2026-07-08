/**
 * Landing page FAQ — written as direct answers to questions game
 * studios actually search (AEO). Also feeds the FAQPage JSON-LD
 * schema in the root layout.
 */

export const FAQS = [
  {
    q: 'How do I add live streaming to my game?',
    a: 'Integrate the Substream SDK — about 5 lines of code for Web/WebGL, Unity, or iOS. Players go live from inside your game with no OBS, no stream keys, and no third-party apps. The SDK captures gameplay and audio, publishes over WebRTC with sub-500ms latency, and returns a viewer URL you can embed on your site, launcher, or app.',
  },
  {
    q: 'Do we own the player data and engagement analytics?',
    a: 'Yes — 100%. Every view, click, replay, share, and watch pattern happens on your properties and lands in your dashboard, exportable to your analytics stack. Nothing is shared with a third-party audience platform, unlike Twitch or YouTube where the platform owns the audience relationship.',
  },
  {
    q: 'How are AI highlights generated?',
    a: 'Every session runs through a machine-learning pipeline: Google Cloud Video Intelligence handles scene analysis, audio energy is scored locally, and Gemini scores each segment from sampled frames. The top moments are assembled with FFmpeg into a branded reel of 15\u201330 second clips — typically within 60 seconds of a match ending. The model is fine-tuned per game, so it learns what a clutch round or boss kill looks like in your title.',
  },
  {
    q: 'How do game studios monetize streams and highlights?',
    a: 'Three built-in vectors, all 100% yours: sovereign advertising (video, banner, and programmatic placements with full control over partners and frequency), superfan subscriptions (premium tiers with extended replays and early access), and contextual commerce (merch, DLC, and in-game item upsells placed at the moment of highest engagement).',
  },
  {
    q: 'Is Substream compliant for players under 13 or under 16?',
    a: 'Yes. Twitch requires 13+, YouTube Gaming moved to 16+ — but with k-ID verified parent accounts, Substream serves under-age-of-consent players compliantly across 240+ jurisdictions. The stack also covers SOC 2, GDPR, and PCI DSS, with DRM, geo-blocking, and SAML SSO for enterprise security review.',
  },
  {
    q: 'How much does it cost to try Substream?',
    a: 'Nothing for 90 days. We spin up a fully branded streaming platform for your game — your logo, your colors, your domain — and run a zero-cost proof of concept. You keep all the data. If it works, we scale together; if not, clean wind-down.',
  },
];
