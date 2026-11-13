/**
 * Content for /sports ("Sports & Live Events").
 *
 * Restored from the original substream.ai marketing site (jlin3/substream)
 * and rewritten for the current site. Kept as plain data so copy edits
 * never touch layout code.
 */

/** Primary CTA target for the sports page: 20-minute live demo booking. */
export const DEMO_BOOKING_URL = 'https://calendar.app.google/PCrpTqiBHiUVqs6KA';

// ---------------------------------------------------------------------------
// Proof strip
// ---------------------------------------------------------------------------

/**
 * TODO(Jesse): replace with the league's real name once they approve public
 * use, e.g. 'Major League Cricket'. Leave as 'a cricket league' until then.
 * Do not add numbers or a quote here without the league's sign-off.
 */
export const CRICKET_PROOF_LEAGUE = 'a cricket league';

/**
 * TODO(Jesse): optional league logo for the proof strip. Drop the file in
 * /public/sports/ and set the path here (e.g. '/sports/league-logo.svg').
 */
export const CRICKET_PROOF_LOGO: string | null = null;

// ---------------------------------------------------------------------------
// Hero metrics (values carried over from the original site)
// ---------------------------------------------------------------------------

export const SPORTS_METRICS: { value: string; label: string; icon: string; count?: { target: number; prefix: string; suffix: string } }[] = [
  { value: '<2s', label: 'stream start-up', icon: 'bolt', count: { target: 2, prefix: '<', suffix: 's' } },
  { value: '4K', label: 'multi-camera live', icon: 'camera' },
  { value: '200+', label: 'points of presence', icon: 'globe', count: { target: 200, prefix: '', suffix: '+' } },
  { value: '100%', label: 'your brand, your data', icon: 'data', count: { target: 100, prefix: '', suffix: '%' } },
];

// ---------------------------------------------------------------------------
// Them vs. you
// ---------------------------------------------------------------------------

export const SPORTS_COMPARISON = [
  {
    dim: 'Fan data',
    them: 'The platform keeps the viewer. You get a view count.',
    us: 'Every viewer registers with you: name, email, watch history.',
  },
  {
    dim: 'Revenue',
    them: 'Their ads, their split, their rules on what you can sell.',
    us: 'Tickets, subscriptions, ads, merch and sponsors: you set the terms.',
  },
  {
    dim: 'Brand',
    them: 'Your match sits next to everyone else’s, under their logo.',
    us: 'Your domain, your logo, your colors. No "powered by".',
  },
  {
    dim: 'Reach',
    them: 'Discovery depends on an algorithm you don’t control.',
    us: 'Simulcast to socials in one click. Ownership stays with you.',
  },
];

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

export const SPORTS_FLOW = [
  {
    k: 'Capture',
    d: 'Any camera, anywhere',
    body: 'Phone, DSLR or a full broadcast truck. The plug-and-play transmitter goes live over RTMP/SRT in seconds.',
  },
  {
    k: 'Produce',
    d: 'From any browser',
    body: 'Graphics, replays and dynamic ad markers in the cloud. Or keep the production setup you already have.',
  },
  {
    k: 'Deliver',
    d: 'Your branded hub',
    body: 'A streaming site on your domain with SSO, registration and instant paywall control.',
  },
  {
    k: 'Monetize',
    d: 'Every revenue line',
    body: 'Paywall, Shopify-ready merch, ads and sponsors, with real-time analytics and AI highlights.',
  },
];

// ---------------------------------------------------------------------------
// Platform features
// ---------------------------------------------------------------------------

export const SPORTS_FEATURES = [
  {
    icon: 'window',
    title: 'White-label streaming hub',
    body: 'Launch a streaming service that is unmistakably yours: logo, colors and domain, with fan registration and SSO built in.',
  },
  {
    icon: 'bolt',
    title: 'Low-latency live, up to 4K',
    body: 'Streams start in under two seconds on LL-HLS, with multi-camera support and delivery across 200+ points of presence.',
  },
  {
    icon: 'clip',
    title: 'AI highlights and captions',
    body: 'Key moments are clipped automatically within about a minute, captioned, and ready to post while the match is still on.',
  },
  {
    icon: 'translate',
    title: 'Every fan, every language',
    body: 'Real-time subtitles, live chat translation and AI voice dubbing open your stream to fans who don’t speak the commentary language.',
  },
  {
    icon: 'share',
    title: 'Simulcast to socials',
    body: 'One-click fan-out to YouTube, Instagram, X and Facebook. Use the platforms for reach and bring fans home to your site.',
  },
  {
    icon: 'chart',
    title: 'One pane for the whole event',
    body: 'Quality of experience, revenue and fan CRM in a single dashboard, with a summary report after every event.',
  },
  {
    icon: 'archive',
    title: 'VOD library',
    body: 'Every stream becomes on-demand content on your site: full replays, highlights and archives your fans can come back to.',
  },
  {
    icon: 'badge',
    title: 'Enterprise-grade security',
    body: 'SOC 2, GDPR and PCI DSS. DRM, geo-blocking and a PCI-compliant paywall protect both the content and the checkout.',
  },
];

