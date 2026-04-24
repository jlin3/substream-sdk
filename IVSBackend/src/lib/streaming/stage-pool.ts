/**
 * Stage Pool Allocator for IVS Real-Time
 * 
 * Pre-creates stages to handle burst creation requests.
 * CreateStage API is rate-limited to 5 TPS, so if many kids hit "Go Live"
 * simultaneously, we need a pool of ready stages.
 * 
 * Strategy:
 * 1. Maintain a pool of pre-created stages
 * 2. On allocation request, pop from pool and tag with streamId
 * 3. On release, delete stage and async create replacement
 * 4. Background job maintains pool at target size
 */

import {
  createStage,
  deleteStage,
  listStages,
  createParticipantToken,
  type IVSStage,
  type IVSParticipantTokenResponse,
} from './ivs-realtime-client';

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
  targetPoolSize: number;       // Number of stages to keep ready
  maxPoolSize: number;          // Maximum stages to create
  stagePrefix: string;          // Prefix for stage names
  region: string;               // AWS region
  replenishInterval: number;    // ms between replenish checks
  stageMaxAge: number;          // ms before unused stage is recycled
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: StagePoolConfig = {
  targetPoolSize: 50,           // Keep 50 stages ready
  maxPoolSize: 200,             // Don't exceed 200 stages in pool
  stagePrefix: 'kid-stream',
  region: process.env.AWS_REGION || 'us-east-1',
  replenishInterval: 30000,     // Check every 30 seconds
  stageMaxAge: 3600000,         // Recycle unused stages after 1 hour
};

// ============================================
// GLOBAL WHIP ENDPOINT
// ============================================

// AWS IVS WHIP global endpoint - handles 307 redirects to regional endpoints
const WHIP_GLOBAL_ENDPOINT = 'https://global.whip.live-video.net';

// ============================================
// ERROR CLASSIFIERS
// ============================================

/**
 * Detect errors from AWS SDK that indicate the stage ARN no longer exists.
 * Covers both the typed `ResourceNotFoundException` name and the string
 * form ("Resource: arn:... not found") some code paths surface.
 */
function isStageGoneError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ResourceNotFoundException') return true;
  const msg = error.message || '';
  return /Resource:.*not found/i.test(msg) || /no resource found/i.test(msg);
}

// ============================================
// STAGE POOL CLASS
// ============================================

class StagePoolAllocator {
  private pool: Map<string, PooledStage> = new Map();
  private config: StagePoolConfig;
  private replenishTimer: NodeJS.Timeout | null = null;
  private isReplenishing: boolean = false;
  private initialized: boolean = false;

  constructor(config: Partial<StagePoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the pool by loading existing stages and starting replenish loop
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[StagePool] Initializing stage pool...');
    
    // Load existing pool stages from AWS
    await this.loadExistingStages();
    
    // Start background replenish loop
    this.startReplenishLoop();
    
    this.initialized = true;
    console.log(`[StagePool] Initialized with ${this.getAvailableCount()} available stages`);
  }

  /**
   * Load existing stages that match our prefix (from previous runs)
   */
  private async loadExistingStages(): Promise<void> {
    try {
      const stages = await listStages();
      
      for (const stage of stages) {
        if (stage.name.startsWith(this.config.stagePrefix)) {
          // Check if stage is in use (has active session)
          const inUse = !!stage.activeSessionId;
          
          this.pool.set(stage.arn, {
            arn: stage.arn,
            name: stage.name,
            createdAt: new Date(), // Unknown, use now
            inUse,
            streamId: stage.tags?.streamId,
            allocatedAt: inUse ? new Date() : undefined,
          });
        }
      }
      
      console.log(`[StagePool] Loaded ${this.pool.size} existing stages`);
    } catch (error) {
      console.error('[StagePool] Error loading existing stages:', error);
    }
  }

