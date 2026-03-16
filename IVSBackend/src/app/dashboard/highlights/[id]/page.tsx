import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { HighlightPoller } from './poller';
import { HighlightVideo } from './video';
import { VideoPlayer } from '@/components/VideoPlayer';
import { SegmentTimeline } from './timeline';

export const dynamic = 'force-dynamic';

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

const STEP_ICONS: Record<string, string> = {
  Download: '↓',
  'Scene Analysis': '◎',
  'Audio Analysis': '♫',
  'Segment Scoring': '✦',
  'Highlight Selection': '⊕',
  Assembly: '⧉',
};

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
      stream: {
        select: {
          id: true,
          title: true,
          streamerName: true,
          recordingUrl: true,
          thumbnailUrl: true,
          durationSecs: true,
        },
      },
    },
  });

  if (!highlight) notFound();

  const pipeline = highlight.pipelineData as PipelineData | null;

  let videoUrl = highlight.videoUrl;
  if (videoUrl && videoUrl.startsWith('gs://')) {
    const hlServiceUrl = process.env.HIGHLIGHT_SERVICE_URL || 'http://localhost:8080';
    try {
      const res = await fetch(
        `${hlServiceUrl}/api/v1/signed-url?uri=${encodeURIComponent(videoUrl)}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const data = await res.json();
        videoUrl = data.url;
      }
    } catch {
      videoUrl = null;
    }
  }

  const hasOutput = highlight.status === 'COMPLETED' && videoUrl;
  const sourceUrl = highlight.stream?.recordingUrl || null;
  const compressionRatio =
    pipeline && pipeline.source_duration > 0
      ? Math.round((1 - pipeline.highlight_duration / pipeline.source_duration) * 100)
      : null;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/highlights"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          &larr; Highlights
        </Link>
        <span className="text-white/20">/</span>
        <h1 className="text-lg font-semibold truncate">{highlight.title}</h1>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1 — Source Recording → AI Output (side by side)           */}
      {/* ================================================================= */}
      {hasOutput ? (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Source */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Original Recording
                </h2>
                {highlight.stream?.durationSecs && (
                  <span className="text-xs text-white/25">
                    {formatDuration(highlight.stream.durationSecs)}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
                {sourceUrl ? (
                  <VideoPlayer url={sourceUrl} poster={highlight.stream?.thumbnailUrl || undefined} />
                ) : (
                  <div className="aspect-video bg-surface-300 flex items-center justify-center">
                    <p className="text-xs text-white/20">Source recording unavailable</p>
                  </div>
                )}
              </div>
            </div>

            {/* Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  AI-Generated Highlight
                </h2>
                {highlight.duration && (
                  <span className="text-xs text-white/25">
                    {formatDuration(highlight.duration)}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-brand-500/30 bg-surface-100 overflow-hidden">
                <HighlightVideo url={videoUrl!} />
              </div>
            </div>
          </div>

          {/* Compression stat banner */}
          {compressionRatio !== null && (
            <div className="flex items-center justify-center gap-6 rounded-xl border border-white/5 bg-surface-100 px-5 py-3">
              <span className="text-xs text-white/40">
                {formatDuration(pipeline!.source_duration)} source
              </span>
              <span className="text-brand-400 text-lg">→</span>
              <span className="text-sm font-semibold text-brand-400">
                {formatDuration(pipeline!.highlight_duration)} highlight
              </span>
              <span className="text-xs text-white/25">
                ({compressionRatio}% reduction)
              </span>
            </div>
          )}
        </div>
      ) : highlight.status === 'PROCESSING' || highlight.status === 'PENDING' ? (
        <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
          <HighlightPoller
            highlightId={highlight.id}
            orgSlug={session.orgSlug}
            initialStatus={highlight.status}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
          <div className="aspect-video bg-black flex items-center justify-center">
            <div className="text-center space-y-1">
              <p className="text-danger text-sm font-medium">Highlight generation failed</p>
              <p className="text-xs text-white/30">
                Try generating a new highlight from the recording.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-white/50">
        {highlight.stream && (
          <span>
            Source:{' '}
            <Link
              href={`/dashboard/streams/${highlight.stream.id}`}
              className="text-brand-400 hover:underline"
            >
              {highlight.stream.title || 'Untitled Stream'}
            </Link>
          </span>
        )}
        {highlight.duration && (
          <span>
            Duration: {Math.floor(highlight.duration / 60)}m {highlight.duration % 60}s
          </span>
        )}
        <span>Created: {new Date(highlight.createdAt).toLocaleString()}</span>
      </div>

      {/* ================================================================= */}
      {/* SECTION 2 — AI Agent Pipeline                                     */}
      {/* ================================================================= */}
      {pipeline && (
        <>
          {/* How the AI Agent Works */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">How the AI Agent Works</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-400 font-medium">
                {pipeline.model}
              </span>
            </div>

            {/* Pipeline flow — horizontal steps */}
            <div className="rounded-xl border border-white/10 bg-surface-100 p-5 overflow-x-auto">
              <div className="flex items-stretch gap-0 min-w-max">
                {pipeline.steps.map((step, i) => {
                  const totalTime = pipeline.steps.reduce((a, s) => a + s.duration_sec, 0);
                  const pct = totalTime > 0 ? (step.duration_sec / totalTime) * 100 : 0;
                  const icon = STEP_ICONS[step.name] || `${i + 1}`;
                  return (
                    <div key={i} className="flex items-stretch">
                      {/* Step card */}
                      <div className="w-40 rounded-lg border border-white/10 bg-surface-200 p-3 flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-7 h-7 rounded-md bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-sm">
                            {icon}
                          </span>
                          <span className="text-xs font-semibold">{step.name}</span>
                        </div>
                        {step.detail && (
                          <p className="text-[10px] text-white/30 leading-snug flex-1">
                            {step.detail}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500/50 rounded-full"
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/30 shrink-0">
                            {step.duration_sec >= 1
                              ? `${Math.round(step.duration_sec)}s`
                              : `${Math.round(step.duration_sec * 1000)}ms`}
                          </span>
                        </div>
                      </div>
                      {/* Arrow connector */}
                      {i < pipeline.steps.length - 1 && (
                        <div className="flex items-center px-1.5 text-white/15">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M6 3l5 5-5 5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatBox label="Source" value={formatDuration(pipeline.source_duration)} />
              <StatBox label="Highlight" value={formatDuration(pipeline.highlight_duration)} />
              <StatBox label="Analyzed" value={`${pipeline.segments_analyzed} seg`} />
              <StatBox label="Selected" value={`${pipeline.segments_selected} seg`} />
              <StatBox
                label="Model"
                value={pipeline.model.replace('gemini-', '').replace('-preview', '')}
              />
              <StatBox label="Processing" value={formatDuration(pipeline.processing_time_seconds)} />
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 3 — Visual Timeline                                       */}
          {/* ================================================================= */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Source Video Analysis</h2>
            <div className="rounded-xl border border-white/10 bg-surface-100 p-5">
              <SegmentTimeline
                segments={pipeline.segments}
                sourceDuration={pipeline.source_duration}
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 4 — Segment Detail Table                                  */}
          {/* ================================================================= */}
          <SegmentTable segments={pipeline.segments} />
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function SegmentTable({ segments }: { segments: PipelineSegment[] }) {
  const selected = segments.filter((s) => s.selected).sort((a, b) => b.score - a.score);
  const rejected = segments.filter((s) => !s.selected).sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...segments.map((s) => s.score));

  return (
    <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold text-sm">What Gemini Saw</h3>
        <span className="text-xs text-white/30">
          {selected.length} selected / {segments.length} total
        </span>
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
                <td className="px-5 py-2.5 font-mono text-xs text-white/60">
                  {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                </td>
                <td className="px-3 py-2.5 text-xs text-white/50">{seg.duration.toFixed(1)}s</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(seg.score / maxScore) * 100}%`,
                          backgroundColor:
                            seg.score >= 70
                              ? '#22c55e'
                              : seg.score >= 50
                                ? '#3b82f6'
                                : '#f59e0b',
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
                <td className="px-5 py-2.5 font-mono text-xs text-white/30">
                  {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                </td>
                <td className="px-3 py-2.5 text-xs text-white/20">{seg.duration.toFixed(1)}s</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/15 rounded-full"
                        style={{ width: `${(seg.score / maxScore) * 100}%` }}
                      />
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
