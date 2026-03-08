'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function HighlightPoller({
  highlightId,
  orgSlug,
  initialStatus,
}: {
  highlightId: string;
  orgSlug: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status !== 'PROCESSING' && status !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgSlug}/highlights/${highlightId}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.highlight.status);
          if (data.highlight.status === 'COMPLETED' || data.highlight.status === 'FAILED') {
            clearInterval(interval);
            router.refresh();
          }
        }
      } catch {
        // Retry on next interval
      }
      setProgress((p) => Math.min(p + 5, 90));
    }, 5000);

    return () => clearInterval(interval);
  }, [highlightId, orgSlug, status, router]);

  return (
    <div className="aspect-video bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto">
          <div
            className="absolute inset-y-0 left-0 bg-brand-500 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/50 text-sm">
          {status === 'PENDING' ? 'Queued for processing...' : 'Generating highlight reel...'}
        </p>
        <p className="text-xs text-white/20">
          This may take a few minutes. The page will update automatically.
        </p>
      </div>
    </div>
  );
}
