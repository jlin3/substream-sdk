import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styles from './styles.module.css';
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

// --- primitives ----------------------------------------------------------

function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: ReadonlyArray<{value: T; label: string; hint?: string}>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.pillRow}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`${styles.pill} ${active ? styles.pillActive : ''}`}>
              <span className={styles.pillLabel}>{option.label}</span>
              {option.hint ? <span className={styles.pillHint}>{option.hint}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Slider paired with a number field. Raw keystrokes stay in local state until
 * blur so a half-typed "2." is never overwritten and clamping cannot fight the
 * user mid-edit.
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

  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
        </label>
        <span className={styles.fieldUnit}>{unit}</span>
      </div>
      <p className={styles.fieldHelp} id={`${id}-help`}>
        {help}
      </p>
      <div className={styles.fieldRow}>
        <input
          type="range"
          className={styles.range}
          aria-label={`${label} slider`}
          aria-describedby={`${id}-help`}
          aria-valuetext={`${format ? format(value) : String(value)} ${unit}`}
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
          className={styles.num}
          aria-describedby={`${id}-help`}
          min={limit.min}
          max={limit.max}
          step={limit.step}
          value={draft ?? String(value)}
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

function Stat({value, label, hint}: {value: string; label: string; hint?: string}) {
  return (
    <div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {hint ? <div className={styles.statHint}>{hint}</div> : null}
    </div>
  );
}

// --- sections ------------------------------------------------------------

function Headline({result}: {result: CostResult}) {
  return (
    <div className={styles.card}>
      <div className={styles.headlineLabel}>Estimated monthly infrastructure, at list price</div>
      <div className={styles.headlineValue} id="cm-total">
        {formatUsdCompact(result.totalUsdPerMonth)}
        <span className={styles.headlineUnit}>/ month</span>
      </div>
      <div className={styles.headlineExact}>
        ${Math.round(result.totalUsdPerMonth).toLocaleString('en-US')} on {result.path.name}
      </div>
      <div className={styles.stats}>
        <Stat
          value={formatUnitUsd(result.usdPerStreamHour)}
          label="per stream-hour"
          hint="fully loaded, all lines"
        />
        <Stat
          value={formatUnitUsd(result.usdPerViewerHour)}
          label="per viewer-hour"
          hint={`${result.gbPerViewerHour.toFixed(3)} GB delivered`}
        />
        <Stat
          value={formatUnitUsd(result.usdPerHighlight)}
          label="per highlight reel"
          hint="annotation + clip delivery"
        />
        <Stat
          value={formatCount(result.viewerHoursPerMonth)}
          label="viewer-hours per month"
          hint={`${formatGb(result.liveEgressGb)} egress`}
        />
      </div>
    </div>
  );
}

function Breakdown({result}: {result: CostResult}) {
  const positive = result.lineItems.filter((item) => item.usdPerMonth > 0);
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Where the money goes</h2>
      <p className={styles.cardNote}>
        Every line below is metered separately and reconciles against a vendor invoice.
      </p>
      <div
        className={styles.stack}
        role="img"
        aria-label={`Cost split: ${positive
          .map((item) => `${item.label} ${formatPercent(item.shareOfTotal)}`)
          .join(', ')}`}>
        {positive.map((item) => (
          <span
            key={item.key}
            className={styles.stackSlice}
            style={{
              width: `${item.shareOfTotal * 100}%`,
              background: LINE_COLORS[item.key],
            }}
          />
        ))}
      </div>
      <ul className={styles.lineList}>
        {result.lineItems.map((item) => (
          <li className={styles.lineItem} key={item.key}>
            <div className={styles.lineHead}>
              <span className={styles.lineName}>
                <span
                  aria-hidden
                  className={styles.swatch}
                  style={{background: LINE_COLORS[item.key]}}
                />
                {item.label}
              </span>
              <span className={styles.lineValue}>
                {formatUsd(item.usdPerMonth)}
                <span className={styles.lineShare}>{formatPercent(item.shareOfTotal)}</span>
              </span>
            </div>
            <div className={styles.lineTrack}>
              <span
                className={styles.lineFill}
                style={{
                  width: `${Math.max(item.shareOfTotal * 100, item.usdPerMonth > 0 ? 0.8 : 0)}%`,
                  background: LINE_COLORS[item.key],
                }}
              />
            </div>
            <p className={styles.lineDriver}>{item.driver}</p>
          </li>
        ))}
      </ul>
      <dl className={styles.factGrid}>
        <div>
          <dt className={styles.factLabel}>Reels per month</dt>
          <dd className={styles.factValue}>{formatCount(result.highlightsPerMonth)}</dd>
        </div>
        <div>
          <dt className={styles.factLabel}>Average stored</dt>
          <dd className={styles.factValue}>{formatGb(result.storedGbMonth)}</dd>
        </div>
        <div>
          <dt className={styles.factLabel}>Clip egress</dt>
          <dd className={styles.factValue}>{formatGb(result.highlightEgressGb)}</dd>
        </div>
        <div>
          <dt className={styles.factLabel}>Effective $/GB delivered</dt>
          <dd className={styles.factValue}>{formatUnitUsd(result.usdPerDeliveredGb)}</dd>
        </div>
      </dl>
    </div>
  );
}

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
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Same volume, every delivery path</h2>
      <p className={styles.cardNote}>
        Totals include AI, storage and clip delivery, which are identical across paths. Click a row
        to price it.
      </p>
      {rows.map((row) => {
        const active = row.path.key === inputs.deliveryPath;
        return (
          <button
            key={row.path.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(row.path.key)}
            className={`${styles.pathRow} ${active ? styles.pathRowActive : ''}`}>
            <span className={styles.pathHead}>
              <span className={styles.pathName}>
                {row.path.name}
                {row.path.selfOperated ? ' †' : ''}
              </span>
              <span className={styles.pathNumbers}>
                <span className={styles.pathUnit}>
                  {formatUnitUsd(row.usdPerViewerHour)}/viewer-hr
                </span>
                <span className={styles.pathTotal}>
                  {formatUsdCompact(row.totalUsdPerMonth)}
                </span>
                <span className={row.multipleOfCheapest <= 1.001 ? styles.pathBest : styles.pathUnit}>
                  {row.multipleOfCheapest <= 1.001
                    ? 'best'
                    : `${row.multipleOfCheapest.toFixed(2)}x`}
                </span>
              </span>
            </span>
            <span className={styles.pathTrack}>
              <span
                className={styles.pathFill}
                style={{
                  width: `${Math.max((row.totalUsdPerMonth / max) * 100, 1)}%`,
                  background: PATH_COLORS[row.path.key],
                }}
              />
            </span>
          </button>
        );
      })}
      <p className={styles.footnote}>
        † You operate ingest, transcode and origin yourself. The per-stream-hour input covers that
        compute, not the engineers.
      </p>
    </div>
  );
}

