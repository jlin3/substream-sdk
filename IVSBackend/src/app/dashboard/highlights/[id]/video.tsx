'use client';

export function HighlightVideo({ url }: { url: string }) {
  return (
    <div className="aspect-video bg-black">
      <video
        src={url}
        controls
        autoPlay
        className="w-full h-full"
      />
    </div>
  );
}