  /**
   * Start the background replenish loop
   */
  private startReplenishLoop(): void {
    if (this.replenishTimer) {
      return;
    }

    this.replenishTimer = setInterval(async () => {
      await this.replenish();
    }, this.config.replenishInterval);

    // Also run immediately
    this.replenish();
  }

  /**
   * Stop the background replenish loop
   */
  stopReplenishLoop(): void {
    if (this.replenishTimer) {
      clearInterval(this.replenishTimer);
      this.replenishTimer = null;
    }
  }

  /**
   * Replenish the pool to target size
   */
  private async replenish(): Promise<void> {
    if (this.isReplenishing) {
      return;
    }

    this.isReplenishing = true;

    try {
      const availableCount = this.getAvailableCount();
      const totalCount = this.pool.size;
      
      // Clean up old unused stages
      await this.cleanupOldStages();
      
      // Create new stages if below target
      const toCreate = Math.min(
        this.config.targetPoolSize - availableCount,
        this.config.maxPoolSize - totalCount,
        5 // Create max 5 at a time to stay under rate limit
      );

      if (toCreate > 0) {
        console.log(`[StagePool] Creating ${toCreate} new stages (available: ${availableCount}, target: ${this.config.targetPoolSize})`);
        
        // Create stages sequentially to respect rate limit
        for (let i = 0; i < toCreate; i++) {
          try {
            await this.createPoolStage();
            // Small delay between creates to avoid rate limit
            await new Promise(resolve => setTimeout(resolve, 250));
          } catch (error) {
            console.error('[StagePool] Error creating stage:', error);
            break; // Stop if we hit rate limit
          }
        }
      }
    } finally {
      this.isReplenishing = false;
    }
  }

  /**
   * Create a new stage for the pool
   */
  private async createPoolStage(): Promise<PooledStage> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const name = `${this.config.stagePrefix}-${timestamp}-${random}`;

    const stage = await createStage({
      name,
      tags: {
        pool: 'true',
        createdAt: new Date().toISOString(),
      },
    });

    const pooledStage: PooledStage = {
      arn: stage.arn,
      name: stage.name,
      createdAt: new Date(),
      inUse: false,
    };

    this.pool.set(stage.arn, pooledStage);
    console.log(`[StagePool] Created stage: ${stage.name}`);
    
