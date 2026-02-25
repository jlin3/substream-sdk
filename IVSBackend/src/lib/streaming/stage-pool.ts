/**
 * Stage Pool Allocator for IVS Real-Time
 *
 * Pre-creates stages to handle burst creation requests.
 * CreateStage API is rate-limited to 5 TPS, so if many players hit "Go Live"
 * simultaneously, we need a pool of ready stages.
 *
 * State is stored in Redis so that multiple server instances share the same
 * pool. Falls back to in-memory Maps when Redis is unavailable.
 */

import {
  createStage,
  deleteStage,
  listStages,
  createParticipantToken,
} from './ivs-realtime-client';
import { redis, isRedisAvailable } from '../redis';

// ============================================
// TYPES
// ============================================

export interface PooledStage {
  arn: string;
  name: string;
  createdAt: Date;
  inUse: boolean;
  streamId?: string;
  allocatedAt?: Date;
}

export interface StageAllocation {
  stageArn: string;
  stageName: string;
  publishToken: string;
  participantId: string;
  expiresAt: Date;
  whipUrl: string;
  region: string;
}

export interface SubscribeAllocation {
  stageArn: string;
  subscribeToken: string;
  participantId: string;
  expiresAt: Date;
  region: string;
}

export interface StagePoolConfig {
  targetPoolSize: number;
  maxPoolSize: number;
  stagePrefix: string;
  region: string;
  replenishInterval: number;
  stageMaxAge: number;
}

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG: StagePoolConfig = {
  targetPoolSize: parseInt(process.env.STAGE_POOL_TARGET || '50', 10),
  maxPoolSize: parseInt(process.env.STAGE_POOL_MAX || '500', 10),
  stagePrefix: 'substream',
  region: process.env.AWS_REGION || 'us-east-1',
  replenishInterval: 30000,
  stageMaxAge: 3600000,
};

const WHIP_GLOBAL_ENDPOINT = 'https://global.whip.live-video.net';

const REDIS_KEY = {
  available: 'stagepool:available',  // sorted set: arn -> createdAt timestamp
  inUse: 'stagepool:inuse',          // hash: arn -> JSON { streamId, allocatedAt }
  lock: 'stagepool:replenish-lock',
};

// ============================================
// IN-MEMORY FALLBACK
// ============================================

const memPool: Map<string, PooledStage> = new Map();

// ============================================
// STAGE POOL CLASS
// ============================================

class StagePoolAllocator {
  private config: StagePoolConfig;
  private replenishTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private useRedis = false;

  constructor(config: Partial<StagePoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.useRedis = await isRedisAvailable();
    console.log(`[StagePool] Redis ${this.useRedis ? 'connected' : 'unavailable — using memory fallback'}`);

    await this.loadExistingStages();
    this.startReplenishLoop();
    this.initialized = true;
    console.log(`[StagePool] Initialized — ${await this.getAvailableCount()} available stages`);
  }

  // ----------------------------------------
  // STORAGE ABSTRACTION
  // ----------------------------------------

  private async addAvailable(arn: string, name: string): Promise<void> {
    const now = Date.now();
    if (this.useRedis) {
      await redis.zadd(REDIS_KEY.available, now, JSON.stringify({ arn, name, createdAt: now }));
    } else {
      memPool.set(arn, { arn, name, createdAt: new Date(now), inUse: false });
    }
  }

  private async popAvailable(): Promise<{ arn: string; name: string } | null> {
    if (this.useRedis) {
      const results = await redis.zpopmin(REDIS_KEY.available, 1);
      if (results.length < 2) return null;
      try { return JSON.parse(results[0]); } catch { return null; }
    } else {
      for (const [, stage] of memPool) {
        if (!stage.inUse) {
          memPool.delete(stage.arn);
          return { arn: stage.arn, name: stage.name };
        }
      }
      return null;
    }
  }

  private async markInUse(arn: string, streamId: string): Promise<void> {
    if (this.useRedis) {
      await redis.hset(REDIS_KEY.inUse, arn, JSON.stringify({ streamId, allocatedAt: Date.now() }));
    } else {
      const existing = memPool.get(arn);
      if (existing) {
        existing.inUse = true;
        existing.streamId = streamId;
        existing.allocatedAt = new Date();
      } else {
        memPool.set(arn, { arn, name: '', createdAt: new Date(), inUse: true, streamId, allocatedAt: new Date() });
      }
    }
  }

