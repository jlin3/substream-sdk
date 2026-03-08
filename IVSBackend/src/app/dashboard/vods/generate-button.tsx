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
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId }),
      });
      if (res.ok) {
        router.push('/dashboard/highlights');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to generate');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full rounded-lg bg-brand-600/20 text-brand-400 px-3 py-2 text-xs font-medium hover:bg-brand-600/30 transition-colors disabled:opacity-40"
      >
        {loading
          ? 'Generating...'
          : existingHighlights > 0
            ? 'Generate New Highlight'
            : 'Generate Highlight'}
      </button>
      {!hasRecording && (
        <p className="text-xs text-white/20 text-center">Recording still processing</p>
      )}
      {error && <p className="text-xs text-danger text-center">{error}</p>}
    </div>
  );
}
