'use client';

/**
 * Streaming revenue estimator for /sports.
 *
 * Ported from the original site's five-step ROI calculator and collapsed
 * into one live panel: no steps, no email gate. Same benchmark rates.
 * One correction to the original model: subscriptions are counted once
 * per fan per month instead of once per stream.
 */

import { useId, useMemo, useState } from 'react';
import { BTN_PRIMARY } from '@/components/site/shared';
import { DEMO_BOOKING_URL } from '@/lib/sports';

// ---- Benchmarks (from the original calculator) ---------------------------

type Vertical = 'sports' | 'entertainment' | 'education' | 'corporate' | 'religious' | 'other';
type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type SponsorTier = 'basic' | 'standard' | 'premium';
type Production = 'diy' | 'basic' | 'professional' | 'broadcast';

const VERTICALS: { key: Vertical; label: string; cpm: number }[] = [
  { key: 'sports', label: 'Sports', cpm: 25 },
  { key: 'entertainment', label: 'Music & shows', cpm: 20 },
  { key: 'corporate', label: 'Conferences', cpm: 30 },
  { key: 'education', label: 'Education', cpm: 15 },
  { key: 'religious', label: 'Faith', cpm: 10 },
  { key: 'other', label: 'Other', cpm: 15 },
];

const FREQUENCIES: { key: Frequency; label: string; perMonth: number }[] = [
  { key: 'daily', label: 'Daily', perMonth: 30 },
  { key: 'weekly', label: 'Weekly', perMonth: 4 },
  { key: 'monthly', label: 'Monthly', perMonth: 1 },
  { key: 'quarterly', label: 'Quarterly', perMonth: 0.33 },
];

const SPONSOR_TIERS: { key: SponsorTier; label: string; hint: string; min: number }[] = [
  { key: 'basic', label: 'Local', hint: 'Local brand, single event', min: 2500 },
  { key: 'standard', label: 'Regional', hint: 'Regional brand, event series', min: 5000 },
  { key: 'premium', label: 'National', hint: 'National brand, exclusive rights', min: 15000 },
];

const PRODUCTION: { key: Production; label: string; monthly: number }[] = [
  { key: 'diy', label: 'DIY', monthly: 200 },
  { key: 'basic', label: 'Basic crew', monthly: 800 },
  { key: 'professional', label: 'Professional', monthly: 3000 },
  { key: 'broadcast', label: 'Broadcast', monthly: 8000 },
];

const AUDIENCE_STEPS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000];

