import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

const PRICE_PER_STREAM_HOUR = 0.12;
const PRICE_PER_VIEWER_HOUR = 0.03;
const PRICE_PER_HIGHLIGHT = 0.50;

const TIERS = [
  { name: 'Starter', maxHours: 100, price: 0, included: '100 stream hours/mo' },
  { name: 'Growth', maxHours: 1000, price: 99, included: '1,000 stream hours/mo' },
  { name: 'Scale', maxHours: 10000, price: 499, included: '10,000 stream hours/mo' },
  { name: 'Enterprise', maxHours: Infinity, price: null, included: 'Unlimited' },
];

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

  const estimatedViewerHours = monthStreamHours * 2.4;
  const liveNow = allStreams.filter(s => s.status === 'LIVE').length;

  const streamCost = monthStreamHours * PRICE_PER_STREAM_HOUR;
  const viewerCost = estimatedViewerHours * PRICE_PER_VIEWER_HOUR;
  const highlightCost = monthHighlights * PRICE_PER_HIGHLIGHT;
  const totalCost = streamCost + viewerCost + highlightCost;

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
        <MetricCard label="Stream Hours" value={formatHours(monthStreamHours)} subtext={`${monthStreams} streams this month`} />
        <MetricCard label="Viewer Hours (est.)" value={formatHours(estimatedViewerHours)} subtext={`~${(estimatedViewerHours / Math.max(monthStreamHours, 0.01)).toFixed(1)}x multiplier`} />
        <MetricCard label="AI Highlights" value={monthHighlights.toString()} subtext={`${totalHighlights} total`} />
        <MetricCard label="Live Now" value={liveNow.toString()} subtext={`${totalStreams} total streams`} accent={liveNow > 0} />
      </div>

      {/* Cost breakdown and weekly chart side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cost breakdown */}
        <section className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold">Estimated Cost</h2>
            <p className="text-xs text-white/40 mt-0.5">Based on current month usage</p>
          </div>
          <div className="p-5 space-y-4">
            <CostLine
              label="Stream hours"
              quantity={`${formatHours(monthStreamHours)} hrs`}
              rate={`$${PRICE_PER_STREAM_HOUR}/hr`}
              total={streamCost}
            />
            <CostLine
              label="Viewer hours"
              quantity={`${formatHours(estimatedViewerHours)} hrs`}
              rate={`$${PRICE_PER_VIEWER_HOUR}/hr`}
              total={viewerCost}
            />
            <CostLine
              label="AI highlights"
              quantity={`${monthHighlights} highlights`}
              rate={`$${PRICE_PER_HIGHLIGHT.toFixed(2)}/each`}
              total={highlightCost}
            />
            <div className="border-t border-white/10 pt-4 flex items-center justify-between">
              <span className="font-semibold">Total Estimated</span>
              <span className="text-2xl font-bold text-brand-400">${totalCost.toFixed(2)}</span>
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
          <p className="text-xs text-white/40 mt-0.5">Usage-based pricing with included tiers</p>
        </div>
        <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-5 space-y-3 ${tier.name === currentTier.name ? 'bg-brand-600/5' : ''}`}
            >
              <div>
                <p className="font-semibold">{tier.name}</p>
                <p className="text-2xl font-bold mt-1">
                  {tier.price === null ? 'Custom' : tier.price === 0 ? 'Free' : `$${tier.price}`}
                  {tier.price !== null && tier.price > 0 && (
                    <span className="text-sm text-white/40 font-normal">/mo</span>
                  )}
                </p>
              </div>
              <p className="text-xs text-white/50">{tier.included}</p>
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

function CostLine({ label, quantity, rate, total }: {
  label: string; quantity: string; rate: string; total: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="space-y-0.5">
        <p className="text-white/80">{label}</p>
        <p className="text-xs text-white/30">{quantity} × {rate}</p>
      </div>
      <span className="font-medium">${total.toFixed(2)}</span>
    </div>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return hours.toFixed(1);
  return Math.round(hours).toString();
}