    return pooledStage;
  }

  /**
   * Clean up old unused stages to prevent stale pool
   */
  private async cleanupOldStages(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [arn, stage] of this.pool.entries()) {
      if (!stage.inUse) {
        const age = now - stage.createdAt.getTime();
        if (age > this.config.stageMaxAge) {
          toDelete.push(arn);
        }
      }
    }

    // Delete old stages (max 3 at a time)
    for (const arn of toDelete.slice(0, 3)) {
      try {
        await deleteStage(arn);
        this.pool.delete(arn);
        console.log(`[StagePool] Deleted old stage: ${arn}`);
      } catch (error) {
        console.error(`[StagePool] Error deleting stage ${arn}:`, error);
      }
    }
  }

  /**
   * Get count of available (not in use) stages
   */
  getAvailableCount(): number {
    let count = 0;
    for (const stage of this.pool.values()) {
      if (!stage.inUse) count++;
    }
    return count;
  }

  /**
   * Get total pool size
   */
  getTotalCount(): number {
    return this.pool.size;
  }

  /**
   * Get pool status
   */
  getStatus(): { available: number; inUse: number; total: number } {
    let available = 0;
    let inUse = 0;
    
    for (const stage of this.pool.values()) {
      if (stage.inUse) {
        inUse++;
      } else {
        available++;
      }
    }
    
    return { available, inUse, total: this.pool.size };
  }

  /**
   * Allocate a stage for a new stream
   * Returns WHIP connection info and publish token.
   *
   * Stages may be stale — AWS garbage-collects idle stages, and previous
   * process instances may have registered ARNs that no longer exist. When
   * `createParticipantToken` returns `ResourceNotFoundException` we:
   *   1. Evict the stale entry from the local pool (it's gone from AWS).
   *   2. Retry with the next available stage.
   *   3. If we exhaust the pool, create a fresh stage on-demand.
   *
   * `maxStaleAttempts` bounds the retry loop so a pool full of stale entries
   * eventually falls back to creating a brand-new stage instead of spinning.
   */
  async allocate(
    streamId: string,
    userId: string,
    childId: string
  ): Promise<StageAllocation> {
    // Ensure pool is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const maxStaleAttempts = 6;
    let staleSeen = 0;

    while (true) {
      // Find an available stage, or create one on-demand
      let stage = this.findAvailableStage();
      if (!stage) {
        console.log('[StagePool] No available stages, creating on-demand');
        stage = await this.createPoolStage();
      }

      // Mark as in use
      stage.inUse = true;
      stage.streamId = streamId;
      stage.allocatedAt = new Date();

      // Try to mint a publish token. If AWS reports the stage is gone,
      // evict and retry; otherwise rollback and rethrow.
      try {
        const tokenResponse = await createParticipantToken({
          stageArn: stage.arn,
          userId,
          capabilities: ['PUBLISH'],
          duration: 60,
          attributes: { role: 'publisher', childId, streamId },
        });

        console.log(`[StagePool] Allocated stage ${stage.name} for stream ${streamId}`);
        return {
          stageArn: stage.arn,
          stageName: stage.name,
          publishToken: tokenResponse.token,
          participantId: tokenResponse.participantId,
          expiresAt: tokenResponse.expirationTime,
          whipUrl: WHIP_GLOBAL_ENDPOINT,
          region: this.config.region,
        };
      } catch (error) {
        if (isStageGoneError(error) && staleSeen < maxStaleAttempts) {
          staleSeen++;
          console.warn(
            `[StagePool] Stage ${stage.name} is gone from AWS, evicting and retrying (${staleSeen}/${maxStaleAttempts})`,
          );
          this.pool.delete(stage.arn);
          // Replenish in the background so the pool heals faster.
          this.replenish().catch(err => console.error('[StagePool] Replenish after eviction failed:', err));
          continue;
        }

        // Non-recoverable — rollback the allocation and rethrow.
        console.error(`[StagePool] Token creation failed, rolling back stage ${stage.name}:`, error);
        stage.inUse = false;
        stage.streamId = undefined;
        stage.allocatedAt = undefined;
        throw error;
      }
    }
  }

  /**
   * Find the first available stage in the pool, or `null` if none.
   */
  private findAvailableStage(): PooledStage | null {
    for (const s of this.pool.values()) {
      if (!s.inUse) return s;
    }
    return null;
  }

  /**
   * Create a subscribe token for a viewer (parent)
   */
  async createSubscribeToken(
    stageArn: string,
    userId: string,
    streamId: string
  ): Promise<SubscribeAllocation> {
    const tokenResponse = await createParticipantToken({
      stageArn,
      userId,
      capabilities: ['SUBSCRIBE'],
      duration: 60, // 1 hour
      attributes: {
        role: 'viewer',
        streamId,
      },
    });

    return {
      stageArn,
      subscribeToken: tokenResponse.token,
      participantId: tokenResponse.participantId,
      expiresAt: tokenResponse.expirationTime,
      region: this.config.region,
    };
  }

  /**
   * Release a stage back to the pool (after stream ends)
   * AWS recommends deleting stages after use to avoid quota issues.
   *
   * If AWS reports the stage is already gone, treat that as success —
   * we just need to drop it from the local pool.
   */
  async release(stageArn: string): Promise<void> {
    const stage = this.pool.get(stageArn);

    if (!stage) {
      console.warn(`[StagePool] Attempted to release unknown stage: ${stageArn}`);
      return;
    }

    console.log(`[StagePool] Releasing stage ${stage.name}`);

    try {
      await deleteStage(stageArn);
      this.pool.delete(stageArn);
      console.log(`[StagePool] Deleted stage ${stage.name}`);
    } catch (error) {
      if (isStageGoneError(error)) {
        console.warn(`[StagePool] Stage ${stage.name} already gone on AWS; dropping from pool`);
        this.pool.delete(stageArn);
      } else {
        console.error(`[StagePool] Error deleting stage ${stageArn}:`, error);
        // Mark as not in use so it can be reused or cleaned up later
        stage.inUse = false;
        stage.streamId = undefined;
        stage.allocatedAt = undefined;
      }
    }

    // Trigger async replenish to maintain pool size
    this.replenish().catch(console.error);
  }

  /**
   * Drop any stages from the local pool that don't actually exist on AWS.
   * Called once at init and can be called periodically as a safety net.
   */
  async pruneStaleStages(): Promise<number> {
    let pruned = 0;
    for (const [arn, stage] of [...this.pool.entries()]) {
      // Skip stages that are currently in use — we don't want to pull the
      // rug out from under a live stream. Stale in-use stages will be
      // detected the next time someone tries to allocate.
      if (stage.inUse) continue;

      try {
        const token = await createParticipantToken({
          stageArn: arn,
          userId: '__healthcheck',
          capabilities: ['SUBSCRIBE'],
          duration: 1,
          attributes: { role: 'healthcheck' },
        });
        // Token minted fine; the stage exists. Nothing to do.
        void token;
      } catch (error) {
        if (isStageGoneError(error)) {
          this.pool.delete(arn);
          pruned++;
          console.warn(`[StagePool] Pruned stale stage ${stage.name}`);
        }
      }
    }
    return pruned;
  }

  /**
   * Find stage by stream ID
   */
  findByStreamId(streamId: string): PooledStage | null {
    for (const stage of this.pool.values()) {
      if (stage.streamId === streamId) {
        return stage;
      }
    }
    return null;
  }

  /**
   * Shutdown the pool (cleanup)
   */
  async shutdown(): Promise<void> {
    console.log('[StagePool] Shutting down...');
    this.stopReplenishLoop();
    
    // Note: We don't delete all stages on shutdown as they may still be in use
    // The cleanup job will handle old stages on next startup
    
    this.initialized = false;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let poolInstance: StagePoolAllocator | null = null;

/**
 * Get the singleton stage pool instance
 */
export function getStagePool(): StagePoolAllocator {
  if (!poolInstance) {
    poolInstance = new StagePoolAllocator();
  }
  return poolInstance;
}

/**
 * Initialize the stage pool (call on app startup)
 */
export async function initializeStagePool(): Promise<void> {
  const pool = getStagePool();
  await pool.initialize();
}

/**
 * Allocate a stage for a new stream
 */
export async function allocateStage(
  streamId: string,
  userId: string,
  childId: string
): Promise<StageAllocation> {
  const pool = getStagePool();
  return pool.allocate(streamId, userId, childId);
}

/**
 * Create a subscribe token for a viewer
 */
export async function createSubscribeTokenForStream(
  stageArn: string,
  userId: string,
  streamId: string
): Promise<SubscribeAllocation> {
  const pool = getStagePool();
  return pool.createSubscribeToken(stageArn, userId, streamId);
}

/**
 * Release a stage after stream ends
 */
export async function releaseStage(stageArn: string): Promise<void> {
  const pool = getStagePool();
  return pool.release(stageArn);
}

/**
 * Get stage pool status
 */
export function getStagePoolStatus(): { available: number; inUse: number; total: number } {
  const pool = getStagePool();
  return pool.getStatus();
}

/**
 * Find stage by stream ID
 */
export function findStageByStreamId(streamId: string): PooledStage | null {
  const pool = getStagePool();
  return pool.findByStreamId(streamId);
}