const SERIES = [
  { key: 'tickets', label: 'Pay-per-view', color: '#2B7FFF' },
  { key: 'subs', label: 'Subscriptions', color: '#9EC3FF' },
  { key: 'merch', label: 'Merchandise', color: '#22d3ee' },
  { key: 'sponsors', label: 'Sponsorship', color: '#a78bfa' },
  { key: 'ads', label: 'Advertising', color: '#34d399' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(n));
const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Native range input restyled for the dark surface (track fill follows --fill)
const RANGE_CSS = `
  .ss-range { -webkit-appearance: none; appearance: none; background: transparent; }
  .ss-range::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: linear-gradient(to right, #2B7FFF var(--fill), rgba(255,255,255,0.14) var(--fill)); }
  .ss-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; margin-top: -6px; border-radius: 50%; background: #fff; border: 2px solid #2B7FFF; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
  .ss-range::-moz-range-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.14); }
  .ss-range::-moz-range-progress { height: 6px; border-radius: 999px; background: #2B7FFF; }
  .ss-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid #2B7FFF; }
  .ss-range:focus-visible { outline: 2px solid #2B7FFF; outline-offset: 4px; border-radius: 999px; }
`;

// ---- Small controls --------------------------------------------------------

function Segmented<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-white/85">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.key)}
              className={`h-9 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B7FFF] ${
                on
                  ? 'border-[#2B7FFF]/60 bg-[#2B7FFF]/15 text-white'
                  : 'border-white/12 text-white/65 hover:border-white/25 hover:text-white'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Range({
  label, display, min, max, step, value, onChange,
}: { label: string; display: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-white/65">{label}</label>
        <output htmlFor={id} className="text-sm font-medium text-white tabular-nums">{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
        className="ss-range h-6 w-full cursor-pointer"
      />
    </div>
  );
}

function StreamCard({
  title, on, onToggle, color, children,
}: { title: string; on: boolean; onToggle: (v: boolean) => void; color: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className={`rounded-xl border p-4 transition-colors ${on ? 'border-white/15 bg-white/[0.03]' : 'border-white/[0.08]'}`}>
      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-white/90">
          <span aria-hidden className="size-2 rounded-full" style={{ background: on ? color : 'rgba(255,255,255,0.2)' }} />
          {title}
        </span>
        <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={on}
            onChange={(e) => onToggle(e.target.checked)}
            className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full bg-white/15 transition-colors checked:bg-[#2B7FFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B7FFF]"
          />
          <span aria-hidden className="pointer-events-none absolute left-0.5 size-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
      {on && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

// ---- Calculator ------------------------------------------------------------

export default function RoiCalculator() {
  const [vertical, setVertical] = useState<Vertical>('sports');
  const [audienceIdx, setAudienceIdx] = useState(3);
  const [frequency, setFrequency] = useState<Frequency>('weekly');

  const [tickets, setTickets] = useState(true);
  const [ticketPrice, setTicketPrice] = useState(15);
  const [ticketConv, setTicketConv] = useState(5);

  const [subs, setSubs] = useState(true);
  const [subPrice, setSubPrice] = useState(10);
  const [subConv, setSubConv] = useState(2);

  const [merch, setMerch] = useState(false);
  const [merchOrder, setMerchOrder] = useState(35);
  const [merchConv, setMerchConv] = useState(2);

  const [sponsors, setSponsors] = useState(false);
  const [sponsorTier, setSponsorTier] = useState<SponsorTier>('standard');
  const [sponsorCount, setSponsorCount] = useState(2);

  const [ads, setAds] = useState(true);
  const [adFill, setAdFill] = useState(70);

  const [production, setProduction] = useState<Production>('basic');

  const audience = AUDIENCE_STEPS[audienceIdx];

  const r = useMemo(() => {
    const perMonth = FREQUENCIES.find((f) => f.key === frequency)!.perMonth;
    const views = audience * perMonth;
    const cpm = VERTICALS.find((v) => v.key === vertical)!.cpm;
    const parts: Record<SeriesKey, number> = {
      tickets: tickets ? views * (ticketConv / 100) * ticketPrice : 0,
      subs: subs ? audience * (subConv / 100) * subPrice : 0,
      merch: merch ? views * (merchConv / 100) * merchOrder : 0,
      sponsors: sponsors ? sponsorCount * SPONSOR_TIERS.find((t) => t.key === sponsorTier)!.min : 0,
      ads: ads ? ((views * (adFill / 100)) / 1000) * cpm : 0,
    };
    const revenue = Object.values(parts).reduce((a, b) => a + b, 0);
    const cost = PRODUCTION.find((p) => p.key === production)!.monthly;
    return { parts, revenue, cost, net: revenue - cost, views, cpm };
  }, [vertical, audience, frequency, tickets, ticketPrice, ticketConv, subs, subPrice, subConv, merch, merchOrder, merchConv, sponsors, sponsorTier, sponsorCount, ads, adFill, production]);

  const activeSeries = SERIES.filter((s) => r.parts[s.key] > 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <style>{RANGE_CSS}</style>
      {/* Inputs */}
      <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <Segmented label="What do you stream?" options={VERTICALS} value={vertical} onChange={setVertical} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Range
            label="Viewers per stream"
            display={audience.toLocaleString('en-US')}
            min={0}
            max={AUDIENCE_STEPS.length - 1}
            step={1}
            value={audienceIdx}
            onChange={setAudienceIdx}
          />
          <Segmented label="How often?" options={FREQUENCIES} value={frequency} onChange={setFrequency} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-white/85">Revenue lines</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <StreamCard title="Pay-per-view tickets" on={tickets} onToggle={setTickets} color={SERIES[0].color}>
              <Range label="Ticket price" display={usd(ticketPrice)} min={3} max={50} step={1} value={ticketPrice} onChange={setTicketPrice} />
              <Range label="Viewers who buy" display={`${ticketConv}%`} min={1} max={15} step={0.5} value={ticketConv} onChange={setTicketConv} />
            </StreamCard>
            <StreamCard title="Subscriptions" on={subs} onToggle={setSubs} color={SERIES[1].color}>
              <Range label="Monthly price" display={usd(subPrice)} min={3} max={30} step={1} value={subPrice} onChange={setSubPrice} />
              <Range label="Fans who subscribe" display={`${subConv}%`} min={0.5} max={10} step={0.5} value={subConv} onChange={setSubConv} />
            </StreamCard>
            <StreamCard title="Merchandise" on={merch} onToggle={setMerch} color={SERIES[2].color}>
              <Range label="Average order" display={usd(merchOrder)} min={10} max={150} step={5} value={merchOrder} onChange={setMerchOrder} />
              <Range label="Viewers who buy" display={`${merchConv}%`} min={0.5} max={8} step={0.5} value={merchConv} onChange={setMerchConv} />
            </StreamCard>
            <StreamCard title="Sponsorship" on={sponsors} onToggle={setSponsors} color={SERIES[3].color}>
              <Segmented label="Sponsor size" options={SPONSOR_TIERS} value={sponsorTier} onChange={setSponsorTier} />
              <Range label="Sponsors" display={`${sponsorCount}`} min={1} max={8} step={1} value={sponsorCount} onChange={setSponsorCount} />
            </StreamCard>
            <StreamCard title="Advertising" on={ads} onToggle={setAds} color={SERIES[4].color}>
              <Range label="Ad inventory sold" display={`${adFill}%`} min={10} max={100} step={5} value={adFill} onChange={setAdFill} />
              <p className="text-xs text-white/50">Benchmark CPM for this category: {usd(r.cpm)}</p>
            </StreamCard>
          </div>
        </div>

        <Segmented label="Production setup" options={PRODUCTION} value={production} onChange={setProduction} />
      </div>

      {/* Result */}
      <div className="rounded-2xl border border-[#2B7FFF]/30 bg-[#2B7FFF]/[0.06] p-5 sm:p-6 lg:sticky lg:top-24" aria-live="polite">
        <p className="text-sm text-white/65">Estimated revenue per month</p>
        <p
          className="mt-1 bg-clip-text text-4xl font-semibold tracking-tight text-transparent tabular-nums sm:text-5xl"
          style={{ backgroundImage: 'linear-gradient(180deg, #CFE1FF 0%, #5C9DFF 100%)' }}
        >
          {usd(r.revenue)}
        </p>
        <p className="mt-1 text-sm text-white/55">
          {compact(r.views)} views a month · {usd(r.revenue * 12)} a year
        </p>

        {/* Stacked bar */}
        <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]" role="img" aria-label="Revenue split by line">
          {activeSeries.map((s) => (
            <span
              key={s.key}
              style={{ width: `${(r.parts[s.key] / r.revenue) * 100}%`, background: s.color }}
              className="h-full transition-[width] duration-300 ease-out"
            />
          ))}
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          {SERIES.map((s) => (
            <div key={s.key} className={`flex items-center justify-between gap-3 ${r.parts[s.key] > 0 ? '' : 'opacity-45'}`}>
              <dt className="flex items-center gap-2 text-white/75">
                <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </dt>
              <dd className="font-medium text-white tabular-nums">{r.parts[s.key] > 0 ? usd(r.parts[s.key]) : 'Off'}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/65">Production estimate</span>
            <span className="text-white/85 tabular-nums">-{usd(r.cost)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-white">After production</span>
            <span className={`font-semibold tabular-nums ${r.net >= 0 ? 'text-[#7EE2A8]' : 'text-[#FCA5A5]'}`}>
              {r.net < 0 ? '-' : ''}{usd(Math.abs(r.net))} / mo
            </span>
          </div>
        </div>

        <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer" className={`${BTN_PRIMARY} mt-6 w-full`}>
          Walk through these numbers with us
        </a>
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          An illustrative estimate from your inputs and benchmark rates, not a forecast. Sponsorship
          uses the low end of typical monthly ranges. Platform terms are agreed on a call.
        </p>
      </div>
    </div>
  );
}
