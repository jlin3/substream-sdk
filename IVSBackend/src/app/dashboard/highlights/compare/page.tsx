'use client';

import { useState } from 'react';
import Link from 'next/link';

interface HighlightJob {
  job_id: string;
  status: string;
  highlight_url: string | null;
  metadata: {
    model_used: string;
    source_duration: number;
    highlight_duration: number;
    segments_analyzed: number;
    segments_selected: number;
    processing_time_seconds: number;
    review_score: number | null;
    game_detected: string | null;
    genre_detected: string | null;
  } | null;
  segments: Array<{
    start_time: number;
    end_time: number;
    duration: number;
    score: number;
    label: string;
  }> | null;
}

export default function CompareHighlightsPage() {
  const [jobs, setJobs] = useState<HighlightJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedA, setSelectedA] = useState<HighlightJob | null>(null);
  const [selectedB, setSelectedB] = useState<HighlightJob | null>(null);
  const [voteA, setVoteA] = useState(0);
  const [voteB, setVoteB] = useState(0);

  const hlServiceUrl = process.env.NEXT_PUBLIC_HIGHLIGHT_SERVICE_URL || 'http://localhost:8080';

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${hlServiceUrl}/api/v1/highlights`);
      if (res.ok) {
        const data = await res.json();
        const completed = data.filter((j: HighlightJob) => j.status === 'completed');
        setJobs(completed);
      }
    } catch {
      // service unreachable
    }
    setLoading(false);
  };

  const submitVote = async (winner: 'a' | 'b') => {
    const winnerJob = winner === 'a' ? selectedA : selectedB;
    const loserJob = winner === 'a' ? selectedB : selectedA;

    if (winnerJob) {
      try {
        await fetch(`${hlServiceUrl}/api/v1/highlights/${winnerJob.job_id}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: 'good', notes: `Won comparison vs ${loserJob?.job_id}` }),
        });
      } catch {
        // feedback delivery failed
      }
    }
    if (loserJob) {
      try {
        await fetch(`${hlServiceUrl}/api/v1/highlights/${loserJob.job_id}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: 'bad', notes: `Lost comparison vs ${winnerJob?.job_id}` }),
        });
      } catch {
        // feedback delivery failed
      }
    }

    if (winner === 'a') setVoteA((v) => v + 1);
    else setVoteB((v) => v + 1);
  };

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/highlights"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          &larr; Highlights
        </Link>
        <span className="text-white/20">/</span>
        <h1 className="text-2xl font-bold">Quality Comparison</h1>
      </div>

      <p className="text-sm text-white/40">
        Compare highlight reels side-by-side and vote on which is better.
        Votes feed back into the training dataset for model improvement.
      </p>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-12 text-center space-y-3">
          <p className="text-white/30 text-sm">No completed highlights to compare.</p>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Loading...' : 'Load Highlights'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Selection */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/60">Highlight A</label>
              <select
                onChange={(e) => {
                  const job = jobs.find((j) => j.job_id === e.target.value);
                  setSelectedA(job || null);
                }}
                className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-sm"
              >
                <option value="">Select a highlight...</option>
                {jobs.map((j) => (
                  <option key={j.job_id} value={j.job_id}>
                    {j.job_id.slice(0, 8)} — {j.metadata?.model_used || 'unknown model'} (
                    {j.metadata?.game_detected || 'unknown game'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/60">Highlight B</label>
              <select
                onChange={(e) => {
                  const job = jobs.find((j) => j.job_id === e.target.value);
                  setSelectedB(job || null);
                }}
                className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-sm"
              >
                <option value="">Select a highlight...</option>
                {jobs.map((j) => (
                  <option key={j.job_id} value={j.job_id}>
                    {j.job_id.slice(0, 8)} — {j.metadata?.model_used || 'unknown model'} (
                    {j.metadata?.game_detected || 'unknown game'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side by Side Videos */}
          {selectedA && selectedB && (
            <>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Highlight A
                      <span className="ml-2 text-xs text-white/40 font-normal">
                        {selectedA.metadata?.model_used}
                      </span>
                    </h3>
                    {selectedA.metadata?.review_score && (
                      <span className="text-xs text-white/40">
                        AI Review: {selectedA.metadata.review_score}/100
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
                    {selectedA.highlight_url ? (
                      <video
                        src={selectedA.highlight_url}
                        controls
                        className="w-full aspect-video"
                      />
                    ) : (
                      <div className="aspect-video bg-surface-300 flex items-center justify-center">
                        <p className="text-xs text-white/20">Video unavailable</p>
                      </div>
                    )}
                  </div>
                  <MetadataBar job={selectedA} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Highlight B
                      <span className="ml-2 text-xs text-white/40 font-normal">
                        {selectedB.metadata?.model_used}
                      </span>
                    </h3>
                    {selectedB.metadata?.review_score && (
                      <span className="text-xs text-white/40">
                        AI Review: {selectedB.metadata.review_score}/100
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
                    {selectedB.highlight_url ? (
                      <video
                        src={selectedB.highlight_url}
                        controls
                        className="w-full aspect-video"
                      />
                    ) : (
                      <div className="aspect-video bg-surface-300 flex items-center justify-center">
                        <p className="text-xs text-white/20">Video unavailable</p>
                      </div>
                    )}
                  </div>
                  <MetadataBar job={selectedB} />
                </div>
              </div>

              {/* Voting */}
              <div className="flex items-center justify-center gap-6 rounded-xl border border-white/10 bg-surface-100 px-6 py-4">
                <button
                  onClick={() => submitVote('a')}
                  className="rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 px-6 py-2 text-sm font-medium hover:bg-brand-600/30 transition-colors"
                >
                  A is Better ({voteA})
                </button>
                <span className="text-white/20 text-sm">vs</span>
                <button
                  onClick={() => submitVote('b')}
                  className="rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 px-6 py-2 text-sm font-medium hover:bg-brand-600/30 transition-colors"
                >
                  B is Better ({voteB})
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MetadataBar({ job }: { job: HighlightJob }) {
  if (!job.metadata) return null;
  return (
    <div className="flex flex-wrap gap-3 text-xs text-white/40">
      <span>{Math.round(job.metadata.highlight_duration)}s highlight</span>
      <span>{job.metadata.segments_selected} segments</span>
      <span>{Math.round(job.metadata.processing_time_seconds)}s processing</span>
      {job.metadata.game_detected && <span>{job.metadata.game_detected}</span>}
    </div>
  );
}
