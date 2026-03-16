'use client';

function parseYouTubeId(url: string): string | null {
  if (url.startsWith('youtube:')) return url.slice(8);
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

export function VideoPlayer({ url, autoPlay, poster }: { url: string; autoPlay?: boolean; poster?: string }) {
  const ytId = parseYouTubeId(url);
  if (ytId) {
    return (
      <div className="aspect-video bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=${autoPlay ? 1 : 0}&rel=0&modestbranding=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }
  return (
    <div className="aspect-video bg-black">
      <video src={url} controls autoPlay={autoPlay} poster={poster} className="w-full h-full" />
    </div>
  );
}
