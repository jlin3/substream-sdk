'use client';

import { VideoPlayer } from '@/components/VideoPlayer';

export function HighlightVideo({ url }: { url: string }) {
  return <VideoPlayer url={url} />;
}
