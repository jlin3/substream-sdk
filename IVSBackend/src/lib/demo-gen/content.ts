/**
 * Simulated content library for generated demo sites.
 *
 * Everything here feeds the branded demo experience at /d/[slug]:
 * vertical-matched footage (gaming, music, sports), streamer/artist/event
 * personas, chat scripts, category tiles for the browse view, and clip
 * metadata. Content is picked deterministically from the demo site slug
 * so a shared link always looks the same.
 */

export type Vertical = 'gaming' | 'music' | 'sports';

export const CONTENT_TYPES: { id: Vertical; label: string }[] = [
  { id: 'gaming', label: 'Video games' },
  { id: 'music', label: 'Music & festivals' },
  { id: 'sports', label: 'Sports & events' },
];

export const GENRES_BY_VERTICAL: Record<Vertical, { id: string; label: string }[]> = {
  gaming: [
    { id: 'shooter', label: 'Shooter / FPS' },
    { id: 'battle-royale', label: 'Battle Royale' },
    { id: 'sports-games', label: 'Sports / Racing' },
    { id: 'sandbox', label: 'Sandbox / Building' },
    { id: 'arcade', label: 'Casual / Arcade' },
  ],
  music: [
    { id: 'edm', label: 'EDM / Festivals' },
    { id: 'rock', label: 'Rock / Live Bands' },
    { id: 'stadium', label: 'Stadium / Pop' },
  ],
  sports: [
    { id: 'basketball', label: 'Basketball' },
    { id: 'soccer', label: 'Soccer / Football' },
    { id: 'tennis', label: 'Tennis' },
    { id: 'gridiron', label: 'American Football' },
  ],
};

export function verticalForGenre(genre: string): Vertical {
  for (const [vertical, genres] of Object.entries(GENRES_BY_VERTICAL) as [Vertical, { id: string }[]][]) {
    if (genres.some((g) => g.id === genre)) return vertical;
  }
  return 'gaming';
}

// ─────────────────────────────────────────────────────────────────
// Footage pools (YouTube IDs, verified embeddable via oEmbed)
// ─────────────────────────────────────────────────────────────────

const GAMING_VIDEOS: Record<string, string[]> = {
  shooter: ['w3xnLMctoKc', 'JbNNZ_vOCCU', 'ioNVJK-3sNs', '9Rwv6z9CxlU', 'ZjLEB-QDlgU', 'Wh1tHg1Ytcs'],
  'battle-royale': ['cq_2vB0aHk8', '5wjf0BTLORc', 'E2Em3XKkzMo', 'AbOHTw8z1Wo', 'NuYXzNZlBfQ'],
  'sports-games': ['ruJP73lSqTU', 'W75FYBkT6lI', 'cq_2vB0aHk8', '5wjf0BTLORc'],
  sandbox: ['hZQC-dblHU8', 'KHtEAzyniHI', 'W75FYBkT6lI'],
  arcade: ['KHtEAzyniHI', 'hZQC-dblHU8', 'ruJP73lSqTU'],
  // legacy genre id from before verticals existed
  sports: ['ruJP73lSqTU', 'W75FYBkT6lI', 'cq_2vB0aHk8', '5wjf0BTLORc'],
};

const MUSIC_VIDEOS: Record<string, string[]> = {
  edm: ['TT32mIg4oqg', 'rcL1_PJ8l3U', 'hQ6k0_Iura0', 'xsz-VpTjP2Y', 'T0URQXb93xk'],
  rock: ['MLie88A7SZU', 'HyWajWueH2w', 'e8M8dLg1WtE', 'DiCQ1Yhnu5s'],
  stadium: ['T0URQXb93xk', 'MLie88A7SZU', 'e8M8dLg1WtE', 'TT32mIg4oqg'],
};

const SPORTS_VIDEOS: Record<string, string[]> = {
  basketball: ['PrObPnSeeag', 'kVmROM2frIs', 'NtYOQ83KJfk', '58Z4lJcW2AM'],
  soccer: ['NtYOQ83KJfk', 'NiPCDDNEZa0', 'PrObPnSeeag', '58Z4lJcW2AM'],
  tennis: ['58Z4lJcW2AM', 'Y_FW-KuC5lg', 'NtYOQ83KJfk', 'PrObPnSeeag'],
  gridiron: ['kVmROM2frIs', 'PrObPnSeeag', 'NiPCDDNEZa0', 'Y_FW-KuC5lg'],
};

