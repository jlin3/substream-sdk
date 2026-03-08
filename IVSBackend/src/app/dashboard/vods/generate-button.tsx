'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GenerateHighlightButton({
  streamId,
  orgSlug,
  hasRecording,
  existingHighlights,
}: {
  streamId: string;
  orgSlug: string;
  hasRecording: boolean;
  existingHighlights: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId }),
      });
      if (res.ok) {
        router.push('/dashboard/highlights');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (!hasRecording) {
    return (
      <span className="text-xs text-white/20">No recording available</span>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="rounded-lg bg-brand-600/20 text-brand-400 px-3 py-1.5 text-xs font-medium hover:bg-brand-600/30 transition-colors disabled:opacity-40"
    >
      {loading ? 'Generating...' : existingHighlights > 0 ? 'New Highlight' : 'Generate Highlight'}
    </button>
  );
}