  private async removeInUse(arn: string): Promise<void> {
    if (this.useRedis) {
      await redis.hdel(REDIS_KEY.inUse, arn);
    } else {
      memPool.delete(arn);
    }
  }

  private async findArnByStreamId(streamId: string): Promise<{ arn: string } | null> {
    if (this.useRedis) {
      const all = await redis.hgetall(REDIS_KEY.inUse);
      for (const [arn, json] of Object.entries(all)) {
        try {
          const data = JSON.parse(json);
          if (data.streamId === streamId) return { arn };
        } catch { continue; }
      }
      return null;
    } else {
      for (const stage of memPool.values()) {
        if (stage.streamId === streamId) return { arn: stage.arn };
      }
      return null;
    }
  }

  async getAvailableCount(): Promise<number> {
    if (this.useRedis) return redis.zcard(REDIS_KEY.available);
    let count = 0;
    for (const s of memPool.values()) { if (!s.inUse) count++; }
    return count;
  }

  private async getInUseCount(): Promise<number> {
    if (this.useRedis) return redis.hlen(REDIS_KEY.inUse);
    let count = 0;
    for (const s of memPool.values()) { if (s.inUse) count++; }
    return count;
  }

  // ----------------------------------------
  // POOL OPERATIONS
  // ----------------------------------------

  private async loadExistingStages(): Promise<void> {
    try {
      const stages = await listStages();
      for (const stage of stages) {
        if (stage.name.startsWith(this.config.stagePrefix)) {
          const inUse = !!stage.activeSessionId;
          if (inUse) {
            await this.markInUse(stage.arn, stage.tags?.streamId || 'unknown');
          } else {
            await this.addAvailable(stage.arn, stage.name);
          }
        }
      }
    } catch (error) {
      console.error('[StagePool] Error loading existing stages:', error);
    }
  }

  private startReplenishLoop(): void {
    if (this.replenishTimer) return;
    this.replenishTimer = setInterval(() => this.replenish(), this.config.replenishInterval);
    this.replenish();
  }

  stopReplenishLoop(): void {
    if (this.replenishTimer) {
      clearInterval(this.replenishTimer);
      this.replenishTimer = null;
    }
  }

  private async replenish(): Promise<void> {
    // Distributed lock: only one instance replenishes at a time
    if (this.useRedis) {
      const acquired = await redis.set(REDIS_KEY.lock, '1', 'EX', 60, 'NX');
      if (!acquired) return;
    }

    try {
      const available = await this.getAvailableCount();
      const inUse = await this.getInUseCount();
      const total = available + inUse;

      const toCreate = Math.min(
        this.config.targetPoolSize - available,
        this.config.maxPoolSize - total,
        5,
      );

      if (toCreate > 0) {
        console.log(`[StagePool] Creating ${toCreate} stages (available: ${available}, target: ${this.config.targetPoolSize})`);
        for (let i = 0; i < toCreate; i++) {
          try {
            await this.createPoolStage();
            await new Promise((r) => setTimeout(r, 250));
          } catch (error) {
            console.error('[StagePool] Error creating stage:', error);
            break;
          }
        }
      }

      await this.cleanupOldStages();
    } finally {
      if (this.useRedis) {
        await redis.del(REDIS_KEY.lock).catch(() => {});
      }
    }
  }

  private async createPoolStage(): Promise<{ arn: string; name: string }> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const name = `${this.config.stagePrefix}-${timestamp}-${random}`;

    const stage = await createStage({
      name,
      tags: { pool: 'true', createdAt: new Date().toISOString() },
    });