const CURVE_POINTS = [2, 5, 10, 20, 40, 80, 160, 320, 640, 1280];
const CURVE_SERIES: readonly DeliveryPathKey[] = [
  'ivsRealtime',
  'ivsHybrid',
  'ownOriginBunny',
  'ownOriginCloudFront',
  'livekitCloud',
];

function CrossoverChart({inputs}: {inputs: CostInputs}) {
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
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Delivery cost per stream-hour vs audience size</h2>
      <p className={styles.cardNote}>
        Delivery only, first volume tier, no tier discounts. Both axes are logarithmic.
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chart}
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
              stroke="currentColor"
              strokeOpacity={0.12}
            />
            <text
              x={padL - 8}
              y={ly(tick) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.55}>
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
            fill="currentColor"
            fillOpacity={0.55}>
            {point}
          </text>
        ))}
        <text
          x={(W + padL) / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.45}>
          average concurrent viewers per stream
        </text>
        {showCrossover ? (
          <g>
            <line
              x1={lx(crossover)}
              x2={lx(crossover)}
              y1={padT}
              y2={H - padB}
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeDasharray="4 4"
            />
            <text
              x={lx(crossover) + 6}
              y={padT + 11}
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.7}>
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
            points={CURVE_POINTS.map((point, idx) => `${lx(point)},${ly(data[idx][key])}`).join(' ')}
          />
        ))}
      </svg>
      <ul className={styles.chartLegend}>
        {CURVE_SERIES.map((key) => (
          <li key={key}>
            <span aria-hidden className={styles.swatch} style={{background: PATH_COLORS[key]}} />
            {DELIVERY_PATHS.find((path) => path.key === key)?.short ?? key}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Controls({
  inputs,
  set,
}: {
  inputs: CostInputs;
  set: <K extends keyof CostInputs>(key: K, value: CostInputs[K]) => void;
}) {
  return (
    <div className={`${styles.grid} ${styles.gridTwo}`}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Volume</h2>
        <p className={styles.cardNote}>The two inputs that move the answer most.</p>
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

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Audience mix</h2>
        <p className={styles.cardNote}>
          IVS bills output by the rendition the viewer actually received, and audio-only
          participants bill at a tenth of the standard rate. Shares are normalized, so they need not
          sum to 1.
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

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>AI highlights</h2>
        <p className={styles.cardNote}>
          Scales with stream-hours rather than audience, so it dominates the bill for small
          audiences and disappears into the noise for large ones.
        </p>
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

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Recording and rates</h2>
        <p className={styles.cardNote}>
          IVS charges nothing to write recordings to S3, but the bytes then sit there.
        </p>
        <ValueField
          inputKey="recordedShareOfStreamHours"
          label="Share of streams recorded to VOD"
          help="Recorded hours accumulate at S3 Standard rates for as long as you keep them."
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

function Assumptions({inputs, result}: {inputs: CostInputs; result: CostResult}) {
  const floorMultiple = ivsFloorMultipleOverCdn(inputs);
  const crossover = ivsCrossoverViewers(inputs);
  const ai = result.lineItems.find((item) => item.key === 'aiHighlights');
  const delivery = result.lineItems.find((item) => item.key === 'liveDelivery');
  const aiDominates = (ai?.usdPerMonth ?? 0) > (delivery?.usdPerMonth ?? 0);
  const channelFixed =
    REGIONS[inputs.region].ivsHdUsdPerHour[0] +
    IVS_ADVANCED_HD_INPUT_USD_PER_HOUR +
    (inputs.serverSideComposition ? IVS_COMPOSITION_HD_USD_PER_HOUR : 0);

  return (
    <div className={`${styles.grid} ${styles.gridTwo}`}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          {aiDominates
            ? 'At these settings, annotation costs more than delivery'
            : 'At this volume, delivery is the bill'}
        </h2>
        <div className={styles.prose}>
          <p>
            Every delivery architecture converges on one number: dollars per gigabyte. IVS bundles
            delivery into a per-viewer-hour rate that never drops below{' '}
            <b>{formatUnitUsd(REGIONS[inputs.region].ivsHdUsdPerHour[4])}</b> in{' '}
            {REGIONS[inputs.region].label}, roughly <b>{formatMultiple(floorMultiple)}</b> the cost
            of the same bytes on a commodity CDN. That gap is not a negotiation problem, it is the
            wrong product for the job past a certain volume.
          </p>
          <p>
            Start on IVS because time-to-market dominates, and treat the migration to commodity
            delivery as a named milestone with a volume trigger rather than a someday.
          </p>
          {aiDominates ? (
            <p>
              Annotation scales with <b>stream</b>-hours; delivery scales with <b>viewer</b>-hours.
              At {formatCount(inputs.avgConcurrentViewers)} concurrent viewers the model is the
              larger line item, which is why coverage and a minimum-viewer gate belong in the
              contract.
            </p>
          ) : null}
          <p>
            {crossover === null
              ? 'In this configuration pure WebRTC is cheaper at every audience size, because the hybrid path adds a fixed channel charge without a lower delivery rate.'
              : `Pure WebRTC stops being the cheaper IVS option at about ${Math.round(
                  crossover,
                )} concurrent viewers. Below that you pay per connected participant and nothing is fixed; above it the $${channelFixed.toFixed(
                  2,
                )}/hr of fixed channel cost amortizes away.`}
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Where these prices come from</h2>
        <dl className={styles.sourceList}>
          <dt>Amazon IVS</dt>
          <dd>
            Full published rate ladder per billing region, not a premium on NA/EU: the regional gap
            widens with volume. Advanced HD channel input is $
            {IVS_ADVANCED_HD_INPUT_USD_PER_HOUR.toFixed(2)}/hr globally and accrues whenever a
            broadcaster is live, audience or not. Server-side composition adds $
            {IVS_COMPOSITION_HD_USD_PER_HOUR.toFixed(2)}/hr at HD.
          </dd>
          <dt>CDN and storage</dt>
          <dd>
            bunny.net Volume is one global rate with tier steps at 500 TB, 1 PB and 2 PB. CloudFront
            is priced per edge region across seven tiers. Storage is S3 Standard at $0.023/GB-month
            on every path, which understates the Cloudflare Stream column.
          </dd>
          <dt>AI annotation</dt>
          <dd>
            The only figure here that is not a vendor list price. It is our own metered cost across
            four real titles, and it moves with how eventful the footage is because the triage tier
            gates how many windows reach the expensive model.
          </dd>
          <dt>What is not modelled</dt>
          <dd>
            Private pricing. Everything here is list; AWS private pricing at this volume typically
            lands 15-30% below, and that discount is upside no number on this page reflects. Volume
            tiers also reset monthly and are per region, so aggregating studios into one account
            clears tier steps a single studio never would.
          </dd>
        </dl>
      </div>
    </div>
  );
}

// --- main ----------------------------------------------------------------

export default function CostModel(): React.ReactElement {
  const [inputs, setInputs] = useState<CostInputs>(DEFAULT_INPUTS);
  const [copied, setCopied] = useState(false);
  const hydrated = useRef(false);

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
    setInputs((prev) => ({...prev, [key]: value}));
  }, []);

  const result = useMemo(() => computeCost(inputs), [inputs]);
  const activePreset = PRESETS.find((preset) =>
    Object.entries(preset.patch).every(([key, value]) => inputs[key as keyof CostInputs] === value),
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
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Infrastructure cost model</div>
      <h1 className={styles.title}>What a private Twitch actually costs to run.</h1>
      <p className={styles.lede}>
        Live delivery, AI highlights, recording and clip distribution, at vendor list price. Every
        input is editable and the URL carries your configuration, so a configured model is a link
        you can send to a finance team.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy shareable link'}
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonGhost}`}
          onClick={() => setInputs(DEFAULT_INPUTS)}>
          Reset to defaults
        </button>
        <span className={styles.stamp}>
          AWS, bunny.net, Cloudflare and LiveKit list prices, verified 2026-07-27
        </span>
      </div>

      <div className={`${styles.grid} ${styles.gridThree}`}>
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            aria-pressed={preset.key === activePreset?.key}
            onClick={() => setInputs((prev) => ({...prev, ...preset.patch}))}
            className={`${styles.pill} ${
              preset.key === activePreset?.key ? styles.pillActive : ''
            }`}>
            <span className={styles.pillLabel}>
              {preset.label} · {formatCount(preset.patch.streamHoursPerMonth ?? 0)} hrs/mo
            </span>
            <span className={styles.pillHint}>{preset.blurb}</span>
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        <Headline result={result} />
      </div>

      <div className={`${styles.grid} ${styles.gridTwo}`}>
        <div className={styles.card}>
          <Segmented
            legend="Delivery path"
            value={inputs.deliveryPath}
            onChange={(next) => set('deliveryPath', next)}
            options={DELIVERY_PATHS.map((path) => ({
              value: path.key,
              label: path.short,
              hint: path.blurb,
            }))}
          />
        </div>
        <div className={styles.card}>
          <div className={styles.fieldset}>
            <label className={styles.legend} htmlFor="cm-region">
              Billing region
            </label>
            <p className={styles.fieldHelp} id="cm-region-help">
              Follows where the viewer connects from, not where the channel lives.
            </p>
            <select
              id="cm-region"
              className={styles.select}
              aria-describedby="cm-region-help"
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
              {value: 'client', label: 'Client-side', hint: 'No extra charge'},
              {
                value: 'server',
                label: 'Server-side',
                hint: `+$${IVS_COMPOSITION_HD_USD_PER_HOUR.toFixed(2)}/stream-hour at HD`,
              },
            ]}
          />
        </div>
      </div>

      <div className={`${styles.grid} ${styles.gridTwo}`}>
        <Breakdown result={result} />
        <PathComparison inputs={inputs} onSelect={(key) => set('deliveryPath', key)} />
      </div>

      <div className={styles.grid}>
        <CrossoverChart inputs={inputs} />
      </div>

      <h2>Drive it yourself</h2>
      <p className={styles.lede}>
        Nothing here is hidden. Change any input and every figure above updates, including the
        shareable link in your address bar.
      </p>
      <Controls inputs={inputs} set={set} />

      <h2>Assumptions, so they can be argued with</h2>
      <Assumptions inputs={inputs} result={result} />
    </div>
  );
}
