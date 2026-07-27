'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Shared header and footer for the public marketing surfaces.
 *
 * Every page used to carry its own copy of this nav, which is how
 * /cost-calculator ended up reachable only by typing the URL and how the two
 * demo pages ended up with labels ("Product", "SDK Demo") that don't say how
 * they differ. One component means a new page can only be unreachable on
 * purpose.
 */

const BRAND = '#2B7FFF';

const BTN_PRIMARY =
  'inline-flex items-center justify-center h-11 rounded-full bg-[#2B7FFF] px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_12px_rgba(43,127,255,0.4)] border border-white/[0.12] hover:bg-[#2B7FFF]/85 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_6px_20px_rgba(43,127,255,0.5)] active:scale-95 transition-all ease-out';

const NAV_LINK = 'text-sm text-white/60 transition-colors hover:text-white';
const NAV_LINK_ACTIVE = 'text-sm text-white transition-colors';

export function SubstreamLogo({ className }: { className?: string }) {
  return (
    <svg
      width="42"
      height="24"
      viewBox="0 0 42 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}>
      <g clipPath="url(#ss_clip_chrome)">
        <path
          d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z"
          fill={BRAND}
        />
        <path
          d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z"
          fill={BRAND}
        />
      </g>
      <defs>
        <clipPath id="ss_clip_chrome">
          <rect width="42" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

type NavItem = { href: string; label: string; blurb: string };

/**
 * Grouped rather than listed flat because "Product" and "SDK Demo" side by side
 * told a visitor nothing about which one to click. The blurbs are the whole
 * point of the dropdown.
 */
const DEMOS: readonly NavItem[] = [
  {
    href: '/demo',
    label: 'Live SDK demo',
    blurb: 'Press start and stream a real browser game over WebRTC',
  },
  {
    href: '/product-demo',
    label: 'Product tour',
    blurb: 'The whole platform end to end, with video walkthroughs',
  },
];

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [demosOpen, setDemosOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const demosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDemosOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!demosOpen && !mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDemosOpen(false);
        setMobileOpen(false);
      }
    }
    function onPointerDown(e: MouseEvent) {
      if (demosRef.current && !demosRef.current.contains(e.target as Node)) {
        setDemosOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [demosOpen, mobileOpen]);

  const onDemo = DEMOS.some((d) => d.href === pathname);

  function linkClass(href: string) {
    return pathname === href ? NAV_LINK_ACTIVE : NAV_LINK;
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#18181B]/85 backdrop-blur-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <SubstreamLogo className="h-5 w-auto" />
          <span className="text-lg font-semibold">Substream</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-4 md:flex">
          <div className="relative" ref={demosRef}>
            <button
              type="button"
              onClick={() => setDemosOpen((v) => !v)}
              aria-expanded={demosOpen}
              aria-haspopup="true"
              className={`flex items-center gap-1.5 ${onDemo ? NAV_LINK_ACTIVE : NAV_LINK}`}>
              Demos
              <ChevronDown open={demosOpen} />
            </button>
            {demosOpen ? (
              <div className="absolute left-1/2 top-full z-40 mt-3 w-[19rem] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#1D1D21]/95 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-lg">
                {DEMOS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-4 py-3.5 transition-colors hover:bg-white/[0.05]">
                    <span className="block text-sm font-medium text-white">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
                      {item.blurb}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <Link href="/cost-calculator" className={linkClass('/cost-calculator')}>
            Pricing
          </Link>
          <Link href="/docs" className={linkClass('/docs')}>
            Docs
          </Link>
          <Link href="/api/auth/demo-auto" className={NAV_LINK}>
            Dashboard
          </Link>
          <Link href="/try" className={`${BTN_PRIMARY} h-9`}>
            See your platform
          </Link>
        </div>

        {/* Mobile trigger. The CTA lives in the panel instead of the bar: at
            390px a button beside the wordmark overlaps it. */}
        <div className="flex items-center md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/5 hover:text-white">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              {mobileOpen ? (
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M2 4.5H14M2 11.5H14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen ? (
        <div id="site-mobile-nav" className="border-t border-white/10 px-6 py-4 md:hidden">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Demos</p>
          <div className="mt-2 space-y-2">
            {DEMOS.map((item) => (
              <Link key={item.href} href={item.href} className="block py-1">
                <span className="block text-sm text-white/85">{item.label}</span>
                <span className="block text-xs leading-relaxed text-white/40">{item.blurb}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <Link href="/cost-calculator" className="block text-sm text-white/85">
              Pricing
            </Link>
            <Link href="/docs" className="block text-sm text-white/85">
              Docs
            </Link>
            <Link href="/api/auth/demo-auto" className="block text-sm text-white/85">
              Dashboard
            </Link>
          </div>
          <Link href="/try" className={`${BTN_PRIMARY} mt-5 h-10 w-full`}>
            See your platform
          </Link>
        </div>
      ) : null}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5 text-sm text-white/40">
          <SubstreamLogo className="h-4 w-auto opacity-70" />
          Substream — live streaming infrastructure for games
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/demo" className="text-white/40 transition-colors hover:text-white">
            Live SDK demo
          </Link>
          <Link href="/product-demo" className="text-white/40 transition-colors hover:text-white">
            Product tour
          </Link>
          <Link href="/cost-calculator" className="text-white/40 transition-colors hover:text-white">
            Pricing
          </Link>
          <Link href="/docs" className="text-white/40 transition-colors hover:text-white">
            Docs
          </Link>
          <Link
            href="https://github.com/jlin3/substream-sdk"
            className="text-white/40 transition-colors hover:text-white">
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