    await this.addAvailable(stage.arn, stage.name);
    return { arn: stage.arn, name: stage.name };
  }

  private async cleanupOldStages(): Promise<void> {
    if (!this.useRedis) {
      const now = Date.now();
      const toDelete: string[] = [];
      for (const [arn, stage] of memPool.entries()) {
        if (!stage.inUse && now - stage.createdAt.getTime() > this.config.stageMaxAge) {
          toDelete.push(arn);
        }
      }
      for (const arn of toDelete.slice(0, 3)) {
        try { await deleteStage(arn); memPool.delete(arn); } catch {}
      }
      return;
    }

    const cutoff = Date.now() - this.config.stageMaxAge;
    const old = await redis.zrangebyscore(REDIS_KEY.available, '-inf', cutoff, 'LIMIT', 0, 3);
    for (const json of old) {
      try {
        const { arn } = JSON.parse(json);
        await deleteStage(arn);
        await redis.zrem(REDIS_KEY.available, json);
      } catch {}
    }
  }

  // ----------------------------------------
  // PUBLIC API
  // ----------------------------------------

  async allocate(streamId: string, userId: string, streamerId: string): Promise<StageAllocation> {
    if (!this.initialized) await this.initialize();

    let stage = await this.popAvailable();

    if (!stage) {
      console.log('[StagePool] Pool empty — creating on-demand');
      stage = await this.createPoolStage();
      // Re-pop since createPoolStage adds to available set
      const popped = await this.popAvailable();
      if (popped) stage = popped;
    }

    await this.markInUse(stage.arn, streamId);

    let tokenResponse;
    try {
      tokenResponse = await createParticipantToken({
        stageArn: stage.arn,
        userId,
        capabilities: ['PUBLISH'],
        duration: 60,
        attributes: { role: 'publisher', streamerId, streamId },
      });
    } catch (error) {
      await this.removeInUse(stage.arn);
      await this.addAvailable(stage.arn, stage.name);
      throw error;
    }

    return {
      stageArn: stage.arn,
      stageName: stage.name,
      publishToken: tokenResponse.token,
      participantId: tokenResponse.participantId,
      expiresAt: tokenResponse.expirationTime,
      whipUrl: WHIP_GLOBAL_ENDPOINT,
      region: this.config.region,
    };
  }

  async createSubscribeToken(
    stageArn: string,
    userId: string,
    streamId: string,
  ): Promise<SubscribeAllocation> {
    const tokenResponse = await createParticipantToken({
      stageArn,
      userId,
      capabilities: ['SUBSCRIBE'],
      duration: 60,
      attributes: { role: 'viewer', streamId },
    });

    return {
      stageArn,
      subscribeToken: tokenResponse.token,
      participantId: tokenResponse.participantId,
      expiresAt: tokenResponse.expirationTime,
      region: this.config.region,
    };
  }

  async release(stageArn: string): Promise<void> {
    try {
      await deleteStage(stageArn);
    } catch (error) {
      console.error(`[StagePool] Error deleting stage ${stageArn}:`, error);
    }
    await this.removeInUse(stageArn);
    this.replenish().catch(() => {});
  }

  findByStreamId(streamId: string): Promise<{ arn: string } | null> {
    return this.findArnByStreamId(streamId);
  }

  async getStatus(): Promise<{ available: number; inUse: number; total: number }> {
    const available = await this.getAvailableCount();
    const inUse = await this.getInUseCount();
    return { available, inUse, total: available + inUse };
  }

  async shutdown(): Promise<void> {
    this.stopReplenishLoop();
    this.initialized = false;
  }
}

// ============================================
// SINGLETON
// ============================================

let poolInstance: StagePoolAllocator | null = null;

function getStagePool(): StagePoolAllocator {
  if (!poolInstance) {
    poolInstance = new StagePoolAllocator();
  }
  return poolInstance;
}

export async function initializeStagePool(): Promise<void> {
  const pool = getStagePool();
  await pool.initialize();
}

export async function allocateStage(
  streamId: string,
  userId: string,
  streamerId: string,
): Promise<StageAllocation> {
  return getStagePool().allocate(streamId, userId, streamerId);
}

export async function createSubscribeTokenForStream(
  stageArn: string,
  userId: string,
  streamId: string,
): Promise<SubscribeAllocation> {
  return getStagePool().createSubscribeToken(stageArn, userId, streamId);
}

export async function releaseStage(stageArn: string): Promise<void> {
  return getStagePool().release(stageArn);
}

export function getStagePoolStatus(): Promise<{ available: number; inUse: number; total: number }> {
  return getStagePool().getStatus();
}

export async function findStageByStreamId(streamId: string): Promise<PooledStage | null> {
  const result = await getStagePool().findByStreamId(streamId);
  if (!result) return null;
  return { arn: result.arn, name: '', createdAt: new Date(), inUse: true, streamId };
}
