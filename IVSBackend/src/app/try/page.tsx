'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Geist } from 'next/font/google';
import { CONTENT_TYPES, GENRES_BY_VERTICAL, type Vertical } from '@/lib/demo-gen/content';

const geist = Geist({ subsets: ['latin'] });

const PALETTE = ['#2B7FFF', '#9146FF', '#FF4655', '#00C48C', '#FF8A00', '#E91E63', '#00B8D9'];

const BTN_PRIMARY =
  'inline-flex items-center justify-center h-11 rounded-full px-6 text-sm font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)] border border-white/[0.12] active:scale-95 transition-all ease-out disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_OUTLINE =
  'inline-flex items-center justify-center h-11 rounded-full border border-white/15 px-6 text-sm font-medium text-white/90 hover:bg-white/5 active:scale-95 transition-all ease-out disabled:opacity-40';
const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[#2B7FFF]/60 focus:outline-none transition-colors';

type Step = 'contact' | 'brand' | 'experience' | 'building';

interface WizardState {
  name: string;
  email: string;
  role: string;
  streamingGoals: string;
  websiteUrl: string;
  brandName: string;
  logoUrl: string;
  accentColor: string;
  vertical: Vertical;
  template: 'DESTINATION' | 'FEED' | 'EVENT';
  genre: string;
  platform: string;
  communitySize: string;
}

// Which experience templates make sense per content type
const TEMPLATES_BY_VERTICAL: Record<Vertical, ('DESTINATION' | 'EVENT' | 'FEED')[]> = {
  gaming: ['DESTINATION', 'FEED'],
  music: ['EVENT', 'FEED'],
  sports: ['EVENT', 'FEED'],
};

const TEMPLATE_COPY: Record<'DESTINATION' | 'EVENT' | 'FEED', { title: string; body: string; art: 'destination' | 'feed' | 'event' }> = {
  DESTINATION: {
    title: 'Twitch-style destination',
    body: 'A full live hub on your domain — browse page, channel list, player, real-time chat, clips.',
    art: 'destination',
  },
  EVENT: {
    title: 'Event hub',
    body: 'Broadcast-style home with a featured live event, schedule, and every stage or venue live.',
    art: 'event',
  },
  FEED: {
    title: 'Clips feed',
    body: 'A scrolling social feed of auto-generated highlight clips from your community.',
    art: 'feed',
  },
};

const ROLES = ['Founder / CEO', 'Product', 'Engineering', 'Marketing / Community', 'Other'];

const BUILD_STEPS = [
  'Pulling your brand…',
  'Provisioning streaming infrastructure…',
  'Assembling live channels…',
  'Wiring up chat and clips…',
  'Polishing your experience…',
];

export default function TryPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('contact');
  const [extracting, setExtracting] = useState(false);
  const [buildStep, setBuildStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState<WizardState>({
    name: '',
    email: '',
    role: '',
    streamingGoals: '',
    websiteUrl: '',
    brandName: '',
    logoUrl: '',
    accentColor: '#2B7FFF',
    vertical: 'gaming',
    template: 'DESTINATION',
    genre: 'shooter',
    platform: 'web',
    communitySize: '10k-100k',
  });

  const set = (patch: Partial<WizardState>) => setS((prev) => ({ ...prev, ...patch }));
  const accent = s.accentColor;

  function setVertical(vertical: Vertical) {
    set({
      vertical,
      genre: GENRES_BY_VERTICAL[vertical][0].id,
      template: TEMPLATES_BY_VERTICAL[vertical][0],
    });
  }

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExtracting(true);
    setStep('brand');
    try {
      const res = await fetch('/api/demo-sites/extract-branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: s.websiteUrl }),
      });
      if (res.ok) {
        const brand = await res.json();
        set({
          brandName: brand.brandName || s.brandName,
          logoUrl: brand.logoUrl || '',
          accentColor: brand.accentColor || s.accentColor,
          websiteUrl: brand.websiteUrl || s.websiteUrl,
        });
      }
    } catch {
      // extraction is best-effort; user corrects manually
    } finally {
      setExtracting(false);
    }
  }

  async function generate() {
    setError(null);
    setStep('building');
    setBuildStep(0);

    // stagger the build steps for a satisfying reveal while the API works
    const ticker = setInterval(() => {
      setBuildStep((b) => Math.min(b + 1, BUILD_STEPS.length - 1));
    }, 900);

    try {
      const res = await fetch('/api/demo-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: s.name,
          email: s.email,
          websiteUrl: s.websiteUrl,
          brandName: s.brandName,
          logoUrl: s.logoUrl || undefined,
          accentColor: s.accentColor,
          template: s.template,
          genre: s.genre,
          survey: {
            vertical: s.vertical,
            platform: s.platform,
            communitySize: s.communitySize,
            template: s.template,
            genre: s.genre,
            role: s.role || undefined,
            streamingGoals: s.streamingGoals || undefined,
          },
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const { url } = await res.json();
      // let the animation land before redirecting
      setTimeout(() => {
        clearInterval(ticker);
        router.push(url);
      }, Math.max(0, (BUILD_STEPS.length - 1) * 900 + 600));
    } catch (err) {
      clearInterval(ticker);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('experience');
    }
  }

  const stepIndex = { contact: 0, brand: 1, experience: 2, building: 3 }[step];

  return (
    <div className={`${geist.className} min-h-screen bg-[#18181B] text-[#FAFAFA] tracking-tight`}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/" className="text-lg font-semibold">
          <span style={{ color: '#2B7FFF' }}>sub</span>stream
        </Link>
        <Link href="/demo" className="text-sm text-white/60 hover:text-white transition-colors">
          SDK demo instead →
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-14">
        {/* Progress */}
        {step !== 'building' && (
          <div className="flex items-center gap-2 mb-10">
            {['Your details', 'Your brand', 'Your experience'].map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold border ${
                    i <= stepIndex ? 'text-white border-transparent' : 'text-white/30 border-white/15'
                  }`}
                  style={i <= stepIndex ? { background: accent } : undefined}
                >
                  {i + 1}
                </span>
                <span className={`text-xs ${i <= stepIndex ? 'text-white/80' : 'text-white/30'} hidden sm:block`}>{label}</span>
                {i < 2 && <span className="h-px flex-1 bg-white/10" />}
              </div>
            ))}
          </div>
        )}

        {/* STEP 1: contact */}
        {step === 'contact' && (
          <form onSubmit={submitContact} className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-medium tracking-tighter">
                See your own streaming platform.
              </h1>
              <p className="text-white/55 leading-relaxed">
                Enter your website and we&apos;ll spin up a fully branded live-streaming experience for your
                games, events, or shows — your logo, your colors, your community. Takes about a minute.
              </p>
            </div>
            <div className="space-y-3">
              <input required value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your name" className={INPUT} autoFocus />
              <input required type="email" value={s.email} onChange={(e) => set({ email: e.target.value })} placeholder="Work email" className={INPUT} />
              <input required value={s.websiteUrl} onChange={(e) => set({ websiteUrl: e.target.value })} placeholder="Your company website (e.g. supercell.com)" className={INPUT} />
              <div className="space-y-1.5">
                <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">Your role</span>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <Pill key={r} active={s.role === r} accent={accent} onClick={() => set({ role: r })}>{r}</Pill>
                  ))}
                </div>
              </div>
              <textarea
                value={s.streamingGoals}
                onChange={(e) => set({ streamingGoals: e.target.value })}
                placeholder="What do you want streaming to do for your game? (optional — e.g. player retention, community content, monetization)"
                rows={3}
                className={INPUT + ' resize-none'}
              />
            </div>
            <button type="submit" className={BTN_PRIMARY} style={{ background: '#2B7FFF' }}>
              Pull my brand →
            </button>
          </form>
        )}

        {/* STEP 2: brand confirm */}
        {step === 'brand' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-medium tracking-tighter">
                {extracting ? 'Reading your site…' : 'Does this look right?'}
              </h1>
              <p className="text-white/55">We pulled this from your website. Fix anything that&apos;s off — it takes two clicks.</p>
            </div>

            {extracting ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 flex items-center justify-center gap-3 text-white/50">
                <span className="size-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                Extracting logo, name, and colors…
              </div>
            ) : (
              <>
                {/* Live preview */}
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/10" style={{ background: `linear-gradient(90deg, ${accent}22, transparent)` }}>
                    {s.logoUrl ? (
                      <img src={s.logoUrl} alt="logo" className="size-8 rounded-lg object-contain bg-white/10" onError={() => set({ logoUrl: '' })} />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: accent }}>
                        {(s.brandName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="font-semibold">{s.brandName || 'Your brand'}</span>
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: accent }}>
                      <span className="size-1.5 rounded-full bg-white animate-pulse" /> LIVE
                    </span>
                  </div>
                  <div className="px-5 py-4 text-sm text-white/40 bg-white/[0.02]">
                    Preview of your branded player header
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">Company / studio name</span>
                    <input value={s.brandName} onChange={(e) => set({ brandName: e.target.value })} className={INPUT} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">Logo URL (optional)</span>
                    <input value={s.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://…/logo.png" className={INPUT} />
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">Accent color</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => set({ accentColor: c })}
                          className={`size-9 rounded-full border-2 transition-transform hover:scale-110 ${accent.toLowerCase() === c.toLowerCase() ? 'border-white' : 'border-transparent'}`}
                          style={{ background: c }}
                          aria-label={`Accent ${c}`}
                        />
                      ))}
                      <input
                        type="color"
                        value={accent}
                        onChange={(e) => set({ accentColor: e.target.value })}
                        className="size-9 rounded-full border border-white/15 bg-transparent cursor-pointer"
                        aria-label="Custom accent color"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setStep('contact')} className={BTN_OUTLINE}>← Back</button>
                  <button onClick={() => setStep('experience')} disabled={!s.brandName} className={BTN_PRIMARY} style={{ background: accent }}>
                    Looks right →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3: experience survey */}
        {step === 'experience' && (
          <div className="space-y-7">
            <div className="space-y-3">
              <h1 className="text-3xl font-medium tracking-tighter">Design your experience.</h1>
              <p className="text-white/55">What should streaming look like on {s.brandName}&apos;s site?</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">What&apos;s your content?</span>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((c) => (
                  <Pill key={c.id} active={s.vertical === c.id} accent={accent} onClick={() => setVertical(c.id)}>{c.label}</Pill>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">Experience style</span>
              <div className="grid sm:grid-cols-2 gap-3">
                {TEMPLATES_BY_VERTICAL[s.vertical].map((t) => (
                  <TemplateCard
                    key={t}
                    active={s.template === t}
                    accent={accent}
                    onClick={() => set({ template: t })}
                    title={TEMPLATE_COPY[t].title}
                    body={TEMPLATE_COPY[t].body}
                    art={TEMPLATE_COPY[t].art}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">
                {s.vertical === 'gaming' ? 'What kind of games do you make?' : s.vertical === 'music' ? 'What kind of shows do you put on?' : 'What do you broadcast?'}
              </span>
              <div className="flex flex-wrap gap-2">
                {GENRES_BY_VERTICAL[s.vertical].map((g) => (
                  <Pill key={g.id} active={s.genre === g.id} accent={accent} onClick={() => set({ genre: g.id })}>{g.label}</Pill>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">
                {s.vertical === 'gaming' ? 'Where do your games run?' : 'Where would live video be embedded?'}
              </span>
              <div className="flex flex-wrap gap-2">
                {(s.vertical === 'gaming'
                  ? [
                      ['web', 'Web / Browser'],
                      ['unity', 'Unity'],
                      ['ios', 'iOS'],
                      ['multiple', 'Multiple platforms'],
                    ]
                  : [
                      ['web', 'Our website'],
                      ['ios', 'Our mobile app'],
                      ['multiple', 'Both / everywhere'],
                    ]
                ).map(([id, label]) => (
                  <Pill key={id} active={s.platform === id} accent={accent} onClick={() => set({ platform: id })}>{label}</Pill>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">How big is your community?</span>
              <div className="flex flex-wrap gap-2">
                {['<10k', '10k-100k', '100k-1M', '1M+'].map((size) => (
                  <Pill key={size} active={s.communitySize === size} accent={accent} onClick={() => set({ communitySize: size })}>{size}</Pill>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex items-center gap-3">
              <button onClick={() => setStep('brand')} className={BTN_OUTLINE}>← Back</button>
              <button onClick={generate} className={BTN_PRIMARY} style={{ background: accent }}>
                Build my platform →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: building */}
        {step === 'building' && (
          <div className="py-16 text-center space-y-8">
            <div className="mx-auto size-16 rounded-2xl flex items-center justify-center" style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}>
              <span className="size-7 rounded-full border-[3px] animate-spin" style={{ borderColor: `${accent}33`, borderTopColor: accent }} />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-medium tracking-tighter">Building {s.brandName} Live…</h1>
              <p className="text-white/50">This is exactly how fast we can spin it up for real.</p>
            </div>
            <div className="max-w-sm mx-auto space-y-2.5 text-left">
              {BUILD_STEPS.map((label, i) => (
                <div key={label} className={`flex items-center gap-3 text-sm transition-opacity duration-500 ${i <= buildStep ? 'opacity-100' : 'opacity-25'}`}>
                  {i < buildStep ? (
                    <span className="flex size-5 items-center justify-center rounded-full text-[10px] text-white" style={{ background: accent }}>✓</span>
                  ) : i === buildStep ? (
                    <span className="size-5 rounded-full border-2 animate-spin" style={{ borderColor: `${accent}33`, borderTopColor: accent }} />
                  ) : (
                    <span className="size-5 rounded-full border border-white/15" />
                  )}
                  <span className={i <= buildStep ? 'text-white/85' : 'text-white/40'}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Pill({ active, accent, onClick, children }: { active: boolean; accent: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-all ${active ? 'text-white border-transparent' : 'text-white/60 border-white/15 hover:bg-white/5'}`}
      style={active ? { background: accent } : undefined}
    >
      {children}
    </button>
  );
}

function TemplateCard({ active, accent, onClick, title, body, art }: { active: boolean; accent: string; onClick: () => void; title: string; body: string; art: 'destination' | 'feed' | 'event' }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 space-y-3 transition-all ${active ? 'bg-white/[0.05]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
      style={active ? { borderColor: accent } : undefined}
    >
      {/* Miniature layout sketch */}
      <div className="rounded-lg border border-white/10 bg-[#0e0e10] p-2 h-24 flex gap-1.5">
        {art === 'destination' ? (
          <>
            <div className="w-1/5 space-y-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-3 rounded-sm" style={{ background: i === 0 ? accent : 'rgba(255,255,255,0.08)' }} />
              ))}
            </div>
            <div className="flex-1 rounded-sm" style={{ background: `${accent}33` }} />
            <div className="w-1/5 space-y-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-2 rounded-sm bg-white/[0.08]" style={{ width: `${100 - (i % 3) * 18}%` }} />
              ))}
            </div>
          </>
        ) : art === 'event' ? (
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-10 rounded-sm relative overflow-hidden" style={{ background: `${accent}33` }}>
              <div className="absolute bottom-1 left-1 h-1.5 w-10 rounded-full" style={{ background: accent }} />
            </div>
            <div className="flex-1 flex gap-1.5">
              <div className="w-2/5 space-y-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-2 rounded-sm flex items-center gap-0.5 px-0.5 bg-white/[0.06]">
                    <span className="block h-1 w-2 rounded-full" style={{ background: i === 0 ? accent : 'rgba(255,255,255,0.15)' }} />
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-sm bg-white/[0.08]" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-3/4 h-6 rounded-sm flex gap-1 p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="w-8 rounded-[2px]" style={{ background: i === 0 ? `${accent}66` : 'rgba(255,255,255,0.1)' }} />
                <div className="flex-1 space-y-0.5">
                  <div className="h-1 w-3/4 rounded-full bg-white/15" />
                  <div className="h-1 w-1/2 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-white/45 leading-relaxed mt-1">{body}</p>
      </div>
    </button>
  );
}
