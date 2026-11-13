'use client';

/**
 * Primitives shared by the marketing pages (game-studio home and
 * /sports) so both read as one site: brand mark, buttons, scroll
 * reveal, count-up metric.
 */

import { useEffect, useId, useRef, useState } from 'react';

export const BRAND = '#2B7FFF';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_12px_rgba(43,127,255,0.4)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_6px_20px_rgba(43,127,255,0.5)] active:scale-95 transition-all ease-out';
export const BTN_OUTLINE =
  'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out';

// Substream wave mark (matches substream.ai navbar logo)
export function SubstreamLogo({ className }: { className?: string }) {
  const clipId = useId();
  return (
    <svg width="42" height="24" viewBox="0 0 42 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <g clipPath={`url(#${clipId})`}>
        <path d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z" fill={BRAND} />
        <path d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z" fill={BRAND} />
      </g>
      <defs><clipPath id={clipId}><rect width="42" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}

// ============================================================
// Scroll reveal
// ============================================================

export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`ss-reveal ${className}`}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// Count-up metric
// ============================================================

export function CountUp({ target, prefix, suffix }: { target: number; prefix: string; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      io.disconnect();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setValue(target);
        return;
      }
      const duration = 1200;
      const t0 = performance.now();
      const frame = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{value}{suffix}
    </span>
  );
}
