/**
 * Seed test data for demo purposes
 * Run: npx tsx scripts/seed-test-data.ts
 */

import { prisma } from '../src/lib/prisma';

async function seed() {
  console.log('🌱 Seeding test data...\n');

  // Create test child user
  const childUser = await prisma.user.upsert({
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
  console.log('✅ Created child user:', childUser.id);

  // Create child profile
  const childProfile = await prisma.childProfile.upsert({
    where: { userId: childUser.id },
    update: {},
    create: {
      id: 'test-child-id',
      userId: childUser.id,
      streamingEnabled: true,
      maxStreamDuration: 120,
    },
  });
  console.log('✅ Created child profile:', childProfile.id);

  // Create test parent user
  const parentUser = await prisma.user.upsert({
    where: { email: 'test-parent@example.com' },
    update: {},
    create: {
      id: 'test-parent-user-id',
      email: 'test-parent@example.com',
      role: 'PARENT',
      displayName: 'Test Parent',
    },
  });
  console.log('✅ Created parent user:', parentUser.id);

  // Create parent profile
  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      id: 'test-parent-id',
      userId: parentUser.id,
      notificationsEnabled: true,
    },
  });
  console.log('✅ Created parent profile:', parentProfile.id);

  // Link parent to child
  await prisma.parentChildRelation.upsert({
    where: {
      parentId_childId: {
        parentId: parentProfile.id,
        childId: childProfile.id,
      },
    },
    update: {},
    create: {
      id: 'test-relation-id',
      parentId: parentProfile.id,
      childId: childProfile.id,
      canWatch: true,
      canViewVods: true,
    },
  });
  console.log('✅ Linked parent to child\n');

  console.log('📋 Test IDs for API calls:');
  console.log('   Child ID:  test-child-id');
  console.log('   User ID:   test-user-id (for Authorization header)');
  console.log('   Parent ID: test-parent-user-id (for playback)');
  console.log('\n🎉 Seed complete!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
