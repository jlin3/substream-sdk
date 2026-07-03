/**
 * Simulated content library for generated demo sites.
 *
 * Everything here feeds the branded demo experience at /d/[slug]:
 * genre-matched gameplay videos, streamer personas, chat scripts,
 * and clip metadata. Content is picked deterministically from the
 * demo site slug so a shared link always looks the same.
 */

export type Genre = 'shooter' | 'battle-royale' | 'sports' | 'sandbox' | 'arcade';

export const GENRES: { id: Genre; label: string }[] = [
  { id: 'shooter', label: 'Shooter / FPS' },
  { id: 'battle-royale', label: 'Battle Royale' },
  { id: 'sports', label: 'Sports / Racing' },
  { id: 'sandbox', label: 'Sandbox / Building' },
  { id: 'arcade', label: 'Casual / Arcade' },
];

// Gameplay footage per genre (YouTube IDs, same library the dashboard
// seed data uses). Rendered as muted looping embeds inside the player.
const GENRE_VIDEOS: Record<Genre, string[]> = {
  shooter: ['w3xnLMctoKc', 'JbNNZ_vOCCU', 'ioNVJK-3sNs', '9Rwv6z9CxlU', 'ZjLEB-QDlgU', 'Wh1tHg1Ytcs'],
  'battle-royale': ['cq_2vB0aHk8', '5wjf0BTLORc', 'E2Em3XKkzMo', 'AbOHTw8z1Wo', 'NuYXzNZlBfQ'],
  sports: ['ruJP73lSqTU', 'W75FYBkT6lI', 'cq_2vB0aHk8', '5wjf0BTLORc'],
  sandbox: ['hZQC-dblHU8', 'KHtEAzyniHI', 'W75FYBkT6lI'],
  arcade: ['KHtEAzyniHI', 'hZQC-dblHU8', 'ruJP73lSqTU'],
};

const STREAMER_NAMES = [
  'NovaStrike', 'PixelQueen', 'GhostRunner', 'TurboKat', 'IronWolf',
  'LunaPlays', 'MaxVelocity', 'ShadowByte', 'CrimsonAce', 'FrostBite',
  'ZenMaster', 'RiftWalker', 'NeonNinja', 'StormChaser', 'VoidHunter',
];

const STREAM_TITLES: Record<Genre, string[]> = {
  shooter: ['Ranked grind to Diamond', 'Clutch or kick — road to top 500', 'Late night comp with the squad', 'Aim training then ranked', 'Tournament practice scrims'],
  'battle-royale': ['Win streak attempt #12', 'Solo squads challenge', 'Zero-build ranked arena', 'Dropping hot all night', 'Duo grind with viewers'],
  sports: ['2v2 tournament finals', 'Freestyle training montage', 'Ranked doubles climb', 'Community match night', 'Pro replay analysis'],
  sandbox: ['Mega base build — day 14', 'Hardcore survival ep. 3', 'Building your ideas live', 'Redstone engineering lab', 'Community server tour'],
  arcade: ['High score attempt', 'Speedrun practice', 'Viewer challenge night', 'One-credit clear attempt', 'Chill arcade session'],
};

const CHAT_LINES = [
  'LETS GOOO', 'that was insane', 'clip it', 'CLIP THAT', 'no way lol',
  'how did you hit that??', 'gg', 'W', 'W streamer', 'first time here, this is sick',
  'POG', 'sheeesh', 'that movement is clean', 'ok that was actually cracked',
  'lag or skill issue?', 'chat is this real', 'top 1% play right there',
  'been watching all week', 'do that again', 'tutorial when?', 'built different',
  'the comeback arc', 'someone gif this', 'im learning so much', 'ranked anxiety is real',
  'this game looks so good', 'yo the new update is fire', 'MVP', 'carried',
  'we up', 'insane reflexes', 'certified moment', 'run it back', 'one more game',
];

const CHAT_USERS = [
  'pixel_pete', 'gg_gamer42', 'luna<3', 'xX_clutch_Xx', 'sam_the_fan',
  'nightowl99', 'kbd_warrior', 'controller_carl', 'esports_enjoyer', 'vod_watcher',
  'first_blood', 'peak_gaming', 'casual_andy', 'ranked_grinder', 'spectator_mode',
];

const CLIP_TITLES: Record<Genre, string[]> = {
  shooter: ['1v4 clutch on match point', 'Flick of the century', 'Ace in 8 seconds', 'The impossible smoke play', '200 IQ flank'],
  'battle-royale': ['Last circle 1v3', 'Sniped out of the sky', 'Full squad wipe solo', 'Storm escape at 1HP', 'The rotation that won it all'],
  sports: ['Ceiling shot in OT', 'Double touch game winner', 'The save of the season', 'Kickoff goal in 4 seconds', 'Freestyle flick TOTY'],
  sandbox: ['Castle timelapse — 6 hours in 60s', 'The trap that got everyone', 'Rarest drop ever recorded', 'Speedbuild challenge winner', 'The great bridge collapse'],
  arcade: ['New world record pace', 'Frame-perfect dodge', 'The comeback run', 'Level 99 no-death clear', 'Final boss first try'],
};

/** Deterministic hash so a given slug always renders identical content. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

export interface SimChannel {
  streamer: string;
  title: string;
  videoId: string;
  viewers: number;
  avatarHue: number;
}

export interface SimClip {
  title: string;
  streamer: string;
  videoId: string;
  views: string;
  duration: string;
  likes: number;
}

export interface SimContent {
  channels: SimChannel[];
  clips: SimClip[];
  chatUsers: string[];
  chatLines: string[];
}

export function buildSimContent(slug: string, genre: string): SimContent {
  const g: Genre = (GENRE_VIDEOS as Record<string, string[]>)[genre] ? (genre as Genre) : 'shooter';
  const seed = hashString(slug);
  const videos = GENRE_VIDEOS[g];
  const titles = STREAM_TITLES[g];
  const clipTitles = CLIP_TITLES[g];

  const channels: SimChannel[] = Array.from({ length: Math.min(5, videos.length) }, (_, i) => ({
    streamer: pick(STREAMER_NAMES, seed, i * 3),
    title: pick(titles, seed, i * 7),
    videoId: videos[(seed + i) % videos.length],
    viewers: 240 + ((seed >> (i + 2)) % 4200),
    avatarHue: (seed * (i + 3)) % 360,
  }));

  const clips: SimClip[] = clipTitles.map((title, i) => ({
    title,
    streamer: pick(STREAMER_NAMES, seed, i * 5 + 1),
    videoId: videos[(seed + i * 2 + 1) % videos.length],
    views: `${(3 + ((seed >> i) % 90)) / 10}k`,
    duration: `0:${(20 + ((seed >> i) % 39)).toString().padStart(2, '0')}`,
    likes: 40 + ((seed >> (i + 1)) % 900),
  }));

  return { channels, clips, chatUsers: CHAT_USERS, chatLines: CHAT_LINES };
}

/** youtube embed URL that behaves like a live stream feed */
export function embedUrl(videoId: string, muted = true): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    loop: '1',
    playlist: videoId,
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    iv_load_policy: '3',
    disablekb: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
