import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

/**
 * Rates are deliberately absent. This page is reachable without credentials
 * via /api/auth/demo-auto, so anything it renders is public, and per-unit
 * pricing is quoted per agreement rather than published. Wording here is kept
 * in step with docs-site/docs/monetization.md.
 */
const TIERS = [
  { name: 'Starter', maxHours: 100, included: '100 stream hours/mo' },
  { name: 'Growth', maxHours: 1000, included: '1,000 stream hours/mo' },
  { name: 'Scale', maxHours: 10000, included: '10,000 stream hours/mo' },
  { name: 'Enterprise', maxHours: Infinity, included: 'Unlimited' },
];

/**
 * Viewer hours are not yet metered per session, so this stands in until viewer
 * telemetry lands. Shown as an assumption on the page rather than as a
 * measurement.
 */
const ASSUMED_VIEWERS_PER_STREAM_HOUR = 2.4;

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalStreams,
    monthStreams,
    allStreams,
    monthHighlights,
    totalHighlights,
  ] = await Promise.all([
    prisma.stream.count({ where: { orgId: session.orgId } }),
    prisma.stream.count({ where: { orgId: session.orgId, createdAt: { gte: monthStart } } }),
    prisma.stream.findMany({
      where: { orgId: session.orgId },
      select: { durationSecs: true, createdAt: true, status: true },
    }),
    prisma.highlight.count({ where: { orgId: session.orgId, createdAt: { gte: monthStart } } }),
    prisma.highlight.count({ where: { orgId: session.orgId } }),
  ]);

  const totalStreamHours = allStreams.reduce((acc, s) => acc + (s.durationSecs || 0), 0) / 3600;
  const monthStreamsList = allStreams.filter(s => s.createdAt >= monthStart);
  const monthStreamHours = monthStreamsList.reduce((acc, s) => acc + (s.durationSecs || 0), 0) / 3600;

  const estimatedViewerHours = monthStreamHours * ASSUMED_VIEWERS_PER_STREAM_HOUR;
  const liveNow = allStreams.filter(s => s.status === 'LIVE').length;

  const currentTier = TIERS.find(t => monthStreamHours <= t.maxHours) || TIERS[TIERS.length - 1];

  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(monthStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekStreams = allStreams.filter(s => s.createdAt >= weekStart && s.createdAt < weekEnd);
    const hours = weekStreams.reduce((acc, s) => acc + (s.durationSecs || 0), 0) / 3600;
    return { label: `Week ${i + 1}`, hours: Math.round(hours * 10) / 10, streams: weekStreams.length };
  });

  const maxWeekHours = Math.max(...weeklyData.map(w => w.hours), 1);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usage & Billing</h1>
          <p className="text-sm text-white/50 mt-1">{monthName} &middot; {session.orgName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 uppercase tracking-wide">Current Plan</span>
          <span className="rounded-full bg-brand-600/20 text-brand-400 px-3 py-1 text-sm font-semibold">
            {currentTier.name}
          </span>
        </div>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Stream Hours" value={formatHours(monthStreamHours)} subtext={`${monthStreams} streams · ${formatHours(totalStreamHours)} hrs all time`} />
        <MetricCard label="Viewer Hours (est.)" value={formatHours(estimatedViewerHours)} subtext={`assumed ${ASSUMED_VIEWERS_PER_STREAM_HOUR}x, telemetry pending`} />
        <MetricCard label="AI Highlights" value={monthHighlights.toString()} subtext={`${totalHighlights} total`} />
        <MetricCard label="Live Now" value={liveNow.toString()} subtext={`${totalStreams} total streams`} accent={liveNow > 0} />
      </div>

      {/* Cost breakdown and weekly chart side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* What is metered */}
        <section className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold">What We Meter</h2>
            <p className="text-xs text-white/40 mt-0.5">Your billable usage this month</p>
          </div>
          <div className="p-5 space-y-4">
            <MeteredLine
              label="Stream hours"
              basis="Each hour a broadcaster is live, watched or not"
              quantity={`${formatHours(monthStreamHours)} hrs`}
            />
            <MeteredLine
              label="Viewer hours"
              basis="Each hour watched, per viewer"
              quantity={`${formatHours(estimatedViewerHours)} hrs`}
              estimated
            />
            <MeteredLine
              label="AI highlights"
              basis="Each generated reel"
              quantity={`${monthHighlights} reels`}
            />
            <div className="border-t border-white/10 pt-4 space-y-2.5">
              <p className="text-sm font-semibold">Rates are set per agreement</p>
              <p className="text-xs text-white/50 leading-relaxed">
                We don&apos;t publish per-unit rates yet. Region, delivery architecture and
                committed volume each move the underlying cost by more than a rounding error, so
                your rate card is quoted against the usage above rather than off a list price.
              </p>
              <a
                href="https://substream.ai/try"
                className="inline-block rounded-lg bg-brand-600/20 text-brand-400 px-4 py-2 text-sm font-semibold hover:bg-brand-600/30 transition-colors"
              >
                Get a quote &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* Weekly usage chart */}
        <section className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold">Weekly Usage</h2>
            <p className="text-xs text-white/40 mt-0.5">Stream hours per week</p>
          </div>
          <div className="p-5 space-y-4">
            {weeklyData.map((week) => (
              <div key={week.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{week.label}</span>
                  <span className="text-white/80 font-medium">{week.hours} hrs &middot; {week.streams} streams</span>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${Math.max((week.hours / maxWeekHours) * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* API Keys link */}
      <section className="rounded-xl border border-white/10 bg-surface-100 p-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">API Keys</h2>
          <p className="text-xs text-white/40 mt-0.5">Create and manage keys for SDK authentication</p>
        </div>
        <a href="/dashboard/keys" className="rounded-lg bg-brand-600/20 text-brand-400 px-4 py-2 text-sm font-semibold hover:bg-brand-600/30 transition-colors">
          Manage Keys &rarr;
        </a>
      </section>

      {/* Pricing tiers */}
      <section className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold">Plans</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Included stream hours per tier. Usage beyond the allowance is metered on the three
            dimensions above.
          </p>
        </div>
        <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-5 space-y-3 ${tier.name === currentTier.name ? 'bg-brand-600/5' : ''}`}
            >
              <div>
                <p className="font-semibold">{tier.name}</p>
                <p className="text-2xl font-bold mt-1">{tier.included.replace(' stream hours/mo', '')}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {tier.maxHours === Infinity ? 'stream hours' : 'stream hours/mo'}
                </p>
              </div>
              {tier.name === currentTier.name && (
                <span className="inline-block text-xs text-brand-400 font-medium">Current plan</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, subtext, accent }: {
  label: string; value: string; subtext: string; accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-4">
      <p className="text-xs text-white/50 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? 'text-live' : ''}`}>{value}</p>
      <p className="text-xs text-white/30 mt-1">{subtext}</p>
    </div>
  );
}

function MeteredLine({ label, basis, quantity, estimated }: {
  label: string; basis: string; quantity: string; estimated?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="space-y-0.5">
        <p className="text-white/80">{label}</p>
        <p className="text-xs text-white/30">{basis}</p>
      </div>
      <div className="text-right shrink-0">
        <span className="font-medium tabular-nums">{quantity}</span>
        {estimated && <p className="text-xs text-white/30">estimated</p>}
      </div>
    </div>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return hours.toFixed(1);
  return Math.round(hours).toString();
}
