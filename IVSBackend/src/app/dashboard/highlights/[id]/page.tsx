import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { HighlightPoller } from './poller';
import { HighlightVideo } from './video';

interface PipelineStep {
  name: string;
  duration_sec: number;
  detail?: string;
}

interface PipelineSegment {
  start: number;
  end: number;
  duration: number;
  score: number;
  label: string;
  selected: boolean;
}

interface PipelineData {
  source_duration: number;
  highlight_duration: number;
  segments_analyzed: number;
  segments_selected: number;
  processing_time_seconds: number;
  model: string;
  steps: PipelineStep[];
  segments: PipelineSegment[];
}

export default async function HighlightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const highlight = await prisma.highlight.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      stream: { select: { id: true, title: true, streamerName: true } },
    },
  });

  if (!highlight) notFound();

  const pipeline = highlight.pipelineData as PipelineData | null;

  // Resolve GCS URI to signed URL via highlight service
  let videoUrl = highlight.videoUrl;
  if (videoUrl && videoUrl.startsWith('gs://')) {
    const hlServiceUrl = process.env.HIGHLIGHT_SERVICE_URL || 'http://localhost:8080';
    try {
      const res = await fetch(`${hlServiceUrl}/api/v1/signed-url?uri=${encodeURIComponent(videoUrl)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        videoUrl = data.url;
      }
    } catch {
      videoUrl = null;
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/highlights" className="text-sm text-white/40 hover:text-white transition-colors">
          &larr; Highlights
        </Link>
        <span className="text-white/20">/</span>
        <h1 className="text-lg font-semibold truncate">{highlight.title}</h1>
      </div>

      {/* Video player */}
      <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        {highlight.status === 'COMPLETED' && videoUrl ? (
          <HighlightVideo url={videoUrl} />
        ) : highlight.status === 'PROCESSING' || highlight.status === 'PENDING' ? (
          <HighlightPoller
            highlightId={highlight.id}
            orgSlug={session.orgSlug}
            initialStatus={highlight.status}
          />
        ) : (
          <div className="aspect-video bg-black flex items-center justify-center">
            <div className="text-center space-y-1">
              <p className="text-danger text-sm font-medium">Highlight generation failed</p>
              <p className="text-xs text-white/30">Try generating a new highlight from the recording.</p>
            </div>
          </div>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-white/50">
        {highlight.stream && (
          <span>
            Source:{' '}
            <Link href={`/dashboard/streams/${highlight.stream.id}`} className="text-brand-400 hover:underline">
              {highlight.stream.title || 'Untitled Stream'}
            </Link>
          </span>
        )}
        {highlight.duration && (
          <span>Duration: {Math.floor(highlight.duration / 60)}m {highlight.duration % 60}s</span>
        )}
        <span>Created: {new Date(highlight.createdAt).toLocaleString()}</span>
      </div>

      {/* Pipeline Analysis — the "sauce" */}
      {pipeline && <PipelineAnalysis data={pipeline} />}
    </div>
  );
}

function PipelineAnalysis({ data }: { data: PipelineData }) {
  const selected = data.segments.filter(s => s.selected).sort((a, b) => b.score - a.score);
  const rejected = data.segments.filter(s => !s.selected).sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...data.segments.map(s => s.score));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Pipeline Analysis</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-400 font-medium">
          {data.model}
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="Source" value={formatDuration(data.source_duration)} />
        <StatBox label="Highlight" value={formatDuration(data.highlight_duration)} />
        <StatBox label="Analyzed" value={`${data.segments_analyzed} segments`} />
        <StatBox label="Selected" value={`${data.segments_selected} segments`} />
        <StatBox label="Model" value={data.model.replace('gemini-', '').replace('-preview', '')} />
        <StatBox label="Processing" value={formatDuration(data.processing_time_seconds)} />
      </div>

      {/* Pipeline steps */}
      <div className="rounded-xl border border-white/10 bg-surface-100 p-5 space-y-4">
        <h3 className="font-semibold text-sm">Pipeline Steps</h3>
        <div className="space-y-3">
          {data.steps.map((step, i) => {
            const totalTime = data.steps.reduce((a, s) => a + s.duration_sec, 0);
            const pct = totalTime > 0 ? (step.duration_sec / totalTime) * 100 : 0;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xs font-bold mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{step.name}</p>
                    <span className="text-xs text-white/40 shrink-0 ml-2">
                      {step.duration_sec >= 1 ? `${Math.round(step.duration_sec)}s` : `${Math.round(step.duration_sec * 1000)}ms`}
                    </span>
                  </div>
                  {step.detail && <p className="text-xs text-white/30 mt-0.5">{step.detail}</p>}
                  <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500/50 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Segment analysis table */}
      <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Segment Analysis — What Gemini Saw</h3>
          <span className="text-xs text-white/30">{selected.length} selected / {data.segments.length} total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 border-b border-white/5">
                <th className="px-5 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">Duration</th>
                <th className="px-3 py-2.5 font-medium w-32">Score</th>
                <th className="px-3 py-2.5 font-medium">What Gemini Saw</th>
                <th className="px-3 py-2.5 font-medium text-right pr-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {selected.map((seg, i) => (
                <tr key={`sel-${i}`} className="border-b border-white/5 bg-brand-600/5">
                  <td className="px-5 py-2.5 font-mono text-xs text-white/60">{formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}</td>
                  <td className="px-3 py-2.5 text-xs text-white/50">{seg.duration.toFixed(1)}s</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(seg.score / maxScore) * 100}%`,
                            backgroundColor: seg.score >= 70 ? '#22c55e' : seg.score >= 50 ? '#3b82f6' : '#f59e0b',
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-6 text-right">{seg.score}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{seg.label}</td>
                  <td className="px-3 py-2.5 text-right pr-5">
                    <span className="text-xs text-success font-medium">Selected</span>
                  </td>
                </tr>
              ))}
              {rejected.map((seg, i) => (
                <tr key={`rej-${i}`} className="border-b border-white/5">
                  <td className="px-5 py-2.5 font-mono text-xs text-white/30">{formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}</td>
                  <td className="px-3 py-2.5 text-xs text-white/20">{seg.duration.toFixed(1)}s</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white/15 rounded-full" style={{ width: `${(seg.score / maxScore) * 100}%` }} />
                      </div>
                      <span className="text-xs text-white/20 w-6 text-right">{seg.score}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-white/20">{seg.label}</td>
                  <td className="px-3 py-2.5 text-right pr-5">
                    <span className="text-xs text-white/15">Rejected</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface-200 px-4 py-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
