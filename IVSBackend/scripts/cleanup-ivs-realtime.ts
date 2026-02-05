#!/usr/bin/env tsx
/**
 * Cleanup script for IVS Real-Time resources
 * 
 * WARNING: This will delete all IVS Real-Time resources!
 * 
 * Usage:
 *   pnpm ivs:cleanup
 */

import 'dotenv/config';
import {
  listStages,
  deleteStage,
  listStorageConfigurations,
  deleteStorageConfiguration,
  listCompositions,
  stopComposition,
} from '../src/lib/streaming/ivs-realtime-client';
import {
  listChannels,
  deleteChannel,
} from '../src/lib/streaming/ivs-client';

async function main() {
  console.log('=== IVS Real-Time Cleanup ===\n');
  console.log('⚠️  This will delete ALL IVS resources!\n');
  
  // Check AWS credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS credentials not found!');
    process.exit(1);
  }
  
  try {
    // 1. Stop all active compositions
    console.log('1. Stopping active compositions...');
    const compositions = await listCompositions();
    for (const comp of compositions) {
      if (comp.arn && comp.state === 'ACTIVE') {
        console.log(`   Stopping: ${comp.arn}`);
        await stopComposition(comp.arn);
      }
    }
    console.log(`   ✅ Stopped ${compositions.filter(c => c.state === 'ACTIVE').length} compositions`);
    
    // 2. Delete stages
    console.log('\n2. Deleting stages...');
    const stages = await listStages();
    for (const stage of stages) {
      if (stage.name?.startsWith('substream-')) {
        console.log(`   Deleting: ${stage.name}`);
        await deleteStage(stage.arn);
      }
    }
    console.log(`   ✅ Deleted ${stages.filter(s => s.name?.startsWith('substream-')).length} stages`);
    
    // 3. Delete channels
    console.log('\n3. Deleting channels...');
    const { channels } = await listChannels();
    for (const channel of channels) {
      if (channel.name?.startsWith('substream-')) {
        console.log(`   Deleting: ${channel.name}`);
        await deleteChannel(channel.arn);
      }
    }
    console.log(`   ✅ Deleted ${channels.filter(c => c.name?.startsWith('substream-')).length} channels`);
    
    // 4. Delete storage configurations
    console.log('\n4. Deleting storage configurations...');
    const storageConfigs = await listStorageConfigurations();
    for (const config of storageConfigs) {
      if (config.name?.startsWith('substream-')) {
        console.log(`   Deleting: ${config.name}`);
        if (config.arn) {
          await deleteStorageConfiguration(config.arn);
        }
      }
    }
    console.log(`   ✅ Deleted ${storageConfigs.filter(c => c.name?.startsWith('substream-')).length} storage configs`);
    
    console.log('\n=== Cleanup Complete ===\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
