/**
 * Pass-through infrastructure cost model for a Twitch-style platform.
 *
 * Every default below is vendor list price, verified 2026-07. Kept separate
 * from the UI so the numbers can be read, diffed and argued with without
 * wading through JSX.
 *
 * The model exists because the answer flips twice: once at the WebRTC-to-HLS
 * crossover (a few dozen concurrent viewers), and again at scale, where IVS
 * stops being the right place to buy bandwidth at all.
 */

export type Ladder = Array<[number, number]>;

/** Inputs a viewer of the page can change. Everything else is derived. */
export type Inputs = {
  streamHours: number;
  viewers: number;
  serverSideComposition: boolean;
  bitrateMbps: number;
  /** Fraction of delivered hours at each rendition. Normalized before use. */
  abrHd: number;
  abrSd: number;
  abrAudio: number;
  /** Per-stream-hour cost of self-managed ingest, ABR transcode and origin. */
  selfManagedStreamHour: number;
  /** Commodity CDN egress, USD per GB, first tier. */
  cdnPerGb: number;
  /**
   * Measured AI annotation cost, USD per stream-hour. The default is the
   * metered cost of the tiered annotator across four real gameplay titles,
   * not an estimate.
   */
  aiPerStreamHour: number;
  /** Fraction of stream-hours that get live annotation at all. */
  aiCoverage: number;
  region: RegionKey;
};

export const DEFAULTS: Inputs = {
  streamHours: 200_000,
  viewers: 40,
  serverSideComposition: false,
  bitrateMbps: 2.5,
  abrHd: 0.65,
  abrSd: 0.3,
  abrAudio: 0.05,
  selfManagedStreamHour: 0.12,
  cdnPerGb: 0.005,
  aiPerStreamHour: 5.1,
  aiCoverage: 1.0,
  region: 'naeu',
};

// --- Vendor rates --------------------------------------------------------

/** IVS Real-Time participant hours, NA/EU. Tier sizes are monthly. */
const TIER_SIZES = [10_000, 40_000, 100_000, 350_000, Infinity];
const IVS_REALTIME_RATES = [0.072, 0.066, 0.06, 0.056, 0.048];

/** IVS Low-Latency output per delivered hour, NA/EU, by rendition. */
const IVS_OUTPUT_RATES = {
  hd: [0.072, 0.066, 0.06, 0.056, 0.048],
  sd: [0.036, 0.033, 0.03, 0.028, 0.024],
  audio: [0.0072, 0.0066, 0.006, 0.0056, 0.0048],
};

/** IVS fixed per-stream-hour charges. */
export const IVS_HOST_PARTICIPANT = 0.072;
export const IVS_ADVANCED_HD_INPUT = 0.85;
export const IVS_COMPOSITION_HD = 0.3;

/** LiveKit Cloud, Ship tier. */
const LIVEKIT_CONNECT_HOUR = 0.03;
const LIVEKIT_EGRESS_GB = 0.12;

/** Cloudflare Stream: $1 per 1,000 delivered minutes, bandwidth included. */
const CLOUDFLARE_STREAM_HOUR = 0.06;

/** bunny.net Volume tier structure, as a multiple of the first-tier rate. */
const CDN_TIERS: Array<[number, number]> = [
  [500_000, 1.0],
  [500_000, 0.8],
  [1_000_000, 0.6],
  // 2 PB+ is quote-based. Held flat rather than extrapolated, so the
  // commodity column at Twitch scale is conservative rather than optimistic.
  [Infinity, 0.6],
];

export type RegionKey = 'naeu' | 'india' | 'apac' | 'anz' | 'sa' | 'korea';

/**
 * Delivery premium relative to NA/EU, applied to first-tier rates.
 * Billing region follows where the viewer connects from, not where the
 * channel is configured.
 */
export const REGIONS: Record<
  RegionKey,
  { label: string; ivs: number; cdn: number; ivsHd: string; cf: string }