function videosFor(genre: string): string[] {
  return GAMING_VIDEOS[genre] || MUSIC_VIDEOS[genre] || SPORTS_VIDEOS[genre] || GAMING_VIDEOS.shooter;
}

// ─────────────────────────────────────────────────────────────────
// Persona + copy pools per vertical
// ─────────────────────────────────────────────────────────────────

const NAMES: Record<Vertical, string[]> = {
  gaming: [
    'NovaStrike', 'PixelQueen', 'GhostRunner', 'TurboKat', 'IronWolf',
    'LunaPlays', 'MaxVelocity', 'ShadowByte', 'CrimsonAce', 'FrostBite',
    'ZenMaster', 'RiftWalker', 'NeonNinja', 'StormChaser', 'VoidHunter',
  ],
  music: [
    'DJ Nova', 'Solstice', 'The Wildfires', 'Aria Vale', 'Neon Harbor',
    'Midnight Keys', 'Callisto', 'Ember & Oak', 'Pulse Theory', 'La Marea',
    'Velvet Static', 'Northlight', 'Juno Waves', 'The Foxgloves', 'Marlowe',
  ],
  sports: [
    'Falcons vs Thunder', 'City FC vs Union', 'Metro Kings vs Bay Sharks', 'Ravens vs Comets',
    'Northside Derby', 'Harbor Cup Semifinal', 'Valley Classic Final', 'Riverside vs Summit',
    'All-Star Showcase', 'Champions Bracket R2', 'Coastal Clash', 'Capital Series Game 5',
  ],
};

const TITLES: Record<string, string[]> = {
  // gaming
  shooter: ['Ranked grind to Diamond', 'Clutch or kick — road to top 500', 'Late night comp with the squad', 'Aim training then ranked', 'Tournament practice scrims'],
  'battle-royale': ['Win streak attempt #12', 'Solo squads challenge', 'Zero-build ranked arena', 'Dropping hot all night', 'Duo grind with viewers'],
  'sports-games': ['2v2 tournament finals', 'Freestyle training montage', 'Ranked doubles climb', 'Community match night', 'Pro replay analysis'],
  sandbox: ['Mega base build — day 14', 'Hardcore survival ep. 3', 'Building your ideas live', 'Redstone engineering lab', 'Community server tour'],
  arcade: ['High score attempt', 'Speedrun practice', 'Viewer challenge night', 'One-credit clear attempt', 'Chill arcade session'],
  // music
  edm: ['Mainstage — live now', 'Sunset set from the terrace', 'B2B surprise set', 'Festival weekend day 2', 'Warehouse afterparty stream'],
  rock: ['Live from the arena', 'Acoustic session + Q&A', 'Album release show', 'Soundcheck cam — doors at 8', 'Encore night, full band'],
  stadium: ['World tour — night 14', 'Stadium show, front row cam', 'Surprise guest tonight?', 'The finale weekend', 'Soundcheck to encore, all access'],
  // sports
  basketball: ['Game 5 — series tied 2-2', 'Conference semifinal, live', 'Overtime thriller in progress', 'Rivalry night doubleheader', 'Playoff clincher watch'],
  soccer: ['Matchday 32 — title race', 'Cup semifinal, extra time looms', 'Derby day — sold out', 'Group stage decider', 'Relegation six-pointer'],
  tennis: ['Quarterfinal — Centre Court', 'Third set tiebreak drama', 'Night session feature match', 'Semifinal — best of 5', 'Championship point watch'],
  gridiron: ['4th quarter, 2-minute drill', 'Divisional round, live', 'Primetime under the lights', 'Rivalry week showdown', 'Playoff bound — win and in'],
};

