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

  // Sample completed streams with recordings
  const sampleStreams = [
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
    {
      id: 'stream-sample-002',
      orgId: demoOrg.id,
      streamerId: 'demo-child-001',
      streamerName: 'Demo Streamer',
      title: 'Late Night Gaming',
      status: 'RECORDED' as const,
      startedAt: new Date(Date.now() - 86400_000),
      endedAt: new Date(Date.now() - 86400_000 + 2700_000),
      durationSecs: 2700,
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