> = {
  naeu: { label: 'North America, Europe', ivs: 1.0, cdn: 1.0, ivsHd: '$0.0720', cf: '$0.085' },
  india: { label: 'India', ivs: 1.278, cdn: 1.28, ivsHd: '$0.0920', cf: '$0.109' },
  apac: { label: 'Japan, Hong Kong, SE Asia', ivs: 1.278, cdn: 1.34, ivsHd: '$0.0920', cf: '$0.114' },
  anz: { label: 'Australia, New Zealand', ivs: 1.389, cdn: 1.34, ivsHd: '$0.1000', cf: '$0.114' },
  sa: { label: 'South America', ivs: 1.167, cdn: 1.29, ivsHd: '$0.0840', cf: '$0.110' },
  korea: { label: 'South Korea', ivs: 1.736, cdn: 1.41, ivsHd: '$0.1250', cf: '$0.120' },
};

export const SCENARIOS = [
  { key: 'pilot', label: 'Pilot', streamHours: 10_000, viewers: 25 },
  { key: 'scaled', label: 'Scaled', streamHours: 200_000, viewers: 40 },
  { key: 'twitch', label: 'Twitch-scale', streamHours: 2_500_000, viewers: 40 },
];

// --- Derived helpers -----------------------------------------------------

/** 2.5 Mbps for one hour, in GB. */
export function gbPerViewerHour(bitrateMbps: number): number {
  return (bitrateMbps * 3600) / 8 / 1000;
}

function normalizedAbr(i: Inputs) {
  const sum = i.abrHd + i.abrSd + i.abrAudio || 1;
  return { hd: i.abrHd / sum, sd: i.abrSd / sum, audio: i.abrAudio / sum };
}

/** Blended IVS output rate per tier, given the rendition mix. */
export function outputLadder(i: Inputs): Ladder {
  const mix = normalizedAbr(i);
  const premium = REGIONS[i.region].ivs;
  return TIER_SIZES.map((size, t) => [
    size,
    (IVS_OUTPUT_RATES.hd[t] * mix.hd +
      IVS_OUTPUT_RATES.sd[t] * mix.sd +
      IVS_OUTPUT_RATES.audio[t] * mix.audio) *
      premium,
  ]);
}

function realtimeLadder(i: Inputs): Ladder {
  const premium = REGIONS[i.region].ivs;
  return TIER_SIZES.map((size, t) => [size, IVS_REALTIME_RATES[t] * premium]);
}

function cdnLadder(i: Inputs): Ladder {
  const premium = REGIONS[i.region].cdn;
  return CDN_TIERS.map(([size, mult]) => [size, i.cdnPerGb * mult * premium]);
}

export function tieredCost(units: number, ladder: Ladder): number {
  let remaining = units;
  let cost = 0;
  for (const [size, rate] of ladder) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, size);
    cost += take * rate;
    remaining -= take;
  }
  return cost;
}

export type Architecture = {
  key: string;
  name: string;
  monthly: number;
  perViewerHour: number;
  perStreamHour: number;
  /** True when this path is delivery-only and needs its own ingest stack. */
  selfOperated: boolean;
};

export function ivsFixedPerStreamHour(i: Inputs): number {
  const premium = REGIONS[i.region].ivs;
  return (
    IVS_HOST_PARTICIPANT * premium +
    IVS_ADVANCED_HD_INPUT +
    (i.serverSideComposition ? IVS_COMPOSITION_HD : 0)
  );
}

export function computeArchitectures(i: Inputs): Architecture[] {
  const viewerHours = i.streamHours * i.viewers;
  const gb = viewerHours * gbPerViewerHour(i.bitrateMbps);

  // Pure WebRTC bills the broadcaster as a participant too.
  const realtime = tieredCost(i.streamHours + viewerHours, realtimeLadder(i));

  const hybrid =
    i.streamHours * ivsFixedPerStreamHour(i) + tieredCost(viewerHours, outputLadder(i));

  const commodity = i.streamHours * i.selfManagedStreamHour + tieredCost(gb, cdnLadder(i));

  const livekit =
    (i.streamHours + viewerHours) * LIVEKIT_CONNECT_HOUR + gb * LIVEKIT_EGRESS_GB;

  const cloudflare =
    i.streamHours * i.selfManagedStreamHour + viewerHours * CLOUDFLARE_STREAM_HOUR;

  const rows: Array<[string, string, number, boolean]> = [
    ['realtime', 'IVS Real-Time (WebRTC)', realtime, false],
    ['hybrid', 'IVS hybrid (stage to HLS)', hybrid, false],
    ['commodity', 'Own origin + Bunny Volume', commodity, true],
    ['cloudflare', 'Own origin + Cloudflare Stream', cloudflare, true],
    ['livekit', 'LiveKit Cloud (Ship)', livekit, false],
  ];

  return rows.map(([key, name, monthly, selfOperated]) => ({
    key,
    name,
    monthly,
    selfOperated,
    perViewerHour: viewerHours > 0 ? monthly / viewerHours : 0,
    perStreamHour: i.streamHours > 0 ? monthly / i.streamHours : 0,
  }));
}

