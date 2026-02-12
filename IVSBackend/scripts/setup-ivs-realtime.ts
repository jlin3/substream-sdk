#!/usr/bin/env tsx
/**
 * Setup script for IVS Real-Time resources
 * 
 * This script creates:
 * 1. An IVS Real-Time Stage (virtual room for WebRTC streaming)
 * 2. An IVS Low-Latency Channel (for HLS output to parents)
 * 3. A Storage Configuration (for S3 recording)
 * 
 * Usage:
 *   pnpm ivs:setup
 * 
 * Prerequisites:
 *   - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 *   - AWS_REGION set (defaults to us-east-1)
 *   - IVS_S3_BUCKET set (for recording)
 */

import 'dotenv/config';
import {
  createStage,
  listStages,
  createStorageConfiguration,
  listStorageConfigurations,
} from '../src/lib/streaming/ivs-realtime-client';
import {
  createChannel,
  listChannels,
} from '../src/lib/streaming/ivs-client';

const STAGE_NAME = 'substream-demo-stage';
const CHANNEL_NAME = 'substream-demo-channel';
const STORAGE_NAME = 'substream-recordings';

async function main() {
  console.log('=== IVS Real-Time Setup ===\n');
  
  // Check AWS credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS credentials not found!');
    console.error('   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
    process.exit(1);
  }
  
  const region = process.env.AWS_REGION || 'us-east-1';
  console.log(`Region: ${region}\n`);
  
  try {
    // 1. Create or find Stage
    console.log('1. Setting up IVS Real-Time Stage...');
    let stageArn: string;
    
    const existingStages = await listStages();
    const existingStage = existingStages.find(s => s.name === STAGE_NAME);
    
    if (existingStage) {
      console.log(`   ✅ Stage already exists: ${existingStage.arn}`);
      stageArn = existingStage.arn;
    } else {
      const stage = await createStage({
        name: STAGE_NAME,
        tags: {
          project: 'substream-sdk',
          environment: 'demo',
        },
      });
      console.log(`   ✅ Stage created: ${stage.arn}`);
      stageArn = stage.arn;
    }
    
    // 2. Create or find IVS Low-Latency Channel (for HLS output)
    console.log('\n2. Setting up IVS Low-Latency Channel (for HLS)...');
    let channelArn: string;
    
    const { channels: existingChannels } = await listChannels();
    const existingChannel = existingChannels.find(c => c.name === CHANNEL_NAME);
    
    if (existingChannel) {
      console.log(`   ✅ Channel already exists: ${existingChannel.arn}`);
      channelArn = existingChannel.arn;
    } else {
      const channel = await createChannel({
        name: CHANNEL_NAME,
        latencyMode: 'LOW',
        type: 'STANDARD',
        tags: {
          project: 'substream-sdk',
          environment: 'demo',
        },
      });
      console.log(`   ✅ Channel created: ${channel.arn}`);
      channelArn = channel.arn;
    }
    
    // 3. Create or find Storage Configuration (for S3 recording)
    console.log('\n3. Setting up Storage Configuration...');
    let storageArn: string | null = null;
    
    const s3Bucket = process.env.IVS_S3_BUCKET;
    if (s3Bucket) {
      const existingConfigs = await listStorageConfigurations();
      const existingConfig = existingConfigs.find(c => c.name === STORAGE_NAME);
      
      if (existingConfig) {
        console.log(`   ✅ Storage config already exists: ${existingConfig.arn}`);
        storageArn = existingConfig.arn || null;
      } else {
        const config = await createStorageConfiguration(STORAGE_NAME, s3Bucket);
        console.log(`   ✅ Storage config created: ${config.arn}`);
        storageArn = config.arn || null;
      }
    } else {
      console.log('   ⚠️  IVS_S3_BUCKET not set - recording disabled');
      console.log('      To enable recording, set IVS_S3_BUCKET in .env');
    }
    
    // Output configuration
    console.log('\n=== Configuration Complete ===\n');
    console.log('Add these to your .env file:\n');
    console.log(`IVS_STAGE_ARN=${stageArn}`);
    console.log(`IVS_CHANNEL_ARN=${channelArn}`);
    if (storageArn) {
      console.log(`IVS_STORAGE_ARN=${storageArn}`);
    }
    
    console.log('\n=== Next Steps ===\n');
    console.log('1. Add the above environment variables to Railway');
    console.log('2. Run the database seed to set up demo users:');
    console.log('   pnpm db:seed');
    console.log('3. Deploy to Railway');
    console.log('4. Test with Unity!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
