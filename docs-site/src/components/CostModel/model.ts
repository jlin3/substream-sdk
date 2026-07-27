/**
 * Pass-through infrastructure cost model for a white-label, Twitch-style
 * streaming platform with AI highlights.
 *
 * Two rules govern this file.
 *
 * 1. Every rate names the vendor SKU it came from. A number on screen has to be
 *    traceable to a published price sheet while someone is looking at it.
 * 2. Every field name carries its unit. Unit mistakes in a cost model are
 *    silent and expensive, so `usdPerStreamHour` rather than `rate`.
 *
 * `computeCost` is the single entry point and is total: it normalizes its input
 * first, so no combination of user input can produce NaN, Infinity, or a
 * negative cost.
 *
 * DUPLICATED FILE. This model exists twice, once per app:
 *
 *   IVSBackend/src/components/CostModel/model.ts   (Next.js, serves substream.ai)
 *   docs-site/src/components/CostModel/model.ts    (Docusaurus)
 *
 * The two apps have separate build graphs and no shared package, so the model
 * is duplicated rather than imported. Both copies must stay byte-identical: a
 * customer reading the docs site and a customer reading substream.ai have to
 * get the same number. Only the UI layer differs (Tailwind in the Next.js app,
 * CSS modules in Docusaurus). Verify from the repo root with:
 *
 *   diff IVSBackend/src/components/CostModel/model.ts \
 *        docs-site/src/components/CostModel/model.ts
 *
 * Figures quoted in `docs/PRICING_RECOMMENDATION.md` are derived from this
 * file. Changing a rate here means re-deriving them there.
 */

// --- Units and rates -----------------------------------------------------
//
// PRICE SOURCES. Every rate below was checked against the vendor's own public
// pricing page on 2026-07-27:
//
//   Amazon IVS ......... https://aws.amazon.com/ivs/pricing/
//   Amazon S3 .......... https://aws.amazon.com/s3/pricing/
//   Amazon CloudFront .. https://aws.amazon.com/cloudfront/pricing/
//   bunny.net CDN ...... https://docs.bunny.net/cdn/pricing
//   Cloudflare Stream .. https://developers.cloudflare.com/stream/pricing/
//   LiveKit Cloud ...... https://livekit.com/pricing
//
// The AI annotation rate is the one number here that is NOT a vendor list
// price; see `aiUsdPerStreamHour` on `DEFAULT_INPUTS`.

/** S3 and every CDN bill decimal gigabytes, not gibibytes. */
const BITS_PER_BYTE = 8;
const MEGABYTES_PER_GIGABYTE = 1000;
const SECONDS_PER_HOUR = 3600;

/** S3 bills GB-month against average stored bytes; a month is not 30 days. */
const DAYS_PER_MONTH = 30.44;

/**
 * Amazon IVS monthly volume tier bounds, in hours: first 10,000, next 40,000,
 * next 100,000, next 350,000, then everything over 500,000. The same bounds
 * apply to Real-Time participant hours and to Low-Latency video output hours.
 * Tiers reset monthly and are counted per billing region.
 */
const IVS_TIER_BOUNDS_HOURS: readonly number[] = [10_000, 40_000, 100_000, 350_000, Infinity];

/**
 * Amazon IVS Low-Latency Streaming, "Video input" SKU, Advanced HD channel.
 * Accrues for every hour a broadcaster is live, including hours with no
 * audience at all. AWS publishes a single global input rate, so unlike output
 * this one does not vary by billing region.
 */
export const IVS_ADVANCED_HD_INPUT_USD_PER_HOUR = 0.85;

/**
 * Amazon IVS Real-Time, "Server-side composition" SKU, HD rendition
 * ($0.15 SD / $0.30 HD / $0.60 Full HD). Also a single global rate.
 */
export const IVS_COMPOSITION_HD_USD_PER_HOUR = 0.3;

/**
 * Amazon IVS Real-Time bills audio-only participants at one tenth of the
 * standard participant rate, evaluated per minute.
 */
const IVS_AUDIO_ONLY_DISCOUNT = 0.1;

/** Amazon IVS Low-Latency SD output is exactly half the HD rate in every region. */
const IVS_SD_OF_HD = 0.5;

/**
 * LiveKit Cloud, Ship tier: "WebRTC participant minutes" at $0.0005/min
 * ($0.03/hour) and "Downstream data transfer" at $0.12/GB. The tier also
 * carries a $50/month platform fee and includes 150,000 participant minutes
 * and 250 GB; both allowances are immaterial at the volumes on this page.
 */
const LIVEKIT_USD_PER_CONNECTION_HOUR = 0.03;
const LIVEKIT_USD_PER_EGRESS_GB = 0.12;

/**
 * Cloudflare Stream, "Minutes of video delivered" SKU: $1.00 per 1,000 minutes
 * with bandwidth included, so 60 minutes of delivery costs $0.06. Cloudflare
 * prices stored minutes separately at $5.00 per 1,000 minutes stored, which is
 * roughly 13x S3 Standard for the same footage; this model prices storage as
 * S3 on every path, so the Cloudflare Stream column understates storage.
 */
const CLOUDFLARE_STREAM_USD_PER_DELIVERED_HOUR = (1.0 / 1000) * 60;