const CHAT: Record<Vertical, string[]> = {
  gaming: [
    'LETS GOOO', 'that was insane', 'clip it', 'CLIP THAT', 'no way lol',
    'how did you hit that??', 'gg', 'W', 'W streamer', 'first time here, this is sick',
    'POG', 'sheeesh', 'that movement is clean', 'ok that was actually cracked',
    'top 1% play right there', 'been watching all week', 'do that again', 'tutorial when?',
    'built different', 'someone gif this', 'run it back', 'one more game', 'MVP', 'carried',
  ],
  music: [
    'this drop 🔥', 'crowd is INSANE', 'front row energy from my couch', 'setlist is unreal',
    'goosebumps', 'ENCORE! ENCORE!', 'sound is so crisp', 'the lights omg', 'best set of the night',
    'who else is here from the announcement?', 'play the new one!!', 'this transition tho',
    'I was there last night, even better live', 'volume UP', 'chills. actual chills',
    'the whole stadium is singing', 'camera work is cinema', 'already replaying this tomorrow',
  ],
  sports: [
    'WHAT A GOAL', 'ref missed that 100%', 'defense is ASLEEP', 'MVP performance',
    'that replay though', 'CLUTCH', 'this match is insane', 'underdogs cooking',
    'stat line is crazy', 'overtime incoming', 'coach has to call a timeout',
    'best game of the season', 'crowd is deafening', 'he called it before the play',
    'rewind that', 'instant classic', 'they need to sub him NOW', 'championship energy',
  ],
};

const CLIPS: Record<string, string[]> = {
  shooter: ['1v4 clutch on match point', 'Flick of the century', 'Ace in 8 seconds', 'The impossible smoke play', '200 IQ flank'],
  'battle-royale': ['Last circle 1v3', 'Sniped out of the sky', 'Full squad wipe solo', 'Storm escape at 1HP', 'The rotation that won it all'],
  'sports-games': ['Ceiling shot in OT', 'Double touch game winner', 'The save of the season', 'Kickoff goal in 4 seconds', 'Freestyle flick TOTY'],
  sandbox: ['Castle timelapse — 6 hours in 60s', 'The trap that got everyone', 'Rarest drop ever recorded', 'Speedbuild challenge winner', 'The great bridge collapse'],
  arcade: ['New world record pace', 'Frame-perfect dodge', 'The comeback run', 'Level 99 no-death clear', 'Final boss first try'],
  edm: ['The drop that shook the mainstage', 'Crowd takes over the chorus', 'Surprise B2B moment', 'Pyro finale in 4K', 'ID track everyone is hunting'],
  rock: ['Guitar solo under the lights', 'Acoustic encore surprise', 'Whole arena sings verse 2', 'Drum battle mid-set', 'The stage dive moment'],
  stadium: ['Opening pyro + first chorus', 'Guest appearance mid-set', 'Confetti finale from above', 'Crowd wave in the rain', 'The high note, untouched'],
  basketball: ['Buzzer beater from half court', 'Poster dunk over two defenders', 'The comeback in the 4th', 'No-look dime in transition', 'Block into fastbreak slam'],
  soccer: ['Bicycle kick golazo', 'Top corner from 30 yards', 'Keeper saves the penalty', 'Team goal — 24 passes', 'Last-minute winner, limbs everywhere'],
  tennis: ['Match point rally — 32 shots', 'Tweener winner at the net', 'Ace on championship point', 'The impossible get', 'Underarm serve gamble pays off'],
  gridiron: ['Hail mary as time expires', 'One-handed grab on the sideline', '99-yard pick six', 'The goal line stand', 'Flea flicker for the win'],
};

const CHAT_USERS = [
  'pixel_pete', 'gg_gamer42', 'luna<3', 'front_row_fran', 'sam_the_fan',
  'nightowl99', 'kbd_warrior', 'season_ticket_sal', 'superfan_maya', 'vod_watcher',
  'first_blood', 'peak_moments', 'casual_andy', 'stat_nerd', 'spectator_mode',
];

