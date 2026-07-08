'use client';

/**
 * Self-driving mini platform demo for the hero.
 *
 * Looks like a product video but is a live-rendered Twitch-style UI:
 * browser chrome, auto-cycling featured channel, real looping footage,
 * drifting viewer count, auto-scrolling chat, and an "AI highlight
 * ready" toast — all pure CSS/JS. No mp4, no bandwidth.
 */

import { useEffect, useRef, useState } from 'react';
import { buildSimContent, embedUrl, hashString } from '@/lib/demo-gen/content';

const BRAND = '#2B7FFF';
const CONTENT = buildSimContent('substream-hero', 'shooter');
const CYCLE_MS = 9000;

interface Msg {
  id: number;
  user: string;
  text: string;
  hue: number;
}

function fmtViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export default function HeroPlatformDemo() {
  const [featured, setFeatured] = useState(0);
  const [viewers, setViewers] = useState(CONTENT.channels[0].viewers);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [toast, setToast] = useState(false);
  const idRef = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);

  const channel = CONTENT.channels[featured];

  // Auto-cycle featured channel
  useEffect(() => {
    const t = setInterval(() => {
      setFeatured((f) => (f + 1) % Math.min(4, CONTENT.channels.length));
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  // Drifting viewer count
  useEffect(() => {
    setViewers(channel.viewers);
    const t = setInterval(() => {
      setViewers((v) => Math.max(50, v + Math.floor(Math.random() * 31) - 14));
    }, 2500);
    return () => clearInterval(t);
  }, [channel]);

  // Auto chat
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const user = CONTENT.chatUsers[Math.floor(Math.random() * CONTENT.chatUsers.length)];
      const pool = [...CONTENT.chatLines, 'this is on the game site??', 'no OBS??', 'clip incoming'];
      idRef.current += 1;
      setMessages((prev) => [
        ...prev.slice(-14),
        { id: idRef.current, user, text: pool[Math.floor(Math.random() * pool.length)], hue: hashString(user) % 360 },
      ]);
      timeout = setTimeout(tick, 1200 + Math.random() * 2000);
    };
    timeout = setTimeout(tick, 400);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Highlight toast: shows a few seconds into each cycle
  useEffect(() => {
    setToast(false);
    const show = setTimeout(() => setToast(true), 4200);
    const hide = setTimeout(() => setToast(false), 8200);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [featured]);

  return (
    <div className="relative select-none" aria-label="Preview of your branded streaming platform">
      {/* Glow */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[32px] opacity-60"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(43,127,255,0.22), transparent 70%)' }}
      />
      <div className="rounded-2xl border border-white/12 bg-[#0e0e10] shadow-2xl shadow-black/60 overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02]">
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <div className="ml-2.5 flex-1 max-w-[180px] rounded-md bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/40 font-mono truncate">
            yourgame.com/live
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/45">
            Your brand
          </span>
        </div>

        <div className="grid grid-cols-[1fr_130px] sm:grid-cols-[1fr_150px]">
          {/* Player */}
          <div className="flex flex-col min-w-0 border-r border-white/10">
            <div className="relative aspect-video bg-black overflow-hidden">
              <iframe
                key={channel.videoId}
                src={embedUrl(channel.videoId)}
                title={channel.title}
                allow="autoplay; encrypted-media"
                className="absolute inset-0 h-full w-full pointer-events-none"
                tabIndex={-1}
              />
              <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-600">
                <span className="ss-pulse size-1 rounded-full bg-white" />
                LIVE
              </div>
              <div className="absolute bottom-2 left-2 rounded-full bg-black/55 backdrop-blur px-2 py-0.5 text-[9px] text-white/85 tabular-nums">
                {fmtViewers(viewers)} watching
              </div>

              {/* AI highlight toast */}
              <div
                className="absolute bottom-2 right-2 flex items-center gap-2 rounded-lg border border-[#2B7FFF]/40 bg-[#101321]/90 backdrop-blur px-2.5 py-1.5 shadow-lg shadow-black/40 transition-all duration-500"
                style={{
                  opacity: toast ? 1 : 0,
                  transform: toast ? 'translateY(0)' : 'translateY(10px)',
                }}
              >
                <span className="flex size-5 items-center justify-center rounded-md bg-[#2B7FFF]/20">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
                  </svg>
                </span>
                <span className="text-[9px] font-semibold text-white/90 leading-tight">
                  AI highlight ready
                  <span className="block font-normal text-white/45">Clipped 12s after the play</span>
                </span>
              </div>
            </div>

            {/* Channel bar */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: `hsl(${channel.avatarHue},55%,45%)` }}
              >
                {channel.streamer.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-white/90">{channel.streamer}</span>
                <span className="block truncate text-[9px] text-white/40">{channel.title}</span>
              </span>
              <span className="rounded-full px-2.5 py-1 text-[9px] font-semibold text-white" style={{ background: BRAND }}>
                Follow
              </span>
            </div>
          </div>

          {/* Chat rail */}
          <div className="flex flex-col bg-white/[0.01]">
            <div className="px-2.5 py-1.5 border-b border-white/10 text-[8px] font-semibold uppercase tracking-widest text-white/35">
              Stream chat
            </div>
            <div ref={chatRef} className="flex-1 overflow-hidden px-2 py-1.5 space-y-1 text-[9px] min-h-0 max-h-[210px]">
              {messages.map((m) => (
                <div key={m.id} className="leading-snug break-words">
                  <span className="font-semibold" style={{ color: `hsl(${m.hue},70%,68%)` }}>{m.user}</span>
                  <span className="text-white/60">: {m.text}</span>
                </div>
              ))}
            </div>
            <div className="p-1.5 border-t border-white/10">
              <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[8px] text-white/25">
                Send a message
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Channel cycle dots */}
      <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
        {CONTENT.channels.slice(0, 4).map((_, i) => (
          <button
            key={i}
            onClick={() => setFeatured(i)}
            className="h-1 rounded-full transition-all duration-500"
            style={{
              width: i === featured ? 20 : 8,
              background: i === featured ? BRAND : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
