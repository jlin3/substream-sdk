'use client';

/**
 * Internal 1200x630 stage used by scripts/generate-og-assets.mjs to
 * record the animated link-preview (GIF/MP4) and og:image PNG.
 * Disallowed in robots.ts; not linked from anywhere.
 */

import HeroPlatformDemo from '@/components/HeroPlatformDemo';
import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });
const BRAND = '#2B7FFF';

function SubstreamLogo({ className }: { className?: string }) {
  return (
    <svg width="42" height="24" viewBox="0 0 42 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g clipPath="url(#ss_clip_og)">
        <path d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z" fill={BRAND} />
        <path d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z" fill={BRAND} />
      </g>
      <defs><clipPath id="ss_clip_og"><rect width="42" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}

export default function OgCapturePage() {
  return (
    <div
      className={`${geist.className} relative flex h-screen w-screen items-center overflow-hidden bg-[#18181B] text-[#FAFAFA] tracking-tight`}
    >
      <style>{`
        @keyframes ssPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.35; transform: scale(0.8);} }
        .ss-pulse { animation: ssPulse 1.4s ease-in-out infinite; }
        /* Hide the Next.js dev-tools badge when recording in dev mode */
        nextjs-portal { display: none !important; }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(110% 120% at 85% 30%, rgba(43,127,255,0.28), transparent 55%)' }}
      />
      <div className="relative z-10 grid w-full grid-cols-[1fr_560px] items-center gap-10 px-14">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <SubstreamLogo className="h-7 w-auto" />
            <span className="text-2xl font-semibold">Substream</span>
          </div>
          <h1 className="text-[44px] font-medium tracking-tighter leading-[1.06]">
            Your own private Twitch
            <br />
            <span className="text-[#2B7FFF]">for your community.</span>
          </h1>
          <p className="max-w-md text-lg text-white/55 leading-relaxed">
            Players stream from inside your game to your own site.
            You keep the data, the revenue, and the audience.
          </p>
          <div className="flex items-center gap-2.5 text-sm text-white/45">
            <span className="ss-pulse size-2 rounded-full bg-[#2B7FFF]" />
            AI highlights included · 5-line SDK · sub-500ms
          </div>
        </div>
        <div className="scale-[1.02]">
          <HeroPlatformDemo />
        </div>
      </div>
    </div>
  );
}