/**
 * bunny.net Volume tier, in GB and USD per GB. Volume is explicitly a single
 * global rate across its 10 PoPs, so no regional premium applies. Tiers are
 * expressed as multipliers on the first-tier rate so that rate can stay an
 * editable input.
 *
 * bunny.net's docs and its pricing page disagree on the 1 PB - 2 PB tier
 * ($0.003 in docs, $0.002 on the pricing page). The higher figure is used.
 * Past 2 PB bunny.net is quote-based, so the last tier is held flat rather
 * than extrapolated, keeping the commodity column conservative.
 */
const CDN_VOLUME_TIERS: ReadonlyArray<readonly [number, number]> = [
  [500_000, 1.0],
  [500_000, 0.8],
  [1_000_000, 0.6],
  [Infinity, 0.6],
];

/**
 * Amazon S3 Standard, us-east-1, first 50 TB per month. USD per GB-month.
 * Drops to $0.022 above 50 TB and $0.021 above 500 TB; held at the first-tier
 * rate, which is conservative.
 */
const S3_STANDARD_USD_PER_GB_MONTH = 0.023;

/**
 * Amazon CloudFront "Data transfer out to internet" tier bounds, in GB: first
 * 10 TB, next 40 TB, next 100 TB, next 350 TB, next 524 TB, next 4 PB, then
 * everything above 5 PB. The permanent 1 TB/month free allowance is ignored,
 * which is conservative.
 */
const CLOUDFRONT_TIER_BOUNDS_GB: readonly number[] = [
  10_000, 40_000, 100_000, 350_000, 524_000, 4_000_000, Infinity,
];

// --- Regions -------------------------------------------------------------

export type RegionKey = 'naeu' | 'india' | 'apac' | 'anz' | 'sa' | 'korea';

export type Region = {
  label: string;
  /**
   * Amazon IVS HD rate ladder for this billing region, USD per hour, one entry
   * per tier in `IVS_TIER_BOUNDS_HOURS`. AWS publishes identical ladders for
   * Real-Time participant hours and Low-Latency HD video output, so one ladder
   * drives both. SD output is half these numbers and audio-only is a tenth,
   * exactly, in every region.
   *
   * These are full published ladders rather than a scalar premium on NA/EU
   * because the regional gap widens with volume: South Korea is 1.74x NA/EU in
   * the first tier but 2.23x at the floor.
   */
  ivsHdUsdPerHour: readonly number[];
  /** Amazon CloudFront egress ladder, USD per GB, per CLOUDFRONT_TIER_BOUNDS_GB. */
  cloudFrontUsdPerGb: readonly number[];
};

/**
 * Billing region follows where the viewer connects from, not where the channel
 * is configured. A viewer in São Paulo bills against South America even if the
 * stage lives in us-east-1.
 */
export const REGIONS: Record<RegionKey, Region> = {
  naeu: {
    label: 'North America, Europe, Israel, Türkiye',
    ivsHdUsdPerHour: [0.072, 0.066, 0.06, 0.056, 0.048],
    cloudFrontUsdPerGb: [0.085, 0.08, 0.06, 0.04, 0.03, 0.025, 0.02],
  },
  india: {
    label: 'India',
    ivsHdUsdPerHour: [0.092, 0.084, 0.078, 0.07, 0.062],
    cloudFrontUsdPerGb: [0.109, 0.085, 0.082, 0.08, 0.078, 0.075, 0.072],
  },
  apac: {
    label: 'Japan, Hong Kong, SE Asia',
    ivsHdUsdPerHour: [0.092, 0.084, 0.078, 0.07, 0.062],
    // Japan's CloudFront band. Hong Kong and SE Asia sit one band higher at
    // $0.120 for the first tier, so this understates a HK-weighted audience.
    cloudFrontUsdPerGb: [0.114, 0.089, 0.086, 0.084, 0.08, 0.07, 0.06],
  },
  anz: {
    label: 'Australia, New Zealand',
    ivsHdUsdPerHour: [0.1, 0.094, 0.086, 0.078, 0.068],
    cloudFrontUsdPerGb: [0.114, 0.098, 0.094, 0.092, 0.09, 0.085, 0.08],
  },
  sa: {
    label: 'South America',
    ivsHdUsdPerHour: [0.084, 0.078, 0.07, 0.064, 0.056],
    cloudFrontUsdPerGb: [0.11, 0.105, 0.09, 0.08, 0.06, 0.05, 0.04],
  },
  korea: {
    label: 'South Korea',
    ivsHdUsdPerHour: [0.125, 0.118, 0.114, 0.111, 0.107],
    cloudFrontUsdPerGb: [0.12, 0.1, 0.095, 0.09, 0.08, 0.07, 0.06],
  },
};

// --- Delivery paths ------------------------------------------------------

export type DeliveryPathKey =
  | 'ivsRealtime'
  | 'ivsHybrid'
  | 'ownOriginBunny'
  | 'ownOriginCloudFront'
  | 'cloudflareStream'
  | 'livekitCloud';

export type DeliveryPath = {
  key: DeliveryPathKey;
  name: string;
  short: string;
  blurb: string;
  /** True when you operate ingest, transcode and origin yourself. */
  selfOperated: boolean;
};

