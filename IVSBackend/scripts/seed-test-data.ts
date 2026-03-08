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

  const HALO_HIGHLIGHT_GCS = 'gs://substream-highlights/highlights/fab5652f-cf3b-4d44-8388-fe7e129afe6f/fab5652f-cf3b-4d44-8388-fe7e129afe6f.mp4';

  // Sample streams
  const sampleStreams = [
    {
      id: 'stream-halo-ctf',
      orgId: demoOrg.id,
      streamerId: 'player-spartan117',
      streamerName: 'Spartan-117',
      title: 'Halo Infinite — CTF on Fragmentation',
      status: 'RECORDED' as const,
      startedAt: new Date(Date.now() - 86400_000 * 2),
      endedAt: new Date(Date.now() - 86400_000 * 2 + 480_000),
      durationSecs: 480,
      recordingUrl: HALO_HIGHLIGHT_GCS,
    },
    {
      id: 'stream-sample-001',
      orgId: demoOrg.id,
      streamerId: 'demo-child-001',
      streamerName: 'Demo Streamer',
      title: 'Epic Breakout Session',
      status: 'RECORDED' as const,
      startedAt: new Date(Date.now() - 3600_000 * 3),
      endedAt: new Date(Date.now() - 3600_000 * 2),
      durationSecs: 3600,
    },
  ];

  for (const stream of sampleStreams) {
    await prisma.stream.upsert({
      where: { id: stream.id },
      update: {},
      create: stream,
    });
    console.log(`✅ Sample stream: ${stream.title}`);
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

  await prisma.highlight.upsert({
    where: { id: 'highlight-halo-ctf' },
    update: { videoUrl: HALO_HIGHLIGHT_GCS, pipelineData: haloPipelineData },
    create: {
      id: 'highlight-halo-ctf',
      orgId: demoOrg.id,
      streamId: 'stream-halo-ctf',
      title: 'Halo Infinite CTF — Best Moments',
      videoUrl: HALO_HIGHLIGHT_GCS,
      duration: 75,
      status: 'COMPLETED',
      pipelineData: haloPipelineData,
    },
  });
  console.log('✅ Halo highlight (COMPLETED with pipeline data)');

  await prisma.highlight.upsert({
    where: { id: 'highlight-processing' },
    update: {},
    create: {
      id: 'highlight-processing',
      orgId: demoOrg.id,
      streamId: 'stream-sample-001',
      title: 'Highlights: Epic Breakout Session',
      status: 'PROCESSING',
    },
  });
  console.log('✅ Processing highlight (demo state)');

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
