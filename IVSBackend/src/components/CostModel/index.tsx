'use client';

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styles from './styles.module.css';
import {
  Architecture,
  DEFAULTS,
  IVS_ADVANCED_HD_INPUT,
  IVS_COMPOSITION_HD,
  Inputs,
  REGIONS,
  RegionKey,
  SCENARIOS,
  aiMonthly,
  cents,
  compact,
  computeArchitectures,
  crossover,
  decodeInputs,
  encodeInputs,
  gbPerViewerHour,
  ivsFixedPerStreamHour,
  money,
  outputLadder,
  perStreamHourAtViewers,
} from './model';

const SERIES_COLORS: Record<string, string> = {
  realtime: '#3b82f6',
  hybrid: '#16a34a',
  commodity: '#d97706',
  livekit: '#dc2626',
};

// --- small primitives ----------------------------------------------------

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.pill} ${active ? styles.pillActive : ''}`}
      onClick={onClick}>
      {children}
    </button>
  );
}

function NumberField({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <>
      <input
        className={styles.num}
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= min) onChange(n);
        }}
      />
      {suffix ? (
        <span style={{fontSize: '0.78rem', opacity: 0.7}}>{suffix}</span>
      ) : null}
    </>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// --- charts (hand-rolled SVG, no chart dependency) -----------------------

function CrossoverChart({inputs}: {inputs: Inputs}) {
  const points = [5, 10, 20, 40, 60, 80, 120, 200, 400];
  const series = ['realtime', 'hybrid', 'commodity', 'livekit'] as const;
  const names: Record<string, string> = {
    realtime: 'IVS Real-Time (WebRTC)',
    hybrid: 'IVS hybrid (stage to HLS)',
    commodity: 'Own origin + CDN',
    livekit: 'LiveKit Cloud (Ship)',
  };

  const data = points.map((v) => perStreamHourAtViewers(inputs, v));
  const values = data.flatMap((d) => series.map((s) => d[s])).filter((v) => v > 0);
  const maxY = Math.max(...values);
  const minY = Math.min(...values);

  const W = 560;
  const H = 260;
  const padL = 52;
  const padB = 34;
  const padT = 10;
  const padR = 10;

  // Both axes are log. The x range spans two decades and the y values span
  // roughly three, so a linear scale would flatten the sub-100-viewer region
  // that the whole chart exists to show.
  const lx = (v: number) =>
    padL +
    ((Math.log10(v) - Math.log10(points[0])) /
      (Math.log10(points[points.length - 1]) - Math.log10(points[0]))) *
      (W - padL - padR);

  const yLo = Math.floor(Math.log10(minY));
  const yHi = Math.ceil(Math.log10(maxY));
  const ly = (y: number) =>
    padT + (1 - (Math.log10(Math.max(y, 10 ** yLo)) - yLo) / (yHi - yLo)) * (H - padT - padB);

  const xover = crossover(inputs);
  const ticks: number[] = [];
  for (let e = yLo; e <= yHi; e += 1) ticks.push(10 ** e);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
      aria-label="Cost per stream-hour versus concurrent viewers">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={ly(t)} y2={ly(t)}
            stroke="currentColor" strokeOpacity={0.12} />
          <text x={padL - 7} y={ly(t) + 3.5} textAnchor="end"
            fontSize={9.5} fill="currentColor" fillOpacity={0.55}>
            ${t < 1 ? t.toFixed(2) : t.toFixed(0)}
          </text>
        </g>
      ))}
      {points.map((p) => (
        <text key={p} x={lx(p)} y={H - padB + 14} textAnchor="middle"
          fontSize={9.5} fill="currentColor" fillOpacity={0.55}>
          {p}
        </text>
      ))}
      <text x={(W + padL) / 2} y={H - 3} textAnchor="middle" fontSize={9.5}
        fill="currentColor" fillOpacity={0.45}>
        average concurrent viewers per stream (log scale, USD/stream-hour log scale)
      </text>

      {isFinite(xover) && xover >= points[0] && xover <= points[points.length - 1] ? (
        <g>
          <line x1={lx(xover)} x2={lx(xover)} y1={padT} y2={H - padB}
            stroke="currentColor" strokeOpacity={0.4} strokeDasharray="3 3" />
          <text x={lx(xover) + 4} y={padT + 10} fontSize={9.5}
            fill="currentColor" fillOpacity={0.6}>
            crossover ~{Math.round(xover)}
          </text>
        </g>
      ) : null}

      {series.map((s) => (
        <polyline
          key={s}
          fill="none"
          stroke={SERIES_COLORS[s]}
          strokeWidth={2}
          points={points.map((p, i) => `${lx(p)},${ly(data[i][s])}`).join(' ')}
        />
      ))}
    </svg>
  );
}

function BarList({archs}: {archs: Architecture[]}) {
  const max = Math.max(...archs.map((a) => a.perViewerHour), 0.0001);
  const best = Math.min(...archs.map((a) => a.perViewerHour));
  return (
    <div>
      {archs.map((a) => (
        <div className={styles.barRow} key={a.key}>
          <span className={styles.barName} title={a.name}>{a.name}</span>
          <span className={styles.barTrack}>
            <span
              className={`${styles.barFill} ${
                a.perViewerHour === best ? styles.barFillBest : ''
              }`}
              style={{width: `${Math.max(1, (a.perViewerHour / max) * 100)}%`}}
            />
          </span>
          <span className={styles.barValue}>{cents(a.perViewerHour)}</span>
        </div>
      ))}
    </div>
  );
}

// --- sections ------------------------------------------------------------

function Controls({
  inputs,
  set,
}: {
  inputs: Inputs;
  set: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Scale scenario</span>
        {SCENARIOS.map((s) => (
          <Pill
            key={s.key}
            active={inputs.streamHours === s.streamHours && inputs.viewers === s.viewers}
            onClick={() => {
              set('streamHours', s.streamHours);
              set('viewers', s.viewers);
            }}>
            {`${s.label} · ${compact(s.streamHours)} stream-hrs/mo`}
          </Pill>
        ))}
      </div>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Stream-hours per month</span>
        <NumberField
          value={inputs.streamHours}
          step={1000}
          onChange={(n) => set('streamHours', n)}
        />
        <span className={styles.controlLabel} style={{minWidth: 'auto', marginLeft: '1rem'}}>
          Avg concurrent viewers
        </span>
        <NumberField value={inputs.viewers} onChange={(n) => set('viewers', n)} />
        {[5, 25, 40, 80, 150, 500].map((v) => (
          <Pill key={v} active={v === inputs.viewers} onClick={() => set('viewers', v)}>
            {compact(v)}
          </Pill>
        ))}
      </div>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Stage composition</span>
        <Pill
          active={!inputs.serverSideComposition}
          onClick={() => set('serverSideComposition', false)}>
          Client-side (free)
        </Pill>
        <Pill
          active={inputs.serverSideComposition}
          onClick={() => set('serverSideComposition', true)}>
          Server-side (+${IVS_COMPOSITION_HD.toFixed(2)}/hr)
        </Pill>
        <span className={styles.controlLabel} style={{minWidth: 'auto', marginLeft: '1rem'}}>
          Billing region
        </span>
        <select
          className={styles.select}
          value={inputs.region}
          onChange={(e) => set('region', e.target.value as RegionKey)}>
          {(Object.keys(REGIONS) as RegionKey[]).map((k) => (
            <option key={k} value={k}>
              {REGIONS[k].label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Bitrate / rendition mix</span>
        <NumberField
          value={inputs.bitrateMbps}
          step={0.1}
          onChange={(n) => set('bitrateMbps', n)}
          suffix="Mbps"
        />
        <NumberField value={inputs.abrHd} step={0.05} onChange={(n) => set('abrHd', n)} suffix="HD" />
        <NumberField value={inputs.abrSd} step={0.05} onChange={(n) => set('abrSd', n)} suffix="SD" />
        <NumberField
          value={inputs.abrAudio}
          step={0.05}
          onChange={(n) => set('abrAudio', n)}
          suffix="audio"
        />
      </div>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Self-managed / CDN rates</span>
        <NumberField
          value={inputs.selfManagedStreamHour}
          step={0.01}
          onChange={(n) => set('selfManagedStreamHour', n)}
          suffix="$/stream-hr"
        />
        <NumberField
          value={inputs.cdnPerGb}
          step={0.001}
          onChange={(n) => set('cdnPerGb', n)}
          suffix="$/GB egress"
        />
      </div>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>AI annotation</span>
        <NumberField
          value={inputs.aiPerStreamHour}
          step={0.1}
          onChange={(n) => set('aiPerStreamHour', n)}
          suffix="$/stream-hr"
        />
        <NumberField
          value={inputs.aiCoverage}
          step={0.05}
          onChange={(n) => set('aiCoverage', n)}
          suffix="coverage (1.0 = every stream)"
        />
      </div>
    </div>
  );
}

function ScenarioTable({inputs}: {inputs: Inputs}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Viewer-hrs/mo</th>
            <th>Egress/mo</th>
            <th>IVS Real-Time</th>
            <th>IVS hybrid</th>
            <th>Commodity CDN</th>
            <th>IVS premium</th>
          </tr>
        </thead>
        <tbody>
          {SCENARIOS.map((s) => {
            const archs = computeArchitectures({
              ...inputs,
              streamHours: s.streamHours,
              viewers: s.viewers,
            });
            const by = Object.fromEntries(archs.map((a) => [a.key, a]));
            const pb =
              (s.streamHours * s.viewers * gbPerViewerHour(inputs.bitrateMbps)) / 1_000_000;
            return (
              <tr key={s.key}>
                <td>{`${s.label} · ${compact(s.streamHours)} stream-hrs, ${s.viewers} viewers`}</td>
                <td>{compact(s.streamHours * s.viewers)}</td>
                <td>{pb.toFixed(1)} PB</td>
                <td>{money(by.realtime.monthly)}</td>
                <td>{money(by.hybrid.monthly)}</td>
                <td>{money(by.commodity.monthly)}</td>
                <td>{(by.hybrid.monthly / by.commodity.monthly).toFixed(1)}x</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- main ----------------------------------------------------------------

export default function CostModel() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  // Hydrate from the query string after mount. Docusaurus prerenders this
  // page, so reading location during render would produce a server/client
  // mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.search) setInputs(decodeInputs(window.location.search));
  }, []);

  const set = useCallback(<K extends keyof Inputs>(k: K, v: Inputs[K]) => {
    setInputs((prev) => ({...prev, [k]: v}));
  }, []);

  // Mirror state into the URL without adding history entries, so the address
  // bar is always a shareable snapshot of what is on screen.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = encodeInputs(inputs);
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [inputs]);

  const archs = useMemo(() => computeArchitectures(inputs), [inputs]);
  const sorted = useMemo(() => [...archs].sort((a, b) => a.monthly - b.monthly), [archs]);
  const best = sorted[0];
  const ivsBest = useMemo(
    () =>
      archs
        .filter((a) => a.key === 'realtime' || a.key === 'hybrid')
        .sort((a, b) => a.monthly - b.monthly)[0],
    [archs],
  );
  const ratio = ivsBest.monthly / best.monthly;
  const viewerHours = inputs.streamHours * inputs.viewers;
  const ai = aiMonthly(inputs);
  const xover = crossover(inputs);
  const gbvh = gbPerViewerHour(inputs.bitrateMbps);
  const ivsFloorRatio = 0.048 / (gbvh * inputs.cdnPerGb);

  const copyLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  }, []);

  return (
    <div className={styles.wrap}>
      <h1>Pass-through infrastructure cost</h1>
      <p className={styles.lede}>
        What it actually costs to host live streaming and AI highlights for a Twitch-style
        platform, at vendor list price. Every input below is editable and the URL updates as
        you change it, so a configured model is a link you can send to someone.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy shareable link'}
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonGhost}`}
          onClick={() => setInputs(DEFAULTS)}>
          Reset to defaults
        </button>
        <span style={{fontSize: '0.78rem', opacity: 0.6}}>
          AWS, LiveKit and bunny.net list prices, verified 2026-07
        </span>
      </div>

      <Controls inputs={inputs} set={set} />

      <div className={styles.stats}>
        <Stat value={money(best.monthly)} label={`Cheapest delivery: ${best.name}`} tone="good" />
        <Stat value={money(ivsBest.monthly)} label={`Best IVS option: ${ivsBest.name}`} />
        <Stat
          value={`${ratio.toFixed(1)}x`}
          label="IVS premium over commodity delivery"
          tone={ratio > 3 ? 'bad' : ratio > 1.5 ? 'warn' : undefined}
        />
        <Stat value={money(ai)} label="AI annotation, same period" />
        <Stat value={compact(viewerHours)} label="Viewer-hours per month" />
      </div>

      <div className={`${styles.callout} ${styles.calloutWarn}`}>
        <div className={styles.calloutTitle}>
          {ai > best.monthly
            ? 'At these settings, AI annotation costs more than delivery'
            : 'At scale, delivery is the entire bill'}
        </div>
        Every delivery architecture converges on one number: dollars per gigabyte. IVS bundles
        delivery into a per-viewer-hour rate that never drops below $0.048, roughly{' '}
        {ivsFloorRatio.toFixed(0)}x the cost of the same bytes on a commodity CDN. That gap is
        not a negotiation problem, it is the wrong product for the job past a certain volume.
        Start on IVS because time-to-market dominates, and treat the migration to commodity
        delivery as an explicit milestone rather than a someday.{' '}
        {ai > best.monthly ? (
          <>
            Note that at {inputs.viewers} concurrent viewers, annotation at $
            {inputs.aiPerStreamHour.toFixed(2)}/stream-hour is the larger line item. AI cost
            scales with <b>stream</b>-hours; delivery scales with <b>viewer</b>-hours. Below
            roughly {Math.ceil(inputs.aiPerStreamHour / Math.max(best.perViewerHour, 1e-6))}{' '}
            viewers per stream, the model is the bill.
          </>
        ) : null}
      </div>

      <div className={styles.two}>
        <div>
          <div className={styles.h3}>Cost per stream-hour vs concurrent viewers</div>
          <CrossoverChart inputs={inputs} />
          <div className={styles.legend}>
            {[
              ['realtime', 'IVS Real-Time (WebRTC)'],
              ['hybrid', 'IVS hybrid (stage to HLS)'],
              ['commodity', 'Own origin + CDN'],
              ['livekit', 'LiveKit Cloud (Ship)'],
            ].map(([k, label]) => (
              <span className={styles.legendItem} key={k}>
                <span className={styles.swatch} style={{background: SERIES_COLORS[k]}} />
                {label}
              </span>
            ))}
          </div>
          <div className={styles.note}>
            First volume tier only, no tier discounts applied, delivery-only (excludes AI).
          </div>
          <div className={styles.callout}>
            <div className={styles.calloutTitle}>
              {isFinite(xover)
                ? `WebRTC stops being cheaper at ~${Math.round(xover)} concurrent viewers`
                : 'WebRTC is cheaper at every viewer count in this configuration'}
            </div>
            Below that, pure WebRTC wins because you pay per connected participant and nothing
            is fixed. Above it, the ${ivsFixedPerStreamHour(inputs).toFixed(3)}/hr of fixed
            channel cost amortizes away and the lower blended delivery rate of{' '}
            {cents(outputLadder(inputs)[0][1])}/hr takes over.
          </div>
        </div>

        <div>
          <div className={styles.h3}>Effective cost per viewer-hour</div>
          <BarList archs={archs} />
          <div className={styles.note}>
            Fully loaded: fixed per-stream charges divided across delivered viewer-hours, with
            volume tiers applied. {gbvh.toFixed(3)} GB per viewer-hour at{' '}
            {inputs.bitrateMbps} Mbps.
          </div>

          <div className={styles.h3} style={{marginTop: '1.25rem'}}>
            Monthly total at this volume
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Architecture</th>
                  <th>$/viewer-hr</th>
                  <th>Monthly</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a, i) => (
                  <tr key={a.key} className={i === 0 ? styles.rowBest : ''}>
                    <td>
                      {a.name}
                      {a.selfOperated ? ' *' : ''}
                    </td>
                    <td>{cents(a.perViewerHour)}</td>
                    <td>{money(a.monthly)}</td>
                  </tr>
                ))}
                <tr>
                  <td>AI annotation (all paths)</td>
                  <td>{cents(viewerHours > 0 ? ai / viewerHours : 0)}</td>
                  <td>{money(ai)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={styles.note}>
            * Delivery only. You operate ingest, transcode and origin yourself, which is a
            team, not a line item.
          </div>
        </div>
      </div>

      <h2 style={{marginTop: '2rem'}}>Three anchored scenarios</h2>
      <ScenarioTable inputs={inputs} />
      <div className={styles.note}>
        Monthly infrastructure at list price, current region and rendition mix, volume tiers
        applied. Excludes AI annotation and excludes the engineering cost of operating the
        commodity path.
      </div>

      <h2 style={{marginTop: '2rem'}}>Assumptions, so they can be argued with</h2>
      <div className={styles.even}>
        <div>
          <p className={styles.assumption}>
            <b>Bitrate.</b> {inputs.bitrateMbps} Mbps gives {gbvh.toFixed(3)} GB per
            viewer-hour. IVS Real-Time caps at 720p, so this is the honest common denominator
            across architectures.
          </p>
          <p className={styles.assumption}>
            <b>Rendition mix.</b> IVS bills output by the resolution actually delivered, and a
            real audience does not all watch at source quality. Shift the mix toward HD and
            the hybrid column gets worse. This is the single most load-bearing assumption in
            the model, which is why it is an input rather than a constant.
          </p>
          <p className={styles.assumption}>
            <b>Watch duration.</b> Viewer-hours here are hours actually delivered, not stream
            duration times audience. AWS's own estimator assumes a viewer watches about half a
            stream, so apply that haircut before entering a number.
          </p>
          <p className={styles.assumption}>
            <b>Channel input bills with zero viewers.</b> The ${IVS_ADVANCED_HD_INPUT.toFixed(2)}
            /hr Advanced HD input charge accrues whenever a broadcaster is live. Long-tail
            streams with no audience are pure loss on the hybrid path, which matters a lot for
            a studio where most streams have single-digit viewers.
          </p>
        </div>
        <div>
          <p className={styles.assumption}>
            <b>AI cost is measured, not estimated.</b> The default $
            {DEFAULTS.aiPerStreamHour.toFixed(2)}/stream-hour is the metered cost of the tiered
            annotator across four real gameplay titles, covering dense annotation and the
            highlight reel. It tracks how eventful the footage is, because the triage tier
            gates how many windows reach the expensive model: sparse mobile gameplay measured
            $3.59/hour and dense arena shooter footage $8.31/hour. Unlike delivery, this cost
            scales with stream-hours rather than viewer-hours, so it dominates the bill for
            small audiences and disappears into the noise for large ones.
          </p>
          <p className={styles.assumption}>
            <b>Volume tiers reset monthly and are per region.</b> Aggregating many studios into
            one account clears tier steps that a single studio never would, which is the
            structural reason a pass-through at cost plus a margin can still land at or below
            their DIY cost.
          </p>
          <p className={styles.assumption}>
            <b>Private pricing is not modeled.</b> Everything here is list. AWS private pricing
            at this volume typically lands 15-30% below list, and that discount is upside not
            reflected in any number on this page.
          </p>
          <p className={styles.assumption}>
            <b>Chat is nearly free at these volumes.</b> Every hour of channel input includes
            2,700 sent and 270,000 delivered messages. Past that it is $0.56 per 1,000 sent and
            $0.008 per 1,000 delivered, which only becomes real if chat volume decouples from
            video hours.
          </p>
        </div>
      </div>
    </div>
  );
}
