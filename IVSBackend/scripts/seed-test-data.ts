/**
 * Seed test data for demo purposes
 * 
 * Creates two sets of credentials:
 * 1. Demo credentials (for SDK users to test immediately)
 * 2. Test credentials (for internal testing)
 * 
 * Run: pnpm db:seed
 */

import { prisma } from '../src/lib/prisma';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // =========================================================================
  // DEMO CREDENTIALS - For SDK users to test immediately
  // =========================================================================
  console.log('📦 Creating demo credentials for SDK users...\n');

  // Demo child user (the streamer)
  const demoChildUser = await prisma.user.upsert({
    where: { email: 'demo@substream.dev' },
    update: {},
    create: {
      id: 'demo-user-001',
      email: 'demo@substream.dev',
      role: 'CHILD',
      displayName: 'Demo Streamer',
      kidVerified: true,
    },
  });
  console.log('✅ Demo child user:', demoChildUser.id);

  // Demo child profile
  const demoChildProfile = await prisma.childProfile.upsert({
    where: { userId: demoChildUser.id },
    update: {},
    create: {
      id: 'demo-child-001',
      userId: demoChildUser.id,
      streamingEnabled: true,
      maxStreamDuration: 60, // 1 hour max for demo
    },
  });
  console.log('✅ Demo child profile:', demoChildProfile.id);

  // Demo parent user (the viewer)
  const demoParentUser = await prisma.user.upsert({
    where: { email: 'demo-viewer@substream.dev' },
    update: {},
    create: {
      id: 'demo-viewer-001',
      email: 'demo-viewer@substream.dev',
      role: 'PARENT',
      displayName: 'Demo Viewer',
    },
  });
  console.log('✅ Demo parent user:', demoParentUser.id);

  // Demo parent profile
  const demoParentProfile = await prisma.parentProfile.upsert({
    where: { userId: demoParentUser.id },
    update: {},
    create: {
      id: 'demo-parent-001',
      userId: demoParentUser.id,
      notificationsEnabled: false,
    },
  });
  console.log('✅ Demo parent profile:', demoParentProfile.id);

  // Link demo parent to demo child
  await prisma.parentChildRelation.upsert({
    where: {
      parentId_childId: {
        parentId: demoParentProfile.id,
        childId: demoChildProfile.id,
      },
    },
    update: {},
    create: {
      id: 'demo-relation-001',
      parentId: demoParentProfile.id,
      childId: demoChildProfile.id,
      canWatch: true,
      canViewVods: true,
    },
  });
  console.log('✅ Linked demo parent to demo child\n');

  // =========================================================================
  // TEST CREDENTIALS - For internal testing
  // =========================================================================
  console.log('🧪 Creating test credentials for internal use...\n');

  // Test child user
  const testChildUser = await prisma.user.upsert({
    where: { email: 'test-child@example.com' },
    update: {},
    create: {
      id: 'test-user-id',
      email: 'test-child@example.com',
      role: 'CHILD',
      displayName: 'Test Child',
      kidVerified: true,
    },
  });
  console.log('✅ Test child user:', testChildUser.id);

  // Test child profile
  const testChildProfile = await prisma.childProfile.upsert({
    where: { userId: testChildUser.id },
    update: {},
    create: {
      id: 'test-child-id',
      userId: testChildUser.id,
      streamingEnabled: true,
      maxStreamDuration: 120,
    },
  });
  console.log('✅ Test child profile:', testChildProfile.id);

  // Test parent user
  const testParentUser = await prisma.user.upsert({
    where: { email: 'test-parent@example.com' },
    update: {},
    create: {
      id: 'test-parent-user-id',
      email: 'test-parent@example.com',
      role: 'PARENT',
      displayName: 'Test Parent',
    },
  });
  console.log('✅ Test parent user:', testParentUser.id);

  // Test parent profile
  const testParentProfile = await prisma.parentProfile.upsert({
    where: { userId: testParentUser.id },
    update: {},
    create: {
      id: 'test-parent-id',
      userId: testParentUser.id,
      notificationsEnabled: true,
    },
  });
  console.log('✅ Test parent profile:', testParentProfile.id);

  // Link test parent to test child
  await prisma.parentChildRelation.upsert({
    where: {
      parentId_childId: {
        parentId: testParentProfile.id,
        childId: testChildProfile.id,
      },
    },
    update: {},
    create: {
      id: 'test-relation-id',
      parentId: testParentProfile.id,
      childId: testChildProfile.id,
      canWatch: true,
      canViewVods: true,
    },
  });
  console.log('✅ Linked test parent to test child\n');

  // =========================================================================
  // ORGANIZATION DATA - For livewave.ai demo
  // =========================================================================
  console.log('🏢 Creating demo organization...\n');

  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'livewave-demo' },
    update: {},
    create: {
      id: 'org-livewave-demo',
      name: 'Livewave Demo',
      slug: 'livewave-demo',
    },
  });
  console.log('✅ Demo organization:', demoOrg.slug);

  const ytUrl = (id: string) => `youtube:${id}`;
  const ytThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  const DAY = 86400_000;
  const HOUR = 3600_000;

  // YouTube video IDs mapped to each game/stream
  const YT = {
    haloCtf:      'w3xnLMctoKc', // HCS Top 10 Clips: Best of 2024
    breakout:     'KHtEAzyniHI', // Closest Slayer Matchup in Halo Infinite
    fnArena:      'cq_2vB0aHk8', // The BEST Clutches in Fortnite History
    rlTourney:    'ruJP73lSqTU', // Rocket League Best of 2024
    valComp:      'JbNNZ_vOCCU', // PRX f0rsakeN 1v5 ACE Clutch VCT Masters
    mcBuild:      'hZQC-dblHU8', // Shinju Castle — Minecraft Timelapse
    haloSlayer:   'ioNVJK-3sNs', // Royal 2 Greatest Hits — Halo Infinite LAN
    fnCreative:   'E2Em3XKkzMo', // Top 10 Solo Clutches in Competitive Fortnite
    apexRanked:   '5wjf0BTLORc', // iiTzTimmy Best Clutch of his Career
    valUnrated:   '9Rwv6z9CxlU', // DRX MaKo Insane Ace Clutch
    // Highlight-specific clips
    haloPower:    'Wh1tHg1Ytcs', // Power Weapon Plays Community Montage
    fnClutch:     'NuYXzNZlBfQ', // Insane 1v8 clutch in reload
    rlGoals:      'W75FYBkT6lI', // Best RLCS 2024 Goals
    valAce:       'ZjLEB-QDlgU', // PRX f0rsaken 1v5 ACE Clutch vs EDG
    apexSquad:    'AbOHTw8z1Wo', // INSANE Ranked Clutch 1v6 OFF DROP
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
    console.log(`✅ Stream: ${data.title}`);
  }

  // Halo highlight — real pipeline output
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
      { start: 15.0, end: 30.0, duration: 15.0, score: 22, label: 'Initial spawn and traversal', selected: false },
      { start: 45.0, end: 60.0, duration: 15.0, score: 18, label: 'Walking toward objective', selected: false },
      { start: 60.0, end: 75.0, duration: 15.0, score: 31, label: 'Minor firefight, no kills', selected: false },
      { start: 135.0, end: 150.0, duration: 15.0, score: 28, label: 'Vehicle boarding', selected: false },
      { start: 225.0, end: 240.0, duration: 15.0, score: 15, label: 'Respawn and traversal', selected: false },
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
      { start: 120.0, end: 135.0, duration: 15.0, score: 25, label: 'Looting and rotating to ring', selected: false },
      { start: 900.0, end: 915.0, duration: 15.0, score: 32, label: 'Poking at range with no knocks', selected: false },
      { start: 2700.0, end: 2715.0, duration: 15.0, score: 19, label: 'Healing and repositioning', selected: false },
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
  console.log('✅ Halo highlight (COMPLETED with pipeline data)');

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
  console.log('✅ Breakout highlight (COMPLETED)');

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
    console.log(`✅ Highlight: ${data.title}`);
  }

  console.log('');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  🎮 DEMO CREDENTIALS (for SDK users)');
  console.log('');
  console.log('  Use these in your Unity project to test streaming:');
  console.log('');
  console.log('    Child ID:    demo-child-001');
  console.log('    Auth Token:  demo-token');
  console.log('');
  console.log('  Viewer credentials:');
  console.log('');
  console.log('    Parent ID:   demo-viewer-001');
  console.log('    Auth Token:  demo-viewer-token');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  🏢 LIVEWAVE DEMO ORG');
  console.log('');
  console.log('    Org Slug:    livewave-demo');
  console.log('    Demo Code:   Set DEMO_ORG_CODE in .env');
  console.log('    Login at:    https://livewave.ai/login');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  🧪 TEST CREDENTIALS (for internal testing)');
  console.log('');
  console.log('    Child ID:    test-child-id');
  console.log('    User ID:     test-user-id');
  console.log('    Parent ID:   test-parent-user-id');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('🎉 Seed complete!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
