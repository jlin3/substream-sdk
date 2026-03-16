'use client';

import { useState } from 'react';

function parseYouTubeId(url: string): string | null {
  if (url.startsWith('youtube:')) return url.slice(8);
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

export function VideoPlayer({ url, autoPlay, poster }: { url: string; autoPlay?: boolean; poster?: string }) {
  const ytId = parseYouTubeId(url);

  if (ytId) return <YouTubeFacade videoId={ytId} autoPlay={autoPlay} />;

  return (
    <div className="aspect-video bg-black">
      <video src={url} controls autoPlay={autoPlay} poster={poster} className="w-full h-full" />
    </div>
  );
}

function YouTubeFacade({ videoId, autoPlay }: { videoId: string; autoPlay?: boolean }) {
  const [activated, setActivated] = useState(false);
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  if (activated) {
    return (
      <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title="Video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        ></iframe>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      className="relative w-full block cursor-pointer group"
      style={{ paddingBottom: '56.25%' }}
      aria-label="Play video"
    >
      <img
        src={thumbUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading={autoPlay ? 'eager' : 'lazy'}
      />
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 68 48" width="68" height="48" className="drop-shadow-lg">
          <path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#f00" />
          <path d="M45 24L27 14v20" fill="#fff" />
        </svg>
      </div>
    </button>
  );
}