export const DELIVERY_PATHS: readonly DeliveryPath[] = [
  {
    key: 'ivsRealtime',
    name: 'Amazon IVS Real-Time (WebRTC)',
    short: 'IVS Real-Time',
    blurb:
      'Sub-500 ms glass-to-glass. You pay per connected participant, so cost tracks audience exactly and nothing is fixed.',
    selfOperated: false,
  },
  {
    key: 'ivsHybrid',
    name: 'Amazon IVS hybrid (stage to HLS)',
    short: 'IVS hybrid',
    blurb:
      'Broadcast the Real-Time stage into a Low-Latency channel. Adds a fixed per-stream-hour channel charge but delivers viewers more cheaply.',
    selfOperated: false,
  },
  {
    key: 'ownOriginBunny',
    name: 'Own origin + bunny.net Volume',
    short: 'Bunny CDN',
    blurb:
      'You run ingest, transcode and origin; bandwidth is bought as a commodity. Cheapest at volume, and a team to operate.',
    selfOperated: true,
  },
  {
    key: 'ownOriginCloudFront',
    name: 'Own origin + Amazon CloudFront',
    short: 'CloudFront',
    blurb:
      'Same self-operated stack, delivered on AWS. Simpler to reason about next to the rest of an AWS bill, and priced well above commodity.',
    selfOperated: true,
  },
  {
    key: 'cloudflareStream',
    name: 'Own origin + Cloudflare Stream',
    short: 'Cloudflare Stream',
    blurb:
      'Flat per-delivered-minute pricing with bandwidth included. Predictable, and insensitive to bitrate in either direction.',
    selfOperated: true,
  },
  {
    key: 'livekitCloud',
    name: 'LiveKit Cloud (Ship tier)',
    short: 'LiveKit',
    blurb:
      'Priced for conversational AI with a handful of participants, not broadcast fanout. Listed to close it off, not to recommend it.',
    selfOperated: false,
  },
];

// --- Inputs --------------------------------------------------------------

export type CostInputs = {
  /** Hours of broadcaster airtime per month, summed across all streamers. */
  streamHoursPerMonth: number;
  /** Average concurrent viewers per stream, over hours actually delivered. */
  avgConcurrentViewers: number;
  /** Source video bitrate. Drives every per-GB line in the model. */
  videoBitrateMbps: number;
  /** Share of delivered hours at each rendition. Normalized before use. */
  renditionShareHd: number;
  renditionShareSd: number;
  renditionShareAudioOnly: number;
  deliveryPath: DeliveryPathKey;
  region: RegionKey;
  /** IVS server-side composition, billed per stream-hour when enabled. */
  serverSideComposition: boolean;
  /** Your own ingest, ABR transcode and origin compute, per stream-hour. */
  selfManagedUsdPerStreamHour: number;
  /** Commodity CDN egress, first tier, before regional premium. */
  cdnUsdPerGb: number;
  /** Metered AI annotation and reel generation cost, per stream-hour. */
  aiUsdPerStreamHour: number;
  /** Share of stream-hours that get annotated at all. 1.0 = every stream. */
  aiCoverageFraction: number;
  /** Reels produced per annotated stream-hour. */
  highlightsPerStreamHour: number;
  /** Length of one reel. Drives clip storage and clip egress. */
  highlightClipSeconds: number;
  /** Views per reel over its life. Drives clip egress. */
  viewsPerHighlight: number;
  /** Share of stream-hours recorded to object storage as VOD. */
  recordedShareOfStreamHours: number;
  /** How long recordings are kept. Drives steady-state stored bytes. */
  recordingRetentionDays: number;
};

export type NumericInputKey = {
  [K in keyof CostInputs]: CostInputs[K] extends number ? K : never;
}[keyof CostInputs];

export type InputLimit = {
  min: number;
  max: number;
  step: number;
  /** Log-scaled sliders, for inputs that span more than two decades. */
  logarithmic?: boolean;
};

/**
 * Ranges are shared between the sliders, the number fields and the URL decoder
 * so there is exactly one definition of what a legal value is.
 */
export const INPUT_LIMITS: Record<NumericInputKey, InputLimit> = {
  streamHoursPerMonth: { min: 100, max: 5_000_000, step: 100, logarithmic: true },
  avgConcurrentViewers: { min: 1, max: 5000, step: 1, logarithmic: true },
  videoBitrateMbps: { min: 0.3, max: 12, step: 0.1 },
  renditionShareHd: { min: 0, max: 1, step: 0.01 },
  renditionShareSd: { min: 0, max: 1, step: 0.01 },
  renditionShareAudioOnly: { min: 0, max: 1, step: 0.01 },
  selfManagedUsdPerStreamHour: { min: 0, max: 5, step: 0.01 },
  cdnUsdPerGb: { min: 0.001, max: 0.2, step: 0.001 },
  aiUsdPerStreamHour: { min: 0, max: 30, step: 0.05 },
  aiCoverageFraction: { min: 0, max: 1, step: 0.01 },
  highlightsPerStreamHour: { min: 0, max: 20, step: 0.25 },
  highlightClipSeconds: { min: 5, max: 600, step: 5 },
  viewsPerHighlight: { min: 0, max: 100_000, step: 1, logarithmic: true },
  recordedShareOfStreamHours: { min: 0, max: 1, step: 0.01 },
  recordingRetentionDays: { min: 0, max: 730, step: 1 },
};