// ---------------------------------------------------------------------------
// Monetization
// ---------------------------------------------------------------------------

export type RevenueKey = 'ppv' | 'subs' | 'ads' | 'merch' | 'sponsor' | 'betting';

export const REVENUE_STREAMS: { key: RevenueKey; label: string; title: string; body: string; points: string[] }[] = [
  {
    key: 'ppv',
    label: 'Pay-per-view',
    title: 'Pay-per-view & ticketing',
    body: 'Sell a virtual seat to every match or event.',
    points: ['Early-bird pricing and discounts', 'Capacity limits and waitlists', 'Stripe, Apple Pay and Google Pay'],
  },
  {
    key: 'subs',
    label: 'Subscriptions',
    title: 'Season passes & subscriptions',
    body: 'Turn one-off viewers into recurring revenue.',
    points: ['Free preview before the paywall', 'Device and concurrent-stream limits', 'Geo-restrictions per territory'],
  },
  {
    key: 'ads',
    label: 'Advertising',
    title: 'Advertising you control',
    body: 'Server-side ad insertion with your partners and your rates.',
    points: ['Pre-roll and mid-roll breaks', 'You set frequency and CPM', 'Direct-sold or programmatic'],
  },
  {
    key: 'merch',
    label: 'In-stream commerce',
    title: 'In-stream commerce',
    body: 'Drop products into the player while the crowd is hot.',
    points: ['Connect your Shopify store', 'Product carousel and flash deals', 'Quick checkout without leaving the stream'],
  },
  {
    key: 'sponsor',
    label: 'Sponsorship',
    title: 'Brand sponsorship',
    body: 'Give sponsors inventory they can’t buy on social platforms.',
    points: ['Logo bug with position and opacity control', 'Rotating banners across sponsor tiers', 'Sponsored segments and pre-roll'],
  },
  {
    key: 'betting',
    label: 'Betting overlays',
    title: 'Betting & odds overlays',
    body: 'Show live markets on the stream where it is legal to do so.',
    points: ['Live odds ticker and quick-bet cards', 'Geo-restriction checks', 'Responsible gaming messaging'],
  },
];

export const REVENUE_EXTRAS = ['Fan loyalty points', 'Referral rewards', 'Donations', 'Member-only access'];

// ---------------------------------------------------------------------------
// Audience data
// ---------------------------------------------------------------------------

export const DATA_POINTS = [
  'Name and email for every viewer who tunes in',
  'Watch time, purchases and return visits per fan',
  'Revenue by event, by stream and by channel',
  'Export to the CRM and email tools you already use',
];

// ---------------------------------------------------------------------------
// Betting & prediction-market operators
// ---------------------------------------------------------------------------

export const OPERATOR_POINTS = [
  {
    title: 'Watch and bet on one screen',
    body: 'Odds and bet cards sit on top of a first-party stream, so fans never leave to place a bet or check a market.',
  },
  {
    title: 'Markets that move with the play',
    body: 'Low-latency delivery keeps the picture in step with your live markets. The ticker updates in real time.',
  },
  {
    title: 'Compliance built into the player',
    body: 'Geo-restriction checks before any market is shown, responsible gaming messaging on by default, odds in the format your users expect.',
  },
];

/** Illustrative markets for the operator mock. Not real odds. */
export const DEMO_MARKETS = [
  { market: 'Match winner', a: { label: 'Home', odds: '+150' }, b: { label: 'Away', odds: '-180' } },
  { market: 'Total runs over/under 165.5', a: { label: 'Over', odds: '-110' }, b: { label: 'Under', odds: '-110' } },
  { market: 'Powerplay winner', a: { label: 'Home', odds: '+125' }, b: { label: 'Away', odds: '-145' } },
];

export const OPERATOR_SETTINGS = [
  { label: 'Live odds ticker', value: 'On' },
  { label: 'Quick bet', value: 'On' },
  { label: 'Geo-restriction check', value: 'On' },
  { label: 'Odds format', value: 'American' },
  { label: 'Update frequency', value: 'Real-time' },
  { label: 'Responsible gaming message', value: 'Enabled' },
];

// ---------------------------------------------------------------------------
// In the field: public case studies from the cloud-production stack the
// original site integrated with (TVU Networks). These are TVU's published
// stories, linked as such. They are not presented as Substream customers.
// ---------------------------------------------------------------------------

