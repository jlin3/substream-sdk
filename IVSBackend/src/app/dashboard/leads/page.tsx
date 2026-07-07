import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { demoSites: { select: { slug: true, brandName: true, template: true } } },
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-sm text-white/50 mt-1">
          Everyone who generated a personalized demo through the &quot;Demo it yourself&quot; funnel.
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-surface-100 p-10 text-center text-white/40 text-sm">
          No leads yet. Share the funnel: <span className="text-white/70 font-mono">/try</span>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Website</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Survey</th>
                <th className="px-4 py-3 font-semibold">Demo site</th>
                <th className="px-4 py-3 font-semibold hidden sm:table-cell">When</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const survey = (lead.survey ?? {}) as Record<string, unknown>;
                return (
                  <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium">{lead.name}</td>
                    <td className="px-4 py-3 text-white/70">
                      <a href={`mailto:${lead.email}`} className="hover:text-brand-400 transition-colors">{lead.email}</a>
                    </td>
                    <td className="px-4 py-3 text-white/50 hidden md:table-cell max-w-[180px] truncate">
                      {lead.websiteUrl || '—'}
                    </td>
                    <td className="px-4 py-3 text-white/50 hidden lg:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {['role', 'template', 'genre', 'platform', 'communitySize']
                          .filter((k) => survey[k])
                          .map((k) => (
                            <span key={k} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px]">
                              {String(survey[k])}
                            </span>
                          ))}
                      </span>
                      {typeof survey.streamingGoals === 'string' && survey.streamingGoals && (
                        <span
                          className="mt-1 block max-w-[280px] truncate text-[11px] text-white/35 italic"
                          title={survey.streamingGoals}
                        >
                          &ldquo;{survey.streamingGoals}&rdquo;
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.demoSites.length > 0 ? (
                        <Link href={`/d/${lead.demoSites[0].slug}`} className="text-brand-400 hover:underline">
                          /d/{lead.demoSites[0].slug}
                        </Link>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/40 hidden sm:table-cell whitespace-nowrap">
                      {lead.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                      {lead.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