export const DEFAULT_INPUTS: CostInputs = {
  streamHoursPerMonth: 200_000,
  avgConcurrentViewers: 40,
  videoBitrateMbps: 2.5,
  renditionShareHd: 0.65,
  renditionShareSd: 0.3,
  renditionShareAudioOnly: 0.05,
  deliveryPath: 'ivsRealtime',
  region: 'naeu',
  serverSideComposition: false,
  selfManagedUsdPerStreamHour: 0.12,
  cdnUsdPerGb: 0.005,
  // NOT a vendor list price. This is the metered cost of our own tiered
  // annotator across four real gameplay titles, read off the pipeline's cost
  // meter (highlight-service/services/genai_client.py) rather than estimated.
  // Measured range was $3.59/hour for sparse mobile gameplay to $8.31/hour for
  // dense arena shooter footage; see docs/PRICING_RECOMMENDATION.md. The
  // underlying Gemini per-million-token rates were re-checked 2026-07-27
  // against https://ai.google.dev/gemini-api/docs/pricing and are current, so
  // the aggregate stands, but it is an assumption about workload mix and is
  // labelled as such in the UI.
  aiUsdPerStreamHour: 5.1,
  aiCoverageFraction: 1.0,
  highlightsPerStreamHour: 2,
  highlightClipSeconds: 60,
  viewsPerHighlight: 25,
  recordedShareOfStreamHours: 1.0,
  recordingRetentionDays: 30,
};

/**
 * Preset names and volumes reuse the three scenarios already anchored in
 * docs/PRICING_RECOMMENDATION.md so the calculator and the pricing document
 * cannot drift apart.
 */
export type Preset = {
  key: string;
  label: string;
  blurb: string;
  patch: Partial<CostInputs>;
};

export const PRESETS: readonly Preset[] = [
  {
    key: 'pilot',
    label: 'Pilot',
    blurb: 'One title, one region. The 90-day proof of concept.',
    patch: { streamHoursPerMonth: 10_000, avgConcurrentViewers: 25 },
  },
  {
    key: 'scaled',
    label: 'Scaled studio',
    blurb: 'Portfolio launch, up to three titles, global.',
    patch: { streamHoursPerMonth: 200_000, avgConcurrentViewers: 40 },
  },
  {
    key: 'twitch',
    label: 'Twitch-scale',
    blurb: 'Full publisher portfolio at platform volume.',
    patch: { streamHoursPerMonth: 2_500_000, avgConcurrentViewers: 40 },
  },
];

// --- Normalization -------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampInput(key: NumericInputKey, value: number): number {
  const limit = INPUT_LIMITS[key];
  return clamp(value, limit.min, limit.max);
}

const NUMERIC_INPUT_KEYS = Object.keys(INPUT_LIMITS) as NumericInputKey[];

/**
 * Coerces anything the UI or a query string can produce into a legal input
 * record. Every downstream calculation may assume finite, in-range values.
 */
export function normalizeInputs(raw: CostInputs): CostInputs {
  const out: CostInputs = { ...raw };
  for (const key of NUMERIC_INPUT_KEYS) {
    out[key] = clampInput(key, raw[key]);
  }
  out.region = raw.region in REGIONS ? raw.region : DEFAULT_INPUTS.region;
  out.deliveryPath = DELIVERY_PATHS.some((p) => p.key === raw.deliveryPath)
    ? raw.deliveryPath
    : DEFAULT_INPUTS.deliveryPath;
  out.serverSideComposition = Boolean(raw.serverSideComposition);
  return out;
}

// --- Derived quantities --------------------------------------------------

/** Bytes on the wire for one hour at a given bitrate, in decimal GB. */
export function gbPerHourAtBitrate(videoBitrateMbps: number): number {
  return (videoBitrateMbps * SECONDS_PER_HOUR) / BITS_PER_BYTE / MEGABYTES_PER_GIGABYTE;
}

export type RenditionMix = { hd: number; sd: number; audioOnly: number };

/**
 * A mix of all zeroes would otherwise blend to a delivery rate of zero and
 * silently report free bandwidth, so it falls back to the default mix.
 */
export function normalizeRenditionMix(i: CostInputs): RenditionMix {
  const sum = i.renditionShareHd + i.renditionShareSd + i.renditionShareAudioOnly;
  if (sum <= 0) {
    const fallback =
      DEFAULT_INPUTS.renditionShareHd +
      DEFAULT_INPUTS.renditionShareSd +
      DEFAULT_INPUTS.renditionShareAudioOnly;
    return {
      hd: DEFAULT_INPUTS.renditionShareHd / fallback,
      sd: DEFAULT_INPUTS.renditionShareSd / fallback,
      audioOnly: DEFAULT_INPUTS.renditionShareAudioOnly / fallback,
    };
  }
  return {
    hd: i.renditionShareHd / sum,
    sd: i.renditionShareSd / sum,
    audioOnly: i.renditionShareAudioOnly / sum,
  };
}

