'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const IvsRealTimeViewer = dynamic(
  () => import('@/components/IvsRealTimeViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-video bg-black flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading IVS viewer...</p>
      </div>
    ),
  },
);

interface ViewerToken {
  subscribeToken: string;
  stageArn: string;
  participantId: string;
}

export function StreamViewer({ streamId }: { streamId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [viewerData, setViewerData] = useState<ViewerToken | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch(`/api/streams/${streamId}/viewer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentUserId: 'dashboard-viewer' }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Failed to get viewer token (HTTP ${res.status})`);
          return;
        }
        const data = await res.json();
        setViewerData(data);
      } catch {
        setError('Failed to connect to stream');
      }
    }
    fetchToken();
  }, [streamId]);

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
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/30 text-sm">Connecting to live stream...</p>
        </div>
      </div>
    );
  }

  return (
    <IvsRealTimeViewer
      token={viewerData.subscribeToken}
      stageArn={viewerData.stageArn}
      participantId={viewerData.participantId}
    />
  );
}