export const FIELD_STORIES = [
  {
    name: 'Mexican Football Federation',
    blurb: 'Taking the women’s league to a global audience with remote live broadcasts.',
    href: 'https://www.tvunetworks.com/story/bringing-womens-football-to-global-audiences-how-the-mexican-womens-league-and-tvu-networks-are-expanding-live-broadcasts-reach/',
    tag: 'Football',
  },
  {
    name: 'Pan American Games',
    blurb: 'MediaLuso’s remote live production and commentary for the 2023 Games.',
    href: 'https://www.tvunetworks.com/story/medialuso-live-remote-coverage-2023-pan-american-games/',
    tag: 'Multi-sport',
  },
  {
    name: 'Copa América',
    blurb: 'Cloud broadcast workflow for one of football’s biggest tournaments.',
    href: 'https://www.youtube.com/watch?v=LAlAUYsSDtE',
    tag: 'Football',
  },
  {
    name: 'SBS Super Concert',
    blurb: 'A 4K live concert stream delivered over 5G.',
    href: 'https://www.tvunetworks.com/story/sbs-5g-4k-live-stream/',
    tag: 'Live music',
  },
];

// ---------------------------------------------------------------------------
// Ways to work with us (plan structure from the original site; commercial
// terms are agreed on a call rather than published here)
// ---------------------------------------------------------------------------

export const SPORTS_PLANS = [
  {
    name: 'Build',
    terms: 'Revenue share',
    blurb: 'Everything you need for your own streaming site, built for you.',
    features: [
      'White-glove development service',
      'Custom landing page',
      'OAuth sign-in setup',
      'Payment system integration',
      'Analytics dashboard',
      'Simulcasting to socials',
      'Overlay graphics and advertising package',
    ],
    featured: false,
  },
  {
    name: 'Pro',
    terms: 'Revenue share + hardware',
    blurb: 'For growing broadcasters and recurring events. Everything in Build, plus:',
    features: [
      'Transmitter hardware bundle',
      'Customer-support SLAs',
      'Enhanced production capabilities',
      'SCTE ad-marker insertion',
    ],
    featured: true,
  },
  {
    name: 'Enterprise',
    terms: 'Custom',
    blurb: 'Tailored for large-scale streaming. Everything in Pro, plus:',
    features: ['Multi-CDN routing', 'SAML SSO', '99.995% uptime SLA', 'Dedicated account team'],
    featured: false,
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const SPORTS_FAQS = [
  {
    q: 'What is white-label streaming, and how does Substream deliver it?',
    a: 'White-label streaming means your live video runs under your own brand. Substream gives you a fully customizable streaming site with your logo, colors and domain, and no "powered by" badge. You control the viewer experience end to end.',
  },
  {
    q: 'Is Substream a fit for sports leagues and teams?',
    a: 'Yes. It was built for it: low-latency delivery, up to 4K, multi-camera support, automatic AI highlights and monetization in the player. It works for professional leagues, clubs, academies and federations that want to stream matches on their own site.',
  },
  {
    q: 'How can we make money from our streams?',
    a: 'Pick the revenue lines that fit your audience: pay-per-view tickets, subscriptions and season passes, in-stream merchandise through Shopify, direct brand sponsorships, and advertising. Stripe, Apple Pay and Google Pay are supported at checkout.',
  },
  {
    q: 'Who owns the audience data?',
    a: 'You do. Fans register on your site, so you get the name and email of everyone who tunes in, along with their watch and purchase history. Nothing is shared with a third-party audience platform.',
  },
  {
    q: 'How does Substream differ from streaming on YouTube or Twitch?',
    a: 'On social platforms the platform owns the viewer relationship, runs its own ads and decides who sees your stream. With Substream it is your brand, your data and your revenue. You can still simulcast to those platforms for reach and bring fans back to your own site.',
  },
  {
    q: 'How do we add our Shopify store to the stream?',
    a: 'Connect your store in the dashboard and your products appear as interactive overlays during the live stream. Fans can buy without leaving the video.',
  },
  {
    q: 'Can sportsbooks or prediction markets use Substream?',
    a: 'Yes. Operators can overlay odds and bet cards on a first-party stream so fans watch and bet in one place. Geo-restriction checks and responsible gaming messaging are part of the player. Leagues can also enable a betting partner on their own streams where it is legal.',
  },
  {
    q: 'Does it work beyond sports?',
    a: 'Yes. The same platform streams concerts, conferences, creator shows and church services, with donations and member-only access where they make sense.',
  },
  {
    q: 'How quickly can we go live?',
    a: 'Connect a camera (phone, DSLR or professional), brand your player, and you can be live the same day. The white-glove Build plan covers the complete setup, including your site and payments.',
  },
];
