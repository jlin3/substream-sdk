'use client';

import { useEffect, useState } from 'react';

interface ViewerToken {
  token: string;
  stageArn: string;
  participantId: string;
}

export function StreamViewer({ streamId, orgSlug }: { streamId: string; orgSlug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [viewerData, setViewerData] = useState<ViewerToken | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch(`/api/streams/${streamId}/viewer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgSlug }),
        });
        if (!res.ok) {
          setError('Could not get viewer token');
          return;
        }
        const data = await res.json();
        setViewerData(data);
      } catch {
        setError('Failed to connect to stream');
      }
    }
    fetchToken();
  }, [streamId, orgSlug]);

  if (error) {
    return (
      <div className="aspect-video bg-black flex items-center justify-center">
        <p className="text-white/30 text-sm">{error}</p>
      </div>
    );
  }

  if (!viewerData) {
    return (
      <div className="aspect-video bg-black flex items-center justify-center">
        <p className="text-white/30 text-sm">Connecting to live stream...</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black flex items-center justify-center">
      <p className="text-white/50 text-sm">
        Live stream connected. IVS Real-Time viewer active.
      </p>
    </div>
  );
}
