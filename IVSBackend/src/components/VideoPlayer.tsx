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
      <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1${autoPlay ? '&autoplay=1&mute=1' : ''}`}
          title="Video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        ></iframe>
      </div>
    );
  }
  return (
    <div className="aspect-video bg-black">
      <video src={url} controls autoPlay={autoPlay} poster={poster} className="w-full h-full" />
    </div>
  );
}
