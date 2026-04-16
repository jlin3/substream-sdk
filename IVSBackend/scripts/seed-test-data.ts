/**
 * Seed test data for demo purposes
 *
 * Creates demo organization, sample streams, and highlights.
 *
 * Run: pnpm db:seed
 */

import { prisma } from '../src/lib/prisma';

async function seed() {
  console.log('Seeding database...\n');

  // =========================================================================
  // ORGANIZATION
  // =========================================================================
  console.log('Creating demo organization...\n');

  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'substream-demo' },
    update: { name: 'Substream Demo' },
    create: {
      id: 'org-substream-demo',
      name: 'Substream Demo',
      slug: 'substream-demo',
    },
  });
  console.log('  Organization:', demoOrg.slug);

  // =========================================================================
  // SAMPLE STREAMS
  // =========================================================================
  const ytUrl = (id: string) => `youtube:${id}`;
  const ytThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  const DAY = 86400_000;
  const HOUR = 3600_000;

  const YT = {
    haloCtf:      'w3xnLMctoKc',
    breakout:     'KHtEAzyniHI',
    fnArena:      'cq_2vB0aHk8',
    rlTourney:    'ruJP73lSqTU',
    valComp:      'JbNNZ_vOCCU',
    mcBuild:      'hZQC-dblHU8',
    haloSlayer:   'ioNVJK-3sNs',
    fnCreative:   'E2Em3XKkzMo',
    apexRanked:   '5wjf0BTLORc',
    valUnrated:   '9Rwv6z9CxlU',
    haloPower:    'Wh1tHg1Ytcs',
    fnClutch:     'NuYXzNZlBfQ',
    rlGoals:      'W75FYBkT6lI',
    valAce:       'ZjLEB-QDlgU',
    apexSquad:    'AbOHTw8z1Wo',
  };

  const sampleStreams = [
    { id: 'stream-halo-ctf', streamerId: 'player-spartan117', streamerName: 'Spartan-117', title: 'Halo Infinite — CTF on Fragmentation', status: 'RECORDED' as const, startedAt: new Date(Date.now() - DAY * 2), endedAt: new Date(Date.now() - DAY * 2 + 480_000), durationSecs: 480, recordingUrl: ytUrl(YT.haloCtf), thumbnailUrl: ytThumb(YT.haloCtf) },
    { id: 'stream-sample-001', streamerId: 'demo-child-001', streamerName: 'Demo Streamer', title: 'Epic Breakout Session', status: 'RECORDED' as const, startedAt: new Date(Date.now() - HOUR * 3), endedAt: new Date(Date.now() - HOUR * 2), durationSecs: 3600, recordingUrl: ytUrl(YT.breakout), thumbnailUrl: ytThumb(YT.breakout) },
    { id: 'stream-fn-arena', streamerId: 'player-xnova', streamerName: 'xNova', title: 'Fortnite — Arena Ranked Grind', status: 'RECORDED' as const, startedAt: new Date(Date.now() - HOUR * 8), endedAt: new Date(Date.now() - HOUR * 6), durationSecs: 7200, recordingUrl: ytUrl(YT.fnArena), thumbnailUrl: ytThumb(YT.fnArena) },
    { id: 'stream-rl-tourney', streamerId: 'player-shadowfox', streamerName: 'ShadowFox', title: 'Rocket League — 2v2 Tournament', status: 'RECORDED' as const, startedAt: new Date(Date.now() - DAY * 1), endedAt: new Date(Date.now() - DAY * 1 + 2400_000), durationSecs: 2400, recordingUrl: ytUrl(YT.rlTourney), thumbnailUrl: ytThumb(YT.rlTourney) },
    { id: 'stream-val-comp', streamerId: 'player-phantomace', streamerName: 'PhantomAce', title: 'Valorant — Competitive Ascent', status: 'RECORDED' as const, startedAt: new Date(Date.now() - HOUR * 14), endedAt: new Date(Date.now() - HOUR * 12), durationSecs: 5400, recordingUrl: ytUrl(YT.valComp), thumbnailUrl: ytThumb(YT.valComp) },
    { id: 'stream-mc-build', streamerId: 'player-blocksmith', streamerName: 'BlockSmith', title: 'Minecraft — Mega Castle Build', status: 'RECORDED' as const, startedAt: new Date(Date.now() - DAY * 3), endedAt: new Date(Date.now() - DAY * 3 + 10800_000), durationSecs: 10800, recordingUrl: ytUrl(YT.mcBuild), thumbnailUrl: ytThumb(YT.mcBuild) },
    { id: 'stream-halo-slayer', streamerId: 'player-spartan117', streamerName: 'Spartan-117', title: 'Halo Infinite — Team Slayer', status: 'RECORDED' as const, startedAt: new Date(Date.now() - HOUR * 28), endedAt: new Date(Date.now() - HOUR * 27), durationSecs: 3000, recordingUrl: ytUrl(YT.haloSlayer), thumbnailUrl: ytThumb(YT.haloSlayer) },
    { id: 'stream-fn-creative', streamerId: 'player-xnova', streamerName: 'xNova', title: 'Fortnite — Creative Zone Wars', status: 'RECORDED' as const, startedAt: new Date(Date.now() - DAY * 4), endedAt: new Date(Date.now() - DAY * 4 + 1800_000), durationSecs: 1800, recordingUrl: ytUrl(YT.fnCreative), thumbnailUrl: ytThumb(YT.fnCreative) },
    { id: 'stream-apex-ranked', streamerId: 'player-viperstrike', streamerName: 'ViperStrike', title: 'Apex Legends — Diamond Ranked Push', status: 'RECORDED' as const, startedAt: new Date(Date.now() - HOUR * 5), endedAt: new Date(Date.now() - HOUR * 3.5), durationSecs: 5400, recordingUrl: ytUrl(YT.apexRanked), thumbnailUrl: ytThumb(YT.apexRanked) },
    { id: 'stream-val-unrated', streamerId: 'player-phantomace', streamerName: 'PhantomAce', title: 'Valorant — Unrated with Friends', status: 'RECORDED' as const, startedAt: new Date(Date.now() - HOUR * 48), endedAt: new Date(Date.now() - HOUR * 47), durationSecs: 3600, recordingUrl: ytUrl(YT.valUnrated), thumbnailUrl: ytThumb(YT.valUnrated) },
  ];

  for (const s of sampleStreams) {
    const { id, ...data } = s;
    await prisma.stream.upsert({
      where: { id },
      update: { recordingUrl: data.recordingUrl, thumbnailUrl: data.thumbnailUrl, status: data.status },
      create: { id, orgId: demoOrg.id, ...data },
    });
    console.log(`  Stream: ${data.title}`);
  }

  // =========================================================================
  // HIGHLIGHTS
  // =========================================================================

  const haloPipelineData = {
    source_duration: 480,
    highlight_duration: 75,
    segments_analyzed: 51,
    segments_selected: 7,
    processing_time_seconds: 390,
    model: 'gemini-3.1-pro-preview',
    steps: [
      { name: 'Download', duration_sec: 12, detail: 'Fetched 8 min recording from cloud storage' },
      { name: 'Scene Analysis', duration_sec: 95, detail: 'Google Cloud Video Intelligence API — shot detection, labels, text, object tracking' },
      { name: 'Audio Analysis', duration_sec: 8, detail: 'Local RMS energy analysis via pydub/numpy' },
      { name: 'Segment Scoring', duration_sec: 180, detail: 'Gemini 3.1 Pro scored 51 segments from sampled frames' },
      { name: 'Highlight Selection', duration_sec: 0.2, detail: 'Weighted scoring: Gemini 50%, Video Intel 25%, Audio 25%' },
      { name: 'Assembly', duration_sec: 45, detail: 'FFmpeg crossfade transitions + loudnorm audio normalization' },
    ],
    segments: [
      { start: 107.0, end: 116.1, duration: 9.1, score: 50, label: 'Player grabs the enemy flag', selected: true },
      { start: 184.0, end: 186.1, duration: 2.1, score: 79, label: 'Sniping an enemy on a moving vehicle', selected: true },
      { start: 199.0, end: 201.1, duration: 2.1, score: 51, label: 'Standard multiplayer firefight', selected: true },
      { start: 296.0, end: 298.5, duration: 2.5, score: 66, label: 'Sniper Rifle kill', selected: true },
      { start: 340.0, end: 345.7, duration: 5.7, score: 59, label: 'Ambushing enemies near a Warthog', selected: true },
      { start: 370.0, end: 412.7, duration: 42.7, score: 50, label: 'Kills and a destroyed vehicle', selected: true },
      { start: 426.0, end: 436.8, duration: 10.8, score: 56, label: 'Active Camo stealth attack on enemy vehicle', selected: true },
    ],
  };

  const apexPipelineData = {
    source_duration: 5400,
    highlight_duration: 40,
    segments_analyzed: 87,
    segments_selected: 5,
    processing_time_seconds: 620,
    model: 'gemini-3.1-pro-preview',
    steps: [
      { name: 'Download', duration_sec: 28, detail: 'Fetched 90 min recording from cloud storage' },
      { name: 'Scene Analysis', duration_sec: 185, detail: 'Google Cloud Video Intelligence API — shot detection, labels, text, object tracking' },
      { name: 'Audio Analysis', duration_sec: 15, detail: 'Local RMS energy analysis via pydub/numpy' },
      { name: 'Segment Scoring', duration_sec: 310, detail: 'Gemini 3.1 Pro scored 87 segments from sampled frames' },
      { name: 'Highlight Selection', duration_sec: 0.3, detail: 'Weighted scoring: Gemini 50%, Video Intel 25%, Audio 25%' },
      { name: 'Assembly', duration_sec: 32, detail: 'FFmpeg crossfade transitions + loudnorm audio normalization' },
    ],
    segments: [
      { start: 412.0, end: 420.5, duration: 8.5, score: 92, label: 'Kraber headshot on moving target from 200m', selected: true },
      { start: 1830.0, end: 1842.0, duration: 12.0, score: 85, label: 'Full squad wipe with Kraber — 3 knocks in 8 seconds', selected: true },
      { start: 2205.0, end: 2214.0, duration: 9.0, score: 78, label: 'Clutch revive under fire + Wingman triple kill', selected: true },
      { start: 3600.0, end: 3606.0, duration: 6.0, score: 71, label: 'No-scope Kraber elimination on zip-line', selected: true },
      { start: 4800.0, end: 4804.5, duration: 4.5, score: 68, label: 'Final ring sprint + Mastiff wipe for the win', selected: true },
    ],
  };

  await prisma.highlight.upsert({
    where: { id: 'highlight-halo-ctf' },
    update: { videoUrl: ytUrl(YT.haloPower), thumbnailUrl: ytThumb(YT.haloPower), pipelineData: haloPipelineData, status: 'COMPLETED' },
    create: {
      id: 'highlight-halo-ctf',
      orgId: demoOrg.id,
      streamId: 'stream-halo-ctf',
      title: 'Halo Infinite CTF — Best Moments',
      videoUrl: ytUrl(YT.haloPower),
      thumbnailUrl: ytThumb(YT.haloPower),
      duration: 75,
      status: 'COMPLETED',
      pipelineData: haloPipelineData,
    },
  });
  console.log('  Halo highlight (COMPLETED with pipeline data)');

  await prisma.highlight.upsert({
    where: { id: 'highlight-processing' },
    update: { videoUrl: ytUrl(YT.breakout), thumbnailUrl: ytThumb(YT.breakout), status: 'COMPLETED', duration: 60 },
    create: {
      id: 'highlight-processing',
      orgId: demoOrg.id,
      streamId: 'stream-sample-001',
      title: 'Highlights: Epic Breakout Session',
      videoUrl: ytUrl(YT.breakout),
      thumbnailUrl: ytThumb(YT.breakout),
      duration: 60,
      status: 'COMPLETED',
    },
  });
  console.log('  Breakout highlight (COMPLETED)');

  const extraHighlights = [
    { id: 'highlight-fn-clutch', streamId: 'stream-fn-arena', title: 'Fortnite — Insane 1v4 Clutch', duration: 45, status: 'COMPLETED' as const, videoUrl: ytUrl(YT.fnClutch), thumbnailUrl: ytThumb(YT.fnClutch) },
    { id: 'highlight-rl-ot', streamId: 'stream-rl-tourney', title: 'Rocket League — OT Ceiling Shot', duration: 30, status: 'COMPLETED' as const, videoUrl: ytUrl(YT.rlGoals), thumbnailUrl: ytThumb(YT.rlGoals) },
    { id: 'highlight-val-ace', streamId: 'stream-val-comp', title: 'Valorant — Operator Ace on Ascent', duration: 55, status: 'COMPLETED' as const, videoUrl: ytUrl(YT.valAce), thumbnailUrl: ytThumb(YT.valAce) },
    { id: 'highlight-apex-squad', streamId: 'stream-apex-ranked', title: 'Apex — Squad Wipe with Kraber', duration: 40, status: 'COMPLETED' as const, videoUrl: ytUrl(YT.apexSquad), thumbnailUrl: ytThumb(YT.apexSquad), pipelineData: apexPipelineData },
  ];

  for (const h of extraHighlights) {
    const { id, ...data } = h;
    await prisma.highlight.upsert({
      where: { id },
      update: { videoUrl: data.videoUrl, thumbnailUrl: data.thumbnailUrl, status: data.status },
      create: { id, orgId: demoOrg.id, ...data },
    });
    console.log(`  Highlight: ${data.title}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.concat('='.repeat(62)));
  console.log('\n  DEMO CREDENTIALS\n');
  console.log('  Streamer ID:    demo-child-001');
  console.log('  Auth Token:     demo-token');
  console.log('  Viewer Token:   demo-viewer-token');
  console.log('\n  DEMO ORG\n');
  console.log('  Org Slug:       substream-demo');
  console.log('  Login:          /login or /api/auth/demo-auto');
  console.log('\n' + '='.concat('='.repeat(62)));
  console.log('\nSeed complete!');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
