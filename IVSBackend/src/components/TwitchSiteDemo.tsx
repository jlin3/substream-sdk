'use client';

/**
 * Compact interactive Twitch-style demo for the landing page.
 *
 * A browser frame at "yourgame.com/live" with a live-playing featured
 * channel (looping muted YouTube footage from the demo-gen pool), a
 * simulated real-time chat, and a channel rail — the same experience
 * that /d/[slug] generates per-brand, condensed into one section.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSimContent,
  embedUrl,
  hashString,
  type SimChannel,
} from '@/lib/demo-gen/content';

const BRAND = '#2B7FFF';

// Deterministic content: same footage/personas on every visit.
const CONTENT = buildSimContent('substream-landing', 'shooter');

interface ChatMsg {
  id: number;
  user: string;
  text: string;
  hue: number;
  self?: boolean;
}

function userHue(user: string): number {
  return hashString(user) % 360;
}

function fmtViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function useDriftingCount(base: number) {
  const [count, setCount] = useState(base);
  useEffect(() => {
    setCount(base);
    const t = setInterval(() => {
      setCount((c) => Math.max(10, c + Math.floor(Math.random() * 41) - 18));
    }, 3000);
    return () => clearInterval(t);
  }, [base]);
  return count;
}

function useSimChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const idRef = useRef(0);

  const push = useCallback((user: string, text: string, self = false) => {
    idRef.current += 1;
    setMessages((prev) => [
      ...prev.slice(-40),
      { id: idRef.current, user, text, hue: userHue(user), self },
    ]);
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const user = CONTENT.chatUsers[Math.floor(Math.random() * CONTENT.chatUsers.length)];
      const pool = [
        ...CONTENT.chatLines,
        'sub-second latency btw',
        'this is on the game site??',
        'no OBS needed, straight from the game',
      ];
      push(user, pool[Math.floor(Math.random() * pool.length)]);
      timeout = setTimeout(tick, 1400 + Math.random() * 2400);
    };
    timeout = setTimeout(tick, 500);
    return () => clearTimeout(timeout);
  }, [push]);

  return { messages, push };
}

function Avatar({ name, hue }: { name: string; hue: number }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: `hsl(${hue},55%,45%)` }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ChannelRow({
  channel,
  active,
  onClick,
}: {
  channel: SimChannel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
        active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <Avatar name={channel.streamer} hue={channel.avatarHue} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-white/90">{channel.streamer}</span>
        <span className="block truncate text-[11px] text-white/40">{channel.category}</span>
      </span>
      <span className="flex items-center gap-1 text-[11px] text-white/50">
        <span className="size-1.5 rounded-full bg-red-500" />
        {fmtViewers(channel.viewers)}
      </span>
    </button>
  );
}

export default function TwitchSiteDemo() {
  const [featured, setFeatured] = useState(0);
  const channel = CONTENT.channels[featured];
  const viewers = useDriftingCount(channel.viewers);
  const { messages, push } = useSimChat();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    push('you', draft.trim(), true);
    setDraft('');
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e0e10] shadow-2xl shadow-black/60 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <div className="ml-3 flex-1 max-w-xs rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-white/40 font-mono">
          yourgame.com/live
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/45">
          Your brand here
        </span>
      </div>

      <div className="grid lg:grid-cols-[200px_1fr_260px] md:grid-cols-[1fr_240px]">
        {/* Channel rail */}
        <aside className="hidden lg:flex flex-col border-r border-white/10 p-2.5 gap-0.5">
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Live channels
          </p>
          {CONTENT.channels.slice(0, 5).map((c, i) => (
            <ChannelRow key={c.streamer + i} channel={c} active={i === featured} onClick={() => setFeatured(i)} />
          ))}
          <p className="mt-auto px-2.5 pt-3 text-[10px] text-white/25 leading-relaxed">
            Every channel is a player streaming from inside your game.
          </p>
        </aside>

        {/* Player */}
        <div className="flex flex-col min-w-0">
          <div className="relative aspect-video bg-black">
            <iframe
              key={channel.videoId}
              src={embedUrl(channel.videoId)}
              title={channel.title}
              allow="autoplay; encrypted-media"
              className="absolute inset-0 h-full w-full pointer-events-none"
            />
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold text-white bg-red-600">
              <span className="ss-pulse size-1.5 rounded-full bg-white" />
              LIVE
            </div>
            <div className="absolute bottom-3 left-3 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[11px] text-white/85">
              {fmtViewers(viewers)} watching
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
            <Avatar name={channel.streamer} hue={channel.avatarHue} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{channel.streamer}</p>
              <p className="truncate text-xs text-white/45">{channel.title}</p>
            </div>
            <span
              className="hidden sm:inline-flex rounded-full px-3.5 py-1.5 text-xs font-semibold text-white"
              style={{ background: BRAND }}
            >
              Follow
            </span>
          </div>
        </div>

        {/* Chat */}
        <aside className="hidden md:flex flex-col border-l border-white/10 max-h-[420px]">
          <div className="px-4 py-2.5 border-b border-white/10 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Stream chat
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-1.5 text-[13px] min-h-0">
            {messages.map((m) => (
              <div key={m.id} className="leading-snug break-words">
                <span className="font-semibold" style={{ color: m.self ? BRAND : `hsl(${m.hue},70%,68%)` }}>
                  {m.user}
                </span>
                <span className="text-white/65">: {m.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="p-2.5 border-t border-white/10 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Send a message"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] placeholder:text-white/25 focus:outline-none focus:border-white/25"
            />
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: BRAND }}
            >
              Chat
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
