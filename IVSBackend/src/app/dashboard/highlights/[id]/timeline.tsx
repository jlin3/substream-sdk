'use client';

import { useState } from 'react';

interface Segment {
  start: number;
  end: number;
  duration: number;
  score: number;
  label: string;
  selected: boolean;
}

export function SegmentTimeline({
  segments,
  sourceDuration,
}: {
  segments: Segment[];
  sourceDuration: number;
}) {
  const [hovered, setHovered] = useState<Segment | null>(null);
  const maxScore = Math.max(...segments.map((s) => s.score), 1);

  function scoreColor(score: number): string {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#3b82f6';
    if (score >= 30) return '#f59e0b';
    return '#6b7280';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>0:00</span>
        <span>{fmtTs(sourceDuration)}</span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-10 bg-white/5 rounded-lg overflow-hidden">
        {segments.map((seg, i) => {
          const left = (seg.start / sourceDuration) * 100;
          const width = Math.max((seg.duration / sourceDuration) * 100, 0.3);
          const opacity = seg.selected ? 1 : 0.35;
          return (
            <div
              key={i}
              className="absolute top-0 h-full cursor-pointer transition-all duration-150 hover:brightness-125"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: scoreColor(seg.score),
                opacity,
                borderRight: '1px solid rgba(0,0,0,0.3)',
              }}
              onMouseEnter={() => setHovered(seg)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Playhead-style labels for selected segments */}
        {segments
          .filter((s) => s.selected)
          .map((seg, i) => {
            const center = ((seg.start + seg.end) / 2 / sourceDuration) * 100;
            return (
              <div
                key={`marker-${i}`}
                className="absolute top-0 h-full flex items-start justify-center pointer-events-none"
                style={{ left: `${center}%` }}
              >
                <div className="w-0.5 h-1.5 bg-white/60 rounded-full mt-0.5" />
              </div>
            );
          })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-white/30">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
          High (70+)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
          Medium (50-69)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
          Low (30-49)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm opacity-35" style={{ backgroundColor: '#6b7280' }} />
          Rejected
        </span>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="rounded-lg border border-white/10 bg-surface-200 px-4 py-3 flex items-start gap-3 animate-in fade-in duration-150">
          <div
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: scoreColor(hovered.score) }}
          >
            {hovered.score}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{hovered.label}</p>
            <p className="text-xs text-white/40 mt-0.5">
              {fmtTs(hovered.start)} &mdash; {fmtTs(hovered.end)}
              &nbsp;&middot;&nbsp;{hovered.duration.toFixed(1)}s
              &nbsp;&middot;&nbsp;
              <span className={hovered.selected ? 'text-success' : 'text-white/25'}>
                {hovered.selected ? 'Selected' : 'Rejected'}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