/** Monthly AI annotation spend, which is a per-stream-hour cost, not per-viewer. */
export function aiMonthly(i: Inputs): number {
  return i.streamHours * i.aiCoverage * i.aiPerStreamHour;
}

/** Per-stream-hour cost at a viewer count, ignoring volume tiers. */
export function perStreamHourAtViewers(i: Inputs, viewers: number) {
  const gb = viewers * gbPerViewerHour(i.bitrateMbps);
  const premium = REGIONS[i.region].ivs;
  return {
    realtime: (1 + viewers) * IVS_REALTIME_RATES[0] * premium,
    hybrid: ivsFixedPerStreamHour(i) + viewers * outputLadder(i)[0][1],
    commodity: i.selfManagedStreamHour + gb * cdnLadder(i)[0][1],
    livekit: (1 + viewers) * LIVEKIT_CONNECT_HOUR + gb * LIVEKIT_EGRESS_GB,
  };
}

/** Viewer count where pure WebRTC stops being the cheaper IVS option. */
export function crossover(i: Inputs): number {
  const perParticipant = IVS_REALTIME_RATES[0] * REGIONS[i.region].ivs;
  const blended = outputLadder(i)[0][1];
  // perParticipant * (1 + V) = fixed + blended * V
  const denom = perParticipant - blended;
  if (denom <= 0) return Infinity;
  return (ivsFixedPerStreamHour(i) - perParticipant) / denom;
}

// --- Formatting ----------------------------------------------------------

export function money(n: number): string {
  if (!isFinite(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function cents(n: number): string {
  return `$${n.toFixed(4)}`;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${Math.round(n)}`;
}

// --- URL state -----------------------------------------------------------

/**
 * Inputs are mirrored into the query string so a configured model is a
 * shareable link. Only values that differ from the defaults are written, which
 * keeps the common case a clean URL.
 */
const SHORT_KEYS: Record<keyof Inputs, string> = {
  streamHours: 'sh',
  viewers: 'v',
  serverSideComposition: 'ssc',
  bitrateMbps: 'br',
  abrHd: 'hd',
  abrSd: 'sd',
  abrAudio: 'au',
  selfManagedStreamHour: 'smh',
  cdnPerGb: 'gb',
  aiPerStreamHour: 'ai',
  aiCoverage: 'aic',
  region: 'r',
};

export function encodeInputs(i: Inputs): string {
  const params = new URLSearchParams();
  (Object.keys(SHORT_KEYS) as Array<keyof Inputs>).forEach((k) => {
    if (i[k] !== DEFAULTS[k]) {
      params.set(SHORT_KEYS[k], String(i[k]));
    }
  });
  return params.toString();
}

export function decodeInputs(search: string): Inputs {
  const params = new URLSearchParams(search);
  const out: Inputs = { ...DEFAULTS };
  (Object.keys(SHORT_KEYS) as Array<keyof Inputs>).forEach((k) => {
    const raw = params.get(SHORT_KEYS[k]);
    if (raw === null) return;
    if (k === 'region') {
      if (raw in REGIONS) out.region = raw as RegionKey;
      return;
    }
    if (k === 'serverSideComposition') {
      out.serverSideComposition = raw === 'true';
      return;
    }
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) {
      (out[k] as number) = num;
    }
  });
  return out;
}
