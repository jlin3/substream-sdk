'use client';

/**
 * Top navigation shared by the game-studio home and /sports.
 * The audience switch is the "tab": one site, two front doors.
 */

import Link from 'next/link';
import { BTN_PRIMARY, SubstreamLogo } from './shared';
import { DEMO_BOOKING_URL } from '@/lib/sports';

export type Audience = 'games' | 'sports';

const AUDIENCES: { key: Audience; label: string; href: string }[] = [
  { key: 'games', label: 'Game studios', href: '/' },
  { key: 'sports', label: 'Sports & live events', href: '/sports' },
];

// Nav CTA: same button, tighter on phones so it never wraps
const NAV_CTA = BTN_PRIMARY.replace('px-6', 'px-4 sm:px-6') + ' shrink-0 whitespace-nowrap';

function AudienceTabs({ active, className = '' }: { active: Audience; className?: string }) {
  return (
    <div
      className={`items-center rounded-full border border-white/10 bg-white/[0.03] p-1 ${className}`}
      role="group"
      aria-label="Who Substream is for"
    >
      {AUDIENCES.map((a) => {
        const on = a.key === active;
        return (
          <Link
            key={a.key}
            href={a.href}
            aria-current={on ? 'page' : undefined}
            className={`flex-1 inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B7FFF] ${
              on ? 'bg-white/[0.12] text-white font-medium' : 'text-white/60 hover:text-white'
            }`}
          >
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function SiteNav({ active }: { active: Audience }) {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-30 border-b border-white/10 bg-[#18181B]/85 backdrop-blur-lg"
    >
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 md:py-3.5">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Substream home">
            <SubstreamLogo className="h-5 w-auto" />
            <span className="text-lg font-semibold">Substream</span>
          </Link>
          <AudienceTabs active={active} className="hidden md:inline-flex" />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/docs" className="hidden min-[380px]:block text-sm text-white/60 hover:text-white transition-colors">Docs</Link>
          <Link href="/api/auth/demo-auto" className="hidden sm:block text-sm text-white/60 hover:text-white transition-colors">Dashboard</Link>
          {active === 'sports' ? (
            <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer" className={NAV_CTA}>
              Book a demo
            </a>
          ) : (
            <Link href="/try" className={NAV_CTA}>See your platform</Link>
          )}
        </div>
      </div>
      {/* Mobile: the audience switch gets its own row so nothing is hidden behind a menu */}
      <div className="px-4 pb-3 md:hidden">
        <AudienceTabs active={active} className="flex w-full" />
      </div>
    </nav>
  );
}
