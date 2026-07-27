'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Geist } from 'next/font/google';
import {
  CostInputs,
  CostLineItemKey,
  CostResult,
  DELIVERY_PATHS,
  DEFAULT_INPUTS,
  DeliveryPathKey,
  INPUT_LIMITS,
  IVS_ADVANCED_HD_INPUT_USD_PER_HOUR,
  IVS_COMPOSITION_HD_USD_PER_HOUR,
  NumericInputKey,
  PRESETS,
  REGIONS,
  RegionKey,
  SLIDER_RESOLUTION,
  clampInput,
  comparePaths,
  computeCost,
  decodeInputs,
  deliveryUsdPerStreamHourAtViewers,
  encodeInputs,
  formatCount,
  formatGb,
  formatMultiple,
  formatPercent,
  formatUnitUsd,
  formatUsd,
  formatUsdCompact,
  ivsCrossoverViewers,
  ivsFloorMultipleOverCdn,
  sliderPositionToValue,
  valueToSliderPosition,
} from './model';

const geist = Geist({ subsets: ['latin'] });

const BRAND = '#2B7FFF';

const BTN_PRIMARY =
  'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_12px_rgba(43,127,255,0.4)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 active:scale-95 transition-all ease-out';
const BTN_OUTLINE =
  'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out';
const CARD = 'rounded-2xl border border-white/10 bg-white/[0.02]';
const EYEBROW = 'text-sm font-medium text-[#2B7FFF] uppercase tracking-widest';

/** Line-item colours come from the app's own theme tokens in globals.css. */
const LINE_COLORS: Record<CostLineItemKey, string> = {
  ingest: '#7EB1FF',
  liveDelivery: '#2B7FFF',
  aiHighlights: '#22D3EE',
  recordingStorage: '#F59E0B',
  highlightDelivery: '#22C55E',
};

const PATH_COLORS: Record<DeliveryPathKey, string> = {
  ivsRealtime: '#2B7FFF',
  ivsHybrid: '#22D3EE',
  ownOriginBunny: '#22C55E',
  ownOriginCloudFront: '#F59E0B',
  cloudflareStream: '#A78BFA',
  livekitCloud: '#EF4444',
};

function SubstreamLogo({ className }: { className?: string }) {
  return (
    <svg
      width="42"
      height="24"
      viewBox="0 0 42 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden>
      <g clipPath="url(#ss_clip_cost)">
        <path
          d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z"
          fill={BRAND}
        />
        <path
          d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z"
          fill={BRAND}
        />
      </g>
      <defs>
        <clipPath id="ss_clip_cost">
          <rect width="42" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

// --- primitives ----------------------------------------------------------

function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns,
}: {
  legend: string;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  value: T;
  onChange: (next: T) => void;
  columns?: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">
        {legend}
      </legend>
      <div className={columns ? `grid gap-2 ${columns}` : 'flex flex-wrap gap-2'}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                active
                  ? 'border-[#2B7FFF]/60 bg-[#2B7FFF]/[0.12] text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/25 hover:bg-white/[0.05]'
              }`}>
              <span className="block text-sm font-medium">{option.label}</span>
              {option.hint ? (
                <span className="mt-0.5 block text-xs leading-snug text-white/40">
                  {option.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Slider paired with a number field. The number field keeps the raw keystrokes
 * in local state until blur, so a half-typed "2." or a cleared field is never
 * overwritten mid-edit and clamping never fights the user.
 */
function ValueField({
  inputKey,
  label,
  help,
  unit,
  value,
  onChange,
  format,
}: {
  inputKey: NumericInputKey;
  label: string;
  help: string;
  unit: string;
  value: number;
  onChange: (next: number) => void;
  format?: (n: number) => string;
}) {
  const limit = INPUT_LIMITS[inputKey];
  const [draft, setDraft] = useState<string | null>(null);
  const id = `cm-${inputKey}`;
  const displayed = draft ?? String(value);
  const valueText = `${format ? format(value) : String(value)} ${unit}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-white/85">
          {label}
        </label>
        <span className="shrink-0 text-xs text-white/35">{unit}</span>
      </div>
      <p id={`${id}-help`} className="mt-1 text-xs leading-relaxed text-white/40">
        {help}
      </p>
      <div className="mt-2.5 flex items-center gap-3">
        <input
          type="range"
          aria-label={`${label} slider`}
          aria-describedby={`${id}-help`}
          aria-valuetext={valueText}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/12 accent-[#2B7FFF]"
          min={limit.logarithmic ? 0 : limit.min}
          max={limit.logarithmic ? SLIDER_RESOLUTION : limit.max}
          step={limit.logarithmic ? 1 : limit.step}
          value={valueToSliderPosition(inputKey, value)}
          onChange={(e) => {
            setDraft(null);
            onChange(sliderPositionToValue(inputKey, Number(e.target.value)));
          }}
        />
        <input
          id={id}
          type="number"
          inputMode="decimal"
          aria-describedby={`${id}-help`}
          className="w-28 shrink-0 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-right text-sm tabular-nums text-white focus:border-[#2B7FFF]/60 focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]/40"
          min={limit.min}
          max={limit.max}
          step={limit.step}
          value={displayed}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const parsed = Number(raw);
            if (raw.trim() !== '' && Number.isFinite(parsed)) {
              onChange(clampInput(inputKey, parsed));
            }
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-[1.75rem]">
        {value}
      </div>
      <div className="mt-0.5 text-[13px] text-white/45">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-white/30">{hint}</div> : null}
    </div>
  );
}