/** A volume ladder: [units in this tier, USD per unit within this tier]. */
export type Ladder = ReadonlyArray<readonly [number, number]>;

export function tieredCost(units: number, ladder: Ladder): number {
  if (!Number.isFinite(units) || units <= 0) return 0;
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

/**
 * Blended Low-Latency output rate per tier. IVS bills output by the rendition
 * the viewer actually received: SD is half the HD rate and audio-only a tenth.
 */
export function ivsOutputLadder(i: CostInputs): Ladder {
  const mix = normalizeRenditionMix(i);
  const hd = REGIONS[i.region].ivsHdUsdPerHour;
  const weight = mix.hd + mix.sd * IVS_SD_OF_HD + mix.audioOnly * IVS_AUDIO_ONLY_DISCOUNT;
  return IVS_TIER_BOUNDS_HOURS.map((size, t) => [size, hd[t] * weight] as const);
}

/**
 * Real-Time has no SD rendition tier: a WebRTC subscriber pays the full
 * participant rate whether it renders 720p or 360p. Only audio-only
 * participants get a discount, at a tenth of the standard rate.
 */
function ivsRealtimeViewerWeight(i: CostInputs): number {
  const mix = normalizeRenditionMix(i);
  return mix.hd + mix.sd + mix.audioOnly * IVS_AUDIO_ONLY_DISCOUNT;
}

function ivsRealtimeLadder(i: CostInputs): Ladder {
  const hd = REGIONS[i.region].ivsHdUsdPerHour;
  return IVS_TIER_BOUNDS_HOURS.map((size, t) => [size, hd[t]] as const);
}

/** bunny.net Volume is a single global rate, so no regional premium applies. */
function commodityCdnLadder(i: CostInputs): Ladder {
  return CDN_VOLUME_TIERS.map(
    ([size, tierMultiplier]) => [size, i.cdnUsdPerGb * tierMultiplier] as const,
  );
}

function cloudFrontLadder(i: CostInputs): Ladder {
  const rates = REGIONS[i.region].cloudFrontUsdPerGb;
  return CLOUDFRONT_TIER_BOUNDS_GB.map((size, t) => [size, rates[t]] as const);
}

/**
 * Fixed IVS charges on the hybrid path, per stream-hour, regardless of
 * audience: the broadcaster's own Real-Time participant slot at the regional
 * first-tier rate, plus the globally-priced Advanced HD channel input, plus
 * server-side composition when enabled.
 */
export function ivsChannelUsdPerStreamHour(i: CostInputs): number {
  return (
    REGIONS[i.region].ivsHdUsdPerHour[0] +
    IVS_ADVANCED_HD_INPUT_USD_PER_HOUR +
    (i.serverSideComposition ? IVS_COMPOSITION_HD_USD_PER_HOUR : 0)
  );
}

// --- The model -----------------------------------------------------------

export type CostLineItemKey =
  | 'ingest'
  | 'liveDelivery'
  | 'aiHighlights'
  | 'recordingStorage'
  | 'highlightDelivery';

export type CostLineItem = {
  key: CostLineItemKey;
  label: string;
  usdPerMonth: number;
  /** 0..1. Sums to 1 across line items whenever the total is positive. */
  shareOfTotal: number;
  /** What drives this line, in one clause, for the itemization UI. */
  driver: string;
};

export type CostResult = {
  /** The normalized inputs actually used, so the UI can show its own clamping. */
  inputs: CostInputs;
  path: DeliveryPath;
  lineItems: readonly CostLineItem[];
  totalUsdPerMonth: number;
  viewerHoursPerMonth: number;
  liveEgressGb: number;
  highlightEgressGb: number;
  storedGbMonth: number;
  highlightsPerMonth: number;
  gbPerViewerHour: number;
  usdPerStreamHour: number;
  usdPerViewerHour: number;
  usdPerHighlight: number;
  usdPerDeliveredGb: number;
};

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

type Split = { ingestUsd: number; deliveryUsd: number };

function ingestAndDelivery(i: CostInputs, viewerHours: number, liveEgressGb: number): Split {
  switch (i.deliveryPath) {
    case 'ivsRealtime': {
      // Broadcaster and viewers draw on the same participant-hour pool, so the
      // volume tiers apply to the pooled total and only then split. Tiering the
      // pool at the full rate and applying each side's weight to the resulting
      // average rate keeps the tier discount intact and is exact as long as the
      // audio-only share is the same in every tier.
      const participantHours = i.streamHoursPerMonth + viewerHours;
      const pooledAtFullRate = tieredCost(participantHours, ivsRealtimeLadder(i));
      const averageRate = safeDivide(pooledAtFullRate, participantHours);
      const composition = i.serverSideComposition
        ? i.streamHoursPerMonth * IVS_COMPOSITION_HD_USD_PER_HOUR
        : 0;
      return {
        // The broadcaster publishes video, so it never gets the audio-only rate.
        ingestUsd: i.streamHoursPerMonth * averageRate + composition,
        deliveryUsd: viewerHours * averageRate * ivsRealtimeViewerWeight(i),
      };
    }
    case 'ivsHybrid':
      return {
        ingestUsd: i.streamHoursPerMonth * ivsChannelUsdPerStreamHour(i),
        deliveryUsd: tieredCost(viewerHours, ivsOutputLadder(i)),
      };
    case 'ownOriginBunny':
      return {
        ingestUsd: i.streamHoursPerMonth * i.selfManagedUsdPerStreamHour,
        deliveryUsd: tieredCost(liveEgressGb, commodityCdnLadder(i)),
      };
    case 'ownOriginCloudFront':
      return {
        ingestUsd: i.streamHoursPerMonth * i.selfManagedUsdPerStreamHour,
        deliveryUsd: tieredCost(liveEgressGb, cloudFrontLadder(i)),
      };
    case 'cloudflareStream':
      return {
        ingestUsd: i.streamHoursPerMonth * i.selfManagedUsdPerStreamHour,
        deliveryUsd: viewerHours * CLOUDFLARE_STREAM_USD_PER_DELIVERED_HOUR,
      };
    case 'livekitCloud':
      return {
        ingestUsd: i.streamHoursPerMonth * LIVEKIT_USD_PER_CONNECTION_HOUR,
        deliveryUsd:
          viewerHours * LIVEKIT_USD_PER_CONNECTION_HOUR + liveEgressGb * LIVEKIT_USD_PER_EGRESS_GB,
      };
  }
}

/**
 * The whole model. Pure, total, and the only function the UI needs to call to
 * get a number it can put on screen.
 */
export function computeCost(rawInputs: CostInputs): CostResult {
  const i = normalizeInputs(rawInputs);
  const path = DELIVERY_PATHS.find((p) => p.key === i.deliveryPath) ?? DELIVERY_PATHS[0];

  const gbPerViewerHour = gbPerHourAtBitrate(i.videoBitrateMbps);
  const viewerHoursPerMonth = i.streamHoursPerMonth * i.avgConcurrentViewers;
  const liveEgressGb = viewerHoursPerMonth * gbPerViewerHour;

  const { ingestUsd, deliveryUsd } = ingestAndDelivery(i, viewerHoursPerMonth, liveEgressGb);

  const annotatedStreamHours = i.streamHoursPerMonth * i.aiCoverageFraction;
  const aiUsd = annotatedStreamHours * i.aiUsdPerStreamHour;
  const highlightsPerMonth = annotatedStreamHours * i.highlightsPerStreamHour;

  const gbPerClip = gbPerHourAtBitrate(i.videoBitrateMbps) * (i.highlightClipSeconds / SECONDS_PER_HOUR);
  const highlightEgressGb = highlightsPerMonth * i.viewsPerHighlight * gbPerClip;
  const highlightDeliveryUsd = tieredCost(highlightEgressGb, commodityCdnLadder(i));

  // Steady state: with R days of retention you are holding R days of output at
  // any instant, and S3 bills the average stored volume over the month.
  const recordedGbPerMonth =
    i.streamHoursPerMonth * i.recordedShareOfStreamHours * gbPerHourAtBitrate(i.videoBitrateMbps);
  const clipGbPerMonth = highlightsPerMonth * gbPerClip;
  const storedGbMonth =
    (recordedGbPerMonth + clipGbPerMonth) * (i.recordingRetentionDays / DAYS_PER_MONTH);
  const storageUsd = storedGbMonth * S3_STANDARD_USD_PER_GB_MONTH;

  const raw: ReadonlyArray<Omit<CostLineItem, 'shareOfTotal'>> = [
    {
      key: 'ingest',
      label: path.selfOperated ? 'Ingest, transcode and origin' : 'Ingest and channel',
      usdPerMonth: ingestUsd,
      driver: 'Scales with stream-hours. Accrues even when nobody is watching.',
    },
    {
      key: 'liveDelivery',
      label: 'Live delivery to viewers',
      usdPerMonth: deliveryUsd,
      driver: 'Scales with viewer-hours and bitrate. The line that dominates at scale.',
    },
    {
      key: 'aiHighlights',
      label: 'AI annotation and reels',
      usdPerMonth: aiUsd,
      driver: 'Scales with annotated stream-hours, not audience.',
    },
    {
      key: 'recordingStorage',
      label: 'VOD and clip storage',
      usdPerMonth: storageUsd,
      driver: 'Scales with recorded hours times retention.',
    },
    {
      key: 'highlightDelivery',
      label: 'Highlight clip delivery',
      usdPerMonth: highlightDeliveryUsd,
      driver: 'Scales with reels times views per reel.',
    },
  ];

  const totalUsdPerMonth = raw.reduce((sum, item) => sum + item.usdPerMonth, 0);
  const lineItems: CostLineItem[] = raw.map((item) => ({
    ...item,
    shareOfTotal: safeDivide(item.usdPerMonth, totalUsdPerMonth),
  }));

  return {
    inputs: i,
    path,
    lineItems,
    totalUsdPerMonth,
    viewerHoursPerMonth,
    liveEgressGb,
    highlightEgressGb,
    storedGbMonth,
    highlightsPerMonth,
    gbPerViewerHour,
    usdPerStreamHour: safeDivide(totalUsdPerMonth, i.streamHoursPerMonth),
    usdPerViewerHour: safeDivide(totalUsdPerMonth, viewerHoursPerMonth),
    usdPerHighlight: safeDivide(aiUsd + highlightDeliveryUsd, highlightsPerMonth),
    usdPerDeliveredGb: safeDivide(deliveryUsd, liveEgressGb),
  };
}

// --- Comparisons ---------------------------------------------------------

export type PathComparison = {
  path: DeliveryPath;
  totalUsdPerMonth: number;
  deliveryUsdPerMonth: number;
  usdPerViewerHour: number;
  usdPerStreamHour: number;
  /** Multiple of the cheapest path's total. 1.0 for the cheapest. */
  multipleOfCheapest: number;
};

/** Every delivery path at the current volume, cheapest first. */
export function comparePaths(rawInputs: CostInputs): PathComparison[] {
  const results = DELIVERY_PATHS.map((p) => computeCost({ ...rawInputs, deliveryPath: p.key }));
  const cheapest = Math.min(...results.map((r) => r.totalUsdPerMonth));
  return results
    .map((r) => ({
      path: r.path,
      totalUsdPerMonth: r.totalUsdPerMonth,
      deliveryUsdPerMonth:
        r.lineItems.find((l) => l.key === 'liveDelivery')?.usdPerMonth ?? 0,
      usdPerViewerHour: r.usdPerViewerHour,
      usdPerStreamHour: r.usdPerStreamHour,
      multipleOfCheapest: safeDivide(r.totalUsdPerMonth, cheapest),
    }))
    .sort((a, b) => a.totalUsdPerMonth - b.totalUsdPerMonth);
}

/**
 * Delivery-only cost per stream-hour at a hypothetical audience size, ignoring
 * volume tiers. Used for the crossover curve, where the question is the shape
 * of each path against audience size rather than the absolute bill.
 */
export function deliveryUsdPerStreamHourAtViewers(
  rawInputs: CostInputs,
  viewers: number,
): Record<DeliveryPathKey, number> {
  const i = normalizeInputs(rawInputs);
  const v = Math.max(0, viewers);
  const gb = v * gbPerHourAtBitrate(i.videoBitrateMbps);
  const realtimeRate = REGIONS[i.region].ivsHdUsdPerHour[0];
  const composition = i.serverSideComposition ? IVS_COMPOSITION_HD_USD_PER_HOUR : 0;
  return {
    ivsRealtime:
      realtimeRate * (1 + v * ivsRealtimeViewerWeight(i)) + composition,
    ivsHybrid: ivsChannelUsdPerStreamHour(i) + v * ivsOutputLadder(i)[0][1],
    ownOriginBunny: i.selfManagedUsdPerStreamHour + gb * commodityCdnLadder(i)[0][1],
    ownOriginCloudFront: i.selfManagedUsdPerStreamHour + gb * cloudFrontLadder(i)[0][1],
    cloudflareStream:
      i.selfManagedUsdPerStreamHour + v * CLOUDFLARE_STREAM_USD_PER_DELIVERED_HOUR,
    livekitCloud: (1 + v) * LIVEKIT_USD_PER_CONNECTION_HOUR + gb * LIVEKIT_USD_PER_EGRESS_GB,
  };
}

/**
 * Concurrent-viewer count at which pure WebRTC stops being the cheaper IVS
 * option. Returns null when the two paths never cross in a useful range, which
 * happens whenever the blended output rate is not strictly below the
 * per-participant rate.
 */
export function ivsCrossoverViewers(rawInputs: CostInputs): number | null {
  const i = normalizeInputs(rawInputs);
  const hostRate = REGIONS[i.region].ivsHdUsdPerHour[0];
  const realtimePerViewer = hostRate * ivsRealtimeViewerWeight(i);
  const hybridPerViewer = ivsOutputLadder(i)[0][1];
  const denominator = realtimePerViewer - hybridPerViewer;
  if (denominator <= 0) return null;
  // hostRate + realtimePerViewer * V = channelFixed + hybridPerViewer * V
  const composition = i.serverSideComposition ? IVS_COMPOSITION_HD_USD_PER_HOUR : 0;
  const viewers = (ivsChannelUsdPerStreamHour(i) - hostRate - composition) / denominator;
  if (!Number.isFinite(viewers) || viewers <= 0) return null;
  return viewers;
}

/**
 * How many times more expensive an IVS-delivered gigabyte is than the same
 * bytes on the commodity CDN, at the volume floor of each. This is the single
 * number that decides whether IVS is the right place to buy bandwidth.
 */
export function ivsFloorMultipleOverCdn(rawInputs: CostInputs): number | null {
  const i = normalizeInputs(rawInputs);
  const hdLadder = REGIONS[i.region].ivsHdUsdPerHour;
  const ivsFloorPerViewerHour = hdLadder[hdLadder.length - 1];
  const cdnFloorLadder = commodityCdnLadder(i);
  const cdnFloorPerGb = cdnFloorLadder[cdnFloorLadder.length - 1][1];
  const cdnPerViewerHour = gbPerHourAtBitrate(i.videoBitrateMbps) * cdnFloorPerGb;
  if (cdnPerViewerHour <= 0) return null;
  return ivsFloorPerViewerHour / cdnPerViewerHour;
}

// --- Formatting ----------------------------------------------------------

/**
 * Money, at whatever precision the number actually needs. A cost model that
 * renders $0.04 as "$0" is worse than one that renders nothing, because the
 * reader has no way to know it happened.
 */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs === 0) return '$0.00';
  if (abs >= 1000) {
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  }
  let decimals = 2;
  while (decimals < 6 && Number(abs.toFixed(decimals)) === 0) decimals += 1;
  return `${sign}$${abs.toFixed(decimals)}`;
}