// Category tiles for the browse/home view
const CATEGORY_LABELS: Record<Vertical, { id: string; label: string }[]> = {
  gaming: GENRES_BY_VERTICAL.gaming,
  music: [
    { id: 'edm', label: 'Mainstage' },
    { id: 'rock', label: 'Live Bands' },
    { id: 'stadium', label: 'Stadium Tours' },
    { id: 'edm', label: 'Club Sets' },
    { id: 'rock', label: 'Acoustic' },
  ],
  sports: [
    { id: 'basketball', label: 'Basketball' },
    { id: 'soccer', label: 'Soccer' },
    { id: 'tennis', label: 'Tennis' },
    { id: 'gridiron', label: 'Football' },
    { id: 'basketball', label: 'Top Plays' },
  ],
};

// Terminology so the UI reads natively per vertical
export const TERMS: Record<
  Vertical,
  { liveNoun: string; personNoun: string; goLive: string; scheduleNoun: string }
> = {
  gaming: { liveNoun: 'Live channels', personNoun: 'Streamer', goLive: 'Go live yourself', scheduleNoun: 'Upcoming streams' },
  music: { liveNoun: 'Live stages', personNoun: 'Artist', goLive: 'Broadcast your stage', scheduleNoun: 'Set times' },
  sports: { liveNoun: 'Live events', personNoun: 'Event', goLive: 'Broadcast your event', scheduleNoun: "Today's schedule" },
};

// ─────────────────────────────────────────────────────────────────
// Deterministic content assembly
// ─────────────────────────────────────────────────────────────────

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
  category: string;
}

export interface SimClip {
  title: string;
  streamer: string;
  videoId: string;
  views: string;
  duration: string;
  likes: number;
}

export interface SimCategory {
  label: string;
  videoId: string;
  watching: string;
}

export interface SimScheduleItem {
  time: string;
  name: string;
  detail: string;
  status: 'live' | 'upcoming';
}

export interface SimContent {
  vertical: Vertical;
  channels: SimChannel[];
  clips: SimClip[];
  categories: SimCategory[];
  schedule: SimScheduleItem[];
  chatUsers: string[];
  chatLines: string[];
}

export function buildSimContent(slug: string, genre: string): SimContent {
  const vertical = verticalForGenre(genre);
  const seed = hashString(slug);
  const videos = videosFor(genre);
  const titles = TITLES[genre] || TITLES.shooter;
  const clipTitles = CLIPS[genre] || CLIPS.shooter;
  const names = NAMES[vertical];
  const genreLabel =
    GENRES_BY_VERTICAL[vertical].find((g) => g.id === genre)?.label || GENRES_BY_VERTICAL[vertical][0].label;

  const channels: SimChannel[] = Array.from({ length: Math.min(6, Math.max(4, videos.length)) }, (_, i) => ({
    streamer: pick(names, seed, i * 3),
    title: pick(titles, seed, i * 7),
    videoId: videos[(seed + i) % videos.length],
    viewers: 240 + ((seed >> (i + 2)) % 4200),
    avatarHue: (seed * (i + 3)) % 360,
    category: genreLabel,
  }));

  const clips: SimClip[] = clipTitles.map((title, i) => ({
    title,
    streamer: pick(names, seed, i * 5 + 1),
    videoId: videos[(seed + i * 2 + 1) % videos.length],
    views: `${(3 + ((seed >> i) % 90)) / 10}k`,
    duration: `0:${(20 + ((seed >> i) % 39)).toString().padStart(2, '0')}`,
    likes: 40 + ((seed >> (i + 1)) % 900),
  }));

  const categories: SimCategory[] = CATEGORY_LABELS[vertical].map((c, i) => {
    const vids = videosFor(c.id);
    return {
      label: c.label,
      videoId: vids[(seed + i) % vids.length],
      watching: `${(8 + ((seed >> (i + 1)) % 240)) / 10}k`,
    };
  });

  const hours = [10, 12, 14, 16, 19, 21];
  const schedule: SimScheduleItem[] = Array.from({ length: 5 }, (_, i) => ({
    time: `${hours[(seed + i) % hours.length]}:${i % 2 === 0 ? '00' : '30'}`,
    name: pick(names, seed, i * 11 + 2),
    detail: pick(titles, seed, i * 13 + 3),
    status: i < 2 ? 'live' : 'upcoming',
  }));

  return { vertical, channels, clips, categories, schedule, chatUsers: CHAT_USERS, chatLines: CHAT[vertical] };
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