// --- headline ------------------------------------------------------------

function Headline({ result }: { result: CostResult }) {
  const exact = `$${Math.round(result.totalUsdPerMonth).toLocaleString('en-US')}`;
  return (
    <div className={`${CARD} relative overflow-hidden p-6 sm:p-8`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(43,127,255,0.7), transparent)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(43,127,255,0.22), transparent 70%)' }}
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Estimated monthly infrastructure, at list price
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span
            id="cm-total"
            className="text-5xl font-semibold tracking-tighter tabular-nums sm:text-6xl lg:text-7xl"
            style={{
              backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #9EC3FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
            {formatUsdCompact(result.totalUsdPerMonth)}
          </span>
          <span className="pb-1.5 text-base text-white/40">/ month</span>
        </div>
        <p className="mt-1.5 text-sm tabular-nums text-white/40">
          {exact} on {result.path.name}
        </p>

        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/[0.07] pt-6 lg:grid-cols-4">
          <div>
            <dd>
              <Stat
                value={formatUnitUsd(result.usdPerStreamHour)}
                label="per stream-hour"
                hint="fully loaded, all lines"
              />
            </dd>
          </div>
          <div>
            <dd>
              <Stat
                value={formatUnitUsd(result.usdPerViewerHour)}
                label="per viewer-hour"
                hint={`${result.gbPerViewerHour.toFixed(3)} GB delivered`}
              />
            </dd>
          </div>
          <div>
            <dd>
              <Stat
                value={formatUnitUsd(result.usdPerHighlight)}
                label="per highlight reel"
                hint="annotation + clip delivery"
              />
            </dd>
          </div>
          <div>
            <dd>
              <Stat
                value={formatCount(result.viewerHoursPerMonth)}
                label="viewer-hours per month"
                hint={`${formatGb(result.liveEgressGb)} egress`}
              />
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// --- breakdown -----------------------------------------------------------

function Breakdown({ result }: { result: CostResult }) {
  const items = result.lineItems;
  const positive = items.filter((item) => item.usdPerMonth > 0);
  return (
    <div className={`${CARD} p-6`}>
      <h2 className="text-lg font-semibold">Where the money goes</h2>
      <p className="mt-1 text-sm text-white/45">
        Every line below is metered separately and reconciles against a vendor invoice.
      </p>

      <div
        className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="img"
        aria-label={`Cost split: ${positive
          .map((item) => `${item.label} ${formatPercent(item.shareOfTotal)}`)
          .join(', ')}`}>
        {positive.map((item) => (
          <span
            key={item.key}
            className="h-full transition-[width] duration-300 ease-out"
            style={{
              width: `${item.shareOfTotal * 100}%`,
              background: LINE_COLORS[item.key],
            }}
          />
        ))}
      </div>

      <ul className="mt-5 space-y-3.5">
        {items.map((item) => (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: LINE_COLORS[item.key] }}
                />
                <span className="truncate text-sm text-white/85">{item.label}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-white/60">
                <span className="text-white">{formatUsd(item.usdPerMonth)}</span>
                <span className="ml-2 inline-block w-10 text-right text-white/35">
                  {formatPercent(item.shareOfTotal)}
                </span>
              </span>
            </div>
            <div className="mt-1.5 ml-[1.3rem] h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className="block h-full rounded-full transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.max(item.shareOfTotal * 100, item.usdPerMonth > 0 ? 0.8 : 0)}%`,
                  background: LINE_COLORS[item.key],
                }}
              />
            </div>
            <p className="mt-1 ml-[1.3rem] text-xs text-white/35">{item.driver}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.07] pt-5 text-sm">
        <div>
          <dt className="text-xs text-white/35">Reels per month</dt>
          <dd className="tabular-nums text-white/80">{formatCount(result.highlightsPerMonth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">Average stored</dt>
          <dd className="tabular-nums text-white/80">{formatGb(result.storedGbMonth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">Clip egress</dt>
          <dd className="tabular-nums text-white/80">{formatGb(result.highlightEgressGb)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/35">Effective $/GB delivered</dt>
          <dd className="tabular-nums text-white/80">
            {formatUnitUsd(result.usdPerDeliveredGb)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// --- comparison ----------------------------------------------------------

function PathComparison({
  inputs,
  onSelect,
}: {
  inputs: CostInputs;
  onSelect: (key: DeliveryPathKey) => void;
}) {
  const rows = useMemo(() => comparePaths(inputs), [inputs]);
  const max = Math.max(...rows.map((row) => row.totalUsdPerMonth), 1);
  return (
    <div className={`${CARD} p-6`}>
      <h2 className="text-lg font-semibold">Same volume, every delivery path</h2>
      <p className="mt-1 text-sm text-white/45">
        Totals include AI, storage and clip delivery, which are identical across paths. Click a row
        to price it.
      </p>
      <ul className="mt-5 space-y-2">
        {rows.map((row) => {
          const active = row.path.key === inputs.deliveryPath;
          return (
            <li key={row.path.key}>
              <button
                type="button"
                onClick={() => onSelect(row.path.key)}
                aria-pressed={active}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  active
                    ? 'border-[#2B7FFF]/60 bg-[#2B7FFF]/[0.10]'
                    : 'border-white/[0.07] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.04]'
                }`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm font-medium text-white/90">
                    {row.path.name}
                    {row.path.selfOperated ? (
                      <span className="ml-1.5 align-super text-[10px] text-white/35">†</span>
                    ) : null}
                  </span>
                  <span className="flex items-baseline gap-3 text-sm tabular-nums">
                    <span className="text-white/35">
                      {formatUnitUsd(row.usdPerViewerHour)}/viewer-hr
                    </span>
                    <span className="w-16 text-right font-semibold text-white">
                      {formatUsdCompact(row.totalUsdPerMonth)}
                    </span>
                    <span
                      className={`w-12 text-right ${
                        row.multipleOfCheapest <= 1.001 ? 'text-[#22C55E]' : 'text-white/45'
                      }`}>
                      {row.multipleOfCheapest <= 1.001
                        ? 'best'
                        : `${row.multipleOfCheapest.toFixed(2)}x`}
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max((row.totalUsdPerMonth / max) * 100, 1)}%`,
                      background: PATH_COLORS[row.path.key],
                    }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-white/35">
        † You operate ingest, transcode and origin yourself. The per-stream-hour input below covers
        that compute, not the engineers.
      </p>
    </div>
  );
}

// --- crossover chart -----------------------------------------------------

const CURVE_POINTS = [2, 5, 10, 20, 40, 80, 160, 320, 640, 1280];
const CURVE_SERIES: readonly DeliveryPathKey[] = [
  'ivsRealtime',
  'ivsHybrid',
  'ownOriginBunny',
  'ownOriginCloudFront',
  'livekitCloud',
];

function CrossoverChart({ inputs }: { inputs: CostInputs }) {
  const data = CURVE_POINTS.map((viewers) => deliveryUsdPerStreamHourAtViewers(inputs, viewers));
  const values = data
    .flatMap((point) => CURVE_SERIES.map((key) => point[key]))
    .filter((v) => Number.isFinite(v) && v > 0);

  const W = 640;
  const H = 300;
  const padL = 58;
  const padB = 44;
  const padT = 14;
  const padR = 14;

  // Guard the degenerate cases that make a log scale undefined: an empty value
  // set, or every series landing on the same number.
  const rawMin = values.length ? Math.min(...values) : 0.01;
  const rawMax = values.length ? Math.max(...values) : 1;
  const yLo = Math.floor(Math.log10(rawMin));
  const yHi = Math.max(Math.ceil(Math.log10(rawMax)), yLo + 1);

  const lx = (v: number) => {
    const lo = Math.log10(CURVE_POINTS[0]);
    const hi = Math.log10(CURVE_POINTS[CURVE_POINTS.length - 1]);
    return padL + ((Math.log10(v) - lo) / (hi - lo)) * (W - padL - padR);
  };
  const ly = (y: number) => {
    const clamped = Math.min(Math.max(y, 10 ** yLo), 10 ** yHi);
    return padT + (1 - (Math.log10(clamped) - yLo) / (yHi - yLo)) * (H - padT - padB);
  };

  const ticks: number[] = [];
  for (let e = yLo; e <= yHi; e += 1) ticks.push(10 ** e);
  const crossover = ivsCrossoverViewers(inputs);
  const showCrossover =
    crossover !== null &&
    crossover >= CURVE_POINTS[0] &&
    crossover <= CURVE_POINTS[CURVE_POINTS.length - 1];

  return (
    <div className={`${CARD} p-6`}>
      <h2 className="text-lg font-semibold">Delivery cost per stream-hour vs audience size</h2>
      <p className="mt-1 text-sm text-white/45">
        Delivery only, first volume tier, no tier discounts. Both axes are logarithmic.
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 h-auto w-full overflow-visible"
        role="img"
        aria-label={`Delivery cost per stream-hour against concurrent viewers.${
          showCrossover
            ? ` Real-Time and hybrid cross at about ${Math.round(crossover)} viewers.`
            : ''
        }`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              x2={W - padR}
              y1={ly(tick)}
              y2={ly(tick)}
              stroke="#FFFFFF"
              strokeOpacity={0.08}
            />
            <text
              x={padL - 8}
              y={ly(tick) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="#FFFFFF"
              fillOpacity={0.4}>
              {formatUnitUsd(tick).replace(/0+$/, '').replace(/\.$/, '')}
            </text>
          </g>
        ))}
        {CURVE_POINTS.map((point) => (
          <text
            key={point}
            x={lx(point)}
            y={H - padB + 16}
            textAnchor="middle"
            fontSize={10}
            fill="#FFFFFF"
            fillOpacity={0.4}>
            {point}
          </text>
        ))}
        <text
          x={(W + padL) / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={10}
          fill="#FFFFFF"
          fillOpacity={0.3}>
          average concurrent viewers per stream
        </text>

        {showCrossover ? (
          <g>
            <line
              x1={lx(crossover)}
              x2={lx(crossover)}
              y1={padT}
              y2={H - padB}
              stroke={BRAND}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />
            <text
              x={lx(crossover) + 6}
              y={padT + 11}
              fontSize={10}
              fill={BRAND}
              fillOpacity={0.9}>
              crossover ~{Math.round(crossover)}
            </text>
          </g>
        ) : null}

        {CURVE_SERIES.map((key) => (
          <polyline
            key={key}
            fill="none"
            stroke={PATH_COLORS[key]}
            strokeWidth={2}
            strokeLinejoin="round"
            points={CURVE_POINTS.map((point, idx) => `${lx(point)},${ly(data[idx][key])}`).join(
              ' ',
            )}
          />
        ))}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/45">
        {CURVE_SERIES.map((key) => {
          const path = DELIVERY_PATHS.find((p) => p.key === key);
          return (
            <li key={key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-[2px]"
                style={{ background: PATH_COLORS[key] }}
              />
              {path?.short ?? key}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- controls ------------------------------------------------------------

function Controls({
  inputs,
  set,
}: {
  inputs: CostInputs;
  set: <K extends keyof CostInputs>(key: K, value: CostInputs[K]) => void;
}) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className={`${CARD} space-y-5 p-6`}>
        <h2 className="text-lg font-semibold">Volume</h2>
        <ValueField
          inputKey="streamHoursPerMonth"
          label="Stream-hours per month"
          help="Total broadcaster airtime across every streamer on the platform."
          unit="hours / month"
          value={inputs.streamHoursPerMonth}
          onChange={(v) => set('streamHoursPerMonth', v)}
          format={formatCount}
        />
        <ValueField
          inputKey="avgConcurrentViewers"
          label="Average concurrent viewers per stream"
          help="Hours actually delivered, not audience size times stream length. AWS's own estimator assumes a viewer watches about half a stream, so apply that haircut first."
          unit="viewers"
          value={inputs.avgConcurrentViewers}
          onChange={(v) => set('avgConcurrentViewers', v)}
          format={formatCount}
        />
        <ValueField
          inputKey="videoBitrateMbps"
          label="Source bitrate"
          help="Drives every per-gigabyte line. IVS Real-Time caps at 720p, so this is the honest common denominator across paths."
          unit="Mbps"
          value={inputs.videoBitrateMbps}
          onChange={(v) => set('videoBitrateMbps', v)}
        />
      </div>

      <div className={`${CARD} space-y-5 p-6`}>
        <h2 className="text-lg font-semibold">Audience mix</h2>
        <p className="-mt-3 text-sm text-white/45">
          IVS bills output by the rendition the viewer actually received, and audio-only
          participants bill at a tenth of the standard rate. Shares are normalized, so they need
          not sum to 1.
        </p>
        <ValueField
          inputKey="renditionShareHd"
          label="Watching HD (720p)"
          help="The most load-bearing assumption in the model. Shift the mix toward HD and every IVS column gets worse."
          unit="share of viewer-hours"
          value={inputs.renditionShareHd}
          onChange={(v) => set('renditionShareHd', v)}
        />
        <ValueField
          inputKey="renditionShareSd"
          label="Watching SD (480p and below)"
          help="Half the HD rate on the hybrid path. No discount on Real-Time, which bills per participant regardless of rendition."
          unit="share of viewer-hours"
          value={inputs.renditionShareSd}
          onChange={(v) => set('renditionShareSd', v)}
        />
        <ValueField
          inputKey="renditionShareAudioOnly"
          label="Audio only"
          help="One tenth of the standard rate on both IVS paths."
          unit="share of viewer-hours"
          value={inputs.renditionShareAudioOnly}
          onChange={(v) => set('renditionShareAudioOnly', v)}
        />
      </div>

      <div className={`${CARD} space-y-5 p-6`}>
        <h2 className="text-lg font-semibold">AI highlights</h2>
        <ValueField
          inputKey="aiUsdPerStreamHour"
          label="Annotation cost per stream-hour"
          help="Measured, not estimated: the metered cost of our tiered annotator across four real titles. Ranged from $3.59/hr on sparse mobile gameplay to $8.31/hr on dense arena shooter footage."
          unit="USD / stream-hour"
          value={inputs.aiUsdPerStreamHour}
          onChange={(v) => set('aiUsdPerStreamHour', v)}
        />
        <ValueField
          inputKey="aiCoverageFraction"
          label="Annotation coverage"
          help="Share of stream-hours that get annotated at all. Gating annotation behind a minimum viewer count is the single biggest lever on this line."
          unit="1.0 = every stream"
          value={inputs.aiCoverageFraction}
          onChange={(v) => set('aiCoverageFraction', v)}
        />
        <ValueField
          inputKey="highlightsPerStreamHour"
          label="Reels per annotated stream-hour"
          help="Two per hour matches the measured $2.55 per 30-minute reel."
          unit="reels / hour"
          value={inputs.highlightsPerStreamHour}
          onChange={(v) => set('highlightsPerStreamHour', v)}
        />
        <ValueField
          inputKey="highlightClipSeconds"
          label="Reel length"
          help="Sets clip size, which drives both clip storage and clip egress."
          unit="seconds"
          value={inputs.highlightClipSeconds}
          onChange={(v) => set('highlightClipSeconds', v)}
        />
        <ValueField
          inputKey="viewsPerHighlight"
          label="Views per reel"
          help="Over the reel's whole life, including shares off-platform. An assumption, not a measurement."
          unit="views"
          value={inputs.viewsPerHighlight}
          onChange={(v) => set('viewsPerHighlight', v)}
          format={formatCount}
        />
      </div>

      <div className={`${CARD} space-y-5 p-6`}>
        <h2 className="text-lg font-semibold">Recording and rates</h2>
        <ValueField
          inputKey="recordedShareOfStreamHours"
          label="Share of streams recorded to VOD"
          help="IVS charges nothing to write to S3, but the bytes then sit there at S3 Standard rates."
          unit="1.0 = every stream"
          value={inputs.recordedShareOfStreamHours}
          onChange={(v) => set('recordedShareOfStreamHours', v)}
        />
        <ValueField
          inputKey="recordingRetentionDays"
          label="Retention"
          help="In steady state you hold this many days of output at any instant, and S3 bills the average stored volume."
          unit="days"
          value={inputs.recordingRetentionDays}
          onChange={(v) => set('recordingRetentionDays', v)}
        />
        <ValueField
          inputKey="selfManagedUsdPerStreamHour"
          label="Self-managed ingest, transcode and origin"
          help="Only applies to the paths where you run your own stack. Covers compute, not headcount."
          unit="USD / stream-hour"
          value={inputs.selfManagedUsdPerStreamHour}
          onChange={(v) => set('selfManagedUsdPerStreamHour', v)}
        />
        <ValueField
          inputKey="cdnUsdPerGb"
          label="Commodity CDN egress, first tier"
          help="bunny.net Volume starts at $0.005/GB as a single global rate. Also prices highlight clip delivery on every path."
          unit="USD / GB"
          value={inputs.cdnUsdPerGb}
          onChange={(v) => set('cdnUsdPerGb', v)}
        />
      </div>
    </div>
  );
}

// --- assumptions ---------------------------------------------------------

function Assumptions({ inputs, result }: { inputs: CostInputs; result: CostResult }) {
  const floorMultiple = ivsFloorMultipleOverCdn(inputs);
  const crossover = ivsCrossoverViewers(inputs);
  const ai = result.lineItems.find((item) => item.key === 'aiHighlights');
  const delivery = result.lineItems.find((item) => item.key === 'liveDelivery');
  const aiDominates = (ai?.usdPerMonth ?? 0) > (delivery?.usdPerMonth ?? 0);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={`${CARD} p-6`}>
        <h2 className="text-lg font-semibold">
          {aiDominates
            ? 'At these settings, annotation costs more than delivery'
            : 'At this volume, delivery is the bill'}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/55">
          <p>
            Every delivery architecture converges on one number: dollars per gigabyte. IVS bundles
            delivery into a per-viewer-hour rate that never drops below{' '}
            <span className="tabular-nums text-white/80">
              {formatUnitUsd(REGIONS[inputs.region].ivsHdUsdPerHour[4])}
            </span>{' '}
            in {REGIONS[inputs.region].label}, roughly{' '}
            <span className="tabular-nums text-white/80">{formatMultiple(floorMultiple)}</span> the
            cost of the same bytes on a commodity CDN. That gap is not a negotiation problem, it is
            the wrong product for the job past a certain volume.
          </p>
          <p>
            Start on IVS because time-to-market dominates, and treat the migration to commodity
            delivery as a named milestone with a volume trigger rather than a someday.
          </p>
          {aiDominates ? (
            <p>
              Annotation scales with <b className="text-white/80">stream</b>-hours; delivery scales
              with <b className="text-white/80">viewer</b>-hours. At{' '}
              {formatCount(inputs.avgConcurrentViewers)} concurrent viewers the model is the larger
              line item, which is why coverage and a minimum-viewer gate belong in the contract.
            </p>
          ) : null}
          <p>
            {crossover === null
              ? 'In this configuration pure WebRTC is cheaper at every audience size, because the hybrid path adds a fixed channel charge without a lower delivery rate.'
              : `Pure WebRTC stops being the cheaper IVS option at about ${Math.round(
                  crossover,
                )} concurrent viewers. Below that you pay per connected participant and nothing is fixed; above it the $${ivsChannelFixed(
                  inputs,
                ).toFixed(2)}/hr of fixed channel cost amortizes away.`}
          </p>
        </div>
      </div>

      <div className={`${CARD} p-6`}>
        <h2 className="text-lg font-semibold">Where these prices come from</h2>
        <dl className="mt-3 space-y-3 text-sm leading-relaxed text-white/55">
          <div>
            <dt className="font-medium text-white/80">Amazon IVS</dt>
            <dd>
              Full published rate ladder per billing region, not a premium on NA/EU: the regional
              gap widens with volume. Advanced HD channel input is{' '}
              <span className="tabular-nums">
                ${IVS_ADVANCED_HD_INPUT_USD_PER_HOUR.toFixed(2)}/hr
              </span>{' '}
              globally and accrues whenever a broadcaster is live, audience or not. Server-side
              composition adds{' '}
              <span className="tabular-nums">
                ${IVS_COMPOSITION_HD_USD_PER_HOUR.toFixed(2)}/hr
              </span>{' '}
              at HD.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-white/80">CDN and storage</dt>
            <dd>
              bunny.net Volume is one global rate with tier steps at 500 TB, 1 PB and 2 PB.
              CloudFront is priced per edge region across seven tiers. Storage is S3 Standard at
              $0.023/GB-month on every path, which understates the Cloudflare Stream column.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-white/80">AI annotation</dt>
            <dd>
              The only figure here that is not a vendor list price. It is our own metered cost
              across four real titles, and it moves with how eventful the footage is because the
              triage tier gates how many windows reach the expensive model.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-white/80">What is not modelled</dt>
            <dd>
              Private pricing. Everything here is list; AWS private pricing at this volume typically
              lands 15-30% below, and that discount is upside no number on this page reflects.
              Volume tiers also reset monthly and are per region, so aggregating studios into one
              account clears tier steps a single studio never would.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ivsChannelFixed(inputs: CostInputs): number {
  return (
    REGIONS[inputs.region].ivsHdUsdPerHour[0] +
    IVS_ADVANCED_HD_INPUT_USD_PER_HOUR +
    (inputs.serverSideComposition ? IVS_COMPOSITION_HD_USD_PER_HOUR : 0)
  );
}

// --- page ----------------------------------------------------------------

export default function CostModel() {
  const [inputs, setInputs] = useState<CostInputs>(DEFAULT_INPUTS);
  const [copied, setCopied] = useState(false);
  const hydrated = useRef(false);

  // The page is prerendered, so the query string can only be read after mount.
  // The mirror effect below is skipped until this has run, otherwise the first
  // commit would rewrite a shared URL back to the defaults.
  useEffect(() => {
    if (window.location.search) setInputs(decodeInputs(window.location.search));
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const query = encodeInputs(inputs);
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, [inputs]);

  const set = useCallback(<K extends keyof CostInputs>(key: K, value: CostInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const result = useMemo(() => computeCost(inputs), [inputs]);

  const activePreset = PRESETS.find((preset) =>
    Object.entries(preset.patch).every(
      ([key, value]) => inputs[key as keyof CostInputs] === value,
    ),
  );

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  }, []);

  return (
    <div
      className={`${geist.className} flex min-h-screen flex-col bg-[#18181B] text-[#FAFAFA] tracking-tight`}>
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#18181B]/85 px-6 py-4 backdrop-blur-lg">
        <Link href="/" className="flex items-center gap-2.5">
          <SubstreamLogo className="h-5 w-auto" />
          <span className="text-lg font-semibold">Substream</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/docs"
            className="text-sm text-white/60 transition-colors hover:text-white">
            Docs
          </Link>
          <Link href="/try" className={`${BTN_PRIMARY} h-9`}>
            See your platform
          </Link>
        </div>
      </nav>

      <header className="relative overflow-hidden px-6 pb-10 pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] w-full"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 0%, #18181B 55%, rgba(43,127,255,0.26) 100%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <p className={EYEBROW}>Infrastructure cost model</p>
          <h1 className="mt-2 max-w-3xl text-balance text-4xl font-medium leading-[1.08] tracking-tighter sm:text-5xl">
            What a private Twitch actually costs to run.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/55">
            Live delivery, AI highlights, recording and clip distribution, at vendor list price.
            Every input is editable and the URL carries your configuration, so a configured model is
            a link you can send to a finance team.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_PRIMARY} onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy shareable link'}
            </button>
            <button
              type="button"
              className={BTN_OUTLINE}
              onClick={() => setInputs(DEFAULT_INPUTS)}>
              Reset to defaults
            </button>
            <span className="text-xs text-white/35">
              AWS, bunny.net, Cloudflare and LiveKit list prices, verified 2026-07-27
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid gap-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESETS.map((preset) => {
              const active = preset.key === activePreset?.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setInputs((prev) => ({ ...prev, ...preset.patch }))}
                  className={`rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                    active
                      ? 'border-[#2B7FFF]/60 bg-[#2B7FFF]/[0.12]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]'
                  }`}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{preset.label}</span>
                    <span className="text-xs tabular-nums text-white/40">
                      {formatCount(preset.patch.streamHoursPerMonth ?? 0)} hrs/mo
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-white/40">
                    {preset.blurb}
                  </span>
                </button>
              );
            })}
          </div>

          <Headline result={result} />

          <div className={`${CARD} grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]`}>
            <Segmented
              legend="Delivery path"
              value={inputs.deliveryPath}
              onChange={(next) => set('deliveryPath', next)}
              columns="sm:grid-cols-2"
              options={DELIVERY_PATHS.map((path) => ({
                value: path.key,
                label: path.short,
                hint: path.blurb,
              }))}
            />
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="cm-region"
                  className="block text-xs font-semibold uppercase tracking-wider text-white/40">
                  Billing region
                </label>
                <p id="cm-region-help" className="mt-2 text-xs leading-relaxed text-white/40">
                  Follows where the viewer connects from, not where the channel lives.
                </p>
                <select
                  id="cm-region"
                  aria-describedby="cm-region-help"
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#1F1F23] px-3 py-2.5 text-sm text-white focus:border-[#2B7FFF]/60 focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]/40"
                  value={inputs.region}
                  onChange={(e) => set('region', e.target.value as RegionKey)}>
                  {(Object.keys(REGIONS) as RegionKey[]).map((key) => (
                    <option key={key} value={key}>
                      {REGIONS[key].label}
                    </option>
                  ))}
                </select>
              </div>
              <Segmented
                legend="Stage composition"
                value={inputs.serverSideComposition ? 'server' : 'client'}
                onChange={(next) => set('serverSideComposition', next === 'server')}
                options={[
                  { value: 'client', label: 'Client-side', hint: 'No extra charge' },
                  {
                    value: 'server',
                    label: 'Server-side',
                    hint: `+$${IVS_COMPOSITION_HD_USD_PER_HOUR.toFixed(2)}/stream-hour at HD`,
                  },
                ]}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Breakdown result={result} />
            <PathComparison inputs={inputs} onSelect={(key) => set('deliveryPath', key)} />
          </div>

          <CrossoverChart inputs={inputs} />

          <div className="mt-6">
            <h2 className="text-2xl font-medium tracking-tighter">Drive it yourself</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
              Nothing here is hidden. Change any input and every figure above updates, including the
              shareable link in your address bar.
            </p>
            <div className="mt-5">
              <Controls inputs={inputs} set={set} />
            </div>
          </div>

          <Assumptions inputs={inputs} result={result} />

          <div className={`${CARD} flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <h2 className="text-lg font-semibold">Talk to us about the real number</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
                Infrastructure is passed through at cost, itemized and reconciled monthly against
                the underlying AWS and GCP invoices. Start with a 90-day proof of concept at zero
                cost and check the model against your own traffic.
              </p>
            </div>
            <Link href="/try" className={`${BTN_PRIMARY} shrink-0`}>
              See your own streaming platform
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5 text-sm text-white/40">
            <SubstreamLogo className="h-4 w-auto opacity-70" />
            Substream — live streaming infrastructure for games
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/docs" className="text-white/40 transition-colors hover:text-white">
              Docs
            </Link>
            <Link
              href="https://github.com/jlin3/substream-sdk"
              className="text-white/40 transition-colors hover:text-white">
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