/** Headline figures, where three significant digits beat exactness. */
export function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 100_000) return `${sign}$${Math.round(abs / 1000)}k`;
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return formatUsd(n);
}

/** Unit rates, which are routinely sub-cent and must never round to zero. */
export function formatUnitUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs === 0) return '$0.0000';
  if (abs >= 1000) return formatUsd(n);
  let decimals = 4;
  while (decimals < 8 && Number(abs.toFixed(decimals)) === 0) decimals += 1;
  return `${n < 0 ? '-' : ''}$${abs.toFixed(decimals)}`;
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000).toLocaleString('en-US')}k`;
  if (abs >= 1) return Math.round(n).toLocaleString('en-US');
  return n.toFixed(2);
}

/** Bytes, stepped up to the unit a human would have used. */
export function formatGb(gb: number): string {
  if (!Number.isFinite(gb)) return '—';
  if (gb >= 1_000_000) return `${(gb / 1_000_000).toFixed(2)} PB`;
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  if (gb === 0) return '0 GB';
  return `${(gb * 1000).toFixed(1)} MB`;
}

export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

export function formatMultiple(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n >= 100 ? `${Math.round(n)}x` : `${n.toFixed(1)}x`;
}

// --- Log-scaled slider mapping -------------------------------------------
//
// Stream-hours span from 100 to 5,000,000. On a linear slider the entire pilot
// and studio range lives in the first two pixels, so those inputs map their
// track position through log space instead.

export const SLIDER_RESOLUTION = 1000;

export function valueToSliderPosition(key: NumericInputKey, value: number): number {
  const { min, max, logarithmic } = INPUT_LIMITS[key];
  const v = clamp(value, min, max);
  if (!logarithmic) return v;
  const lo = Math.log10(Math.max(min, 1e-6));
  const hi = Math.log10(max);
  return ((Math.log10(Math.max(v, 1e-6)) - lo) / (hi - lo)) * SLIDER_RESOLUTION;
}

export function sliderPositionToValue(key: NumericInputKey, position: number): number {
  const { min, max, step, logarithmic } = INPUT_LIMITS[key];
  if (!logarithmic) return clamp(position, min, max);
  const lo = Math.log10(Math.max(min, 1e-6));
  const hi = Math.log10(max);
  const fraction = clamp(position, 0, SLIDER_RESOLUTION) / SLIDER_RESOLUTION;
  const raw = 10 ** (lo + fraction * (hi - lo));
  const snapped = step >= 1 ? Math.round(raw / step) * step : raw;
  return clamp(snapped, min, max);
}

// --- URL state -----------------------------------------------------------

/**
 * Inputs are mirrored into the query string so a configured model is a
 * shareable link. Only values that differ from the defaults are written, which
 * keeps the common case a clean URL.
 */
const SHORT_KEYS: Record<keyof CostInputs, string> = {
  streamHoursPerMonth: 'sh',
  avgConcurrentViewers: 'v',
  videoBitrateMbps: 'br',
  renditionShareHd: 'hd',
  renditionShareSd: 'sd',
  renditionShareAudioOnly: 'au',
  deliveryPath: 'p',
  region: 'r',
  serverSideComposition: 'ssc',
  selfManagedUsdPerStreamHour: 'smh',
  cdnUsdPerGb: 'gb',
  aiUsdPerStreamHour: 'ai',
  aiCoverageFraction: 'aic',
  highlightsPerStreamHour: 'hps',
  highlightClipSeconds: 'hcs',
  viewsPerHighlight: 'vph',
  recordedShareOfStreamHours: 'rec',
  recordingRetentionDays: 'ret',
};

const INPUT_KEYS = Object.keys(SHORT_KEYS) as Array<keyof CostInputs>;

export function encodeInputs(inputs: CostInputs): string {
  const i = normalizeInputs(inputs);
  const params = new URLSearchParams();
  for (const key of INPUT_KEYS) {
    if (i[key] !== DEFAULT_INPUTS[key]) {
      params.set(SHORT_KEYS[key], String(i[key]));
    }
  }
  return params.toString();
}

export function decodeInputs(search: string): CostInputs {
  const params = new URLSearchParams(search);
  const out: CostInputs = { ...DEFAULT_INPUTS };
  for (const key of INPUT_KEYS) {
    const raw = params.get(SHORT_KEYS[key]);
    if (raw === null) continue;
    if (key === 'region') {
      if (raw in REGIONS) out.region = raw as RegionKey;
    } else if (key === 'deliveryPath') {
      if (DELIVERY_PATHS.some((p) => p.key === raw)) out.deliveryPath = raw as DeliveryPathKey;
    } else if (key === 'serverSideComposition') {
      out.serverSideComposition = raw === 'true';
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        out[key] = clampInput(key, parsed);
      }
    }
  }
  return normalizeInputs(out);
}
