/**
 * Webhook Service
 *
 * Manages webhook registrations (persisted in Postgres) and dispatches
 * events via BullMQ for reliable, retryable delivery. Falls back to
 * in-memory delivery when Redis is unavailable.
 *
 * Supported events:
 *   stream.started  — game starts publishing
 *   stream.stopped  — game stops publishing
 *   viewer.joined   — viewer connects to watch
 *   viewer.left     — viewer disconnects
 */

import { createHmac, randomUUID } from 'crypto';
import { Queue, Worker } from 'bullmq';
import { prisma } from '../prisma';
import { redis, isRedisAvailable } from '../redis';

// ============================================
// TYPES
// ============================================

export type WebhookEvent =
  | 'stream.started'
  | 'stream.stopped'
  | 'viewer.joined'
  | 'viewer.left';

export interface WebhookRegistration {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  createdAt: string;
  description?: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

interface DeliveryAttempt {
  webhookId: string;
  payloadId: string;
  attempt: number;
  status: number | null;
  error?: string;
  timestamp: string;
}

// ============================================
// IN-MEMORY FALLBACK (when Redis is unavailable)
// ============================================

const memRegistrations = new Map<string, WebhookRegistration>();
const recentDeliveries: DeliveryAttempt[] = [];
const MAX_DELIVERY_LOG = 200;

// ============================================
// BULLMQ QUEUE (lazy-initialized)
// ============================================

let webhookQueue: Queue | null = null;
let webhookWorker: Worker | null = null;

async function getQueue(): Promise<Queue | null> {
  if (webhookQueue) return webhookQueue;
  if (!(await isRedisAvailable())) return null;

  webhookQueue = new Queue('webhooks', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });

  webhookWorker = new Worker(
    'webhooks',
    async (job) => {
      const { endpoint, payload } = job.data as {
        endpoint: { id: string; url: string; secretHash: string };
        payload: WebhookPayload;
      };
      await attemptDelivery(endpoint, payload, job.attemptsMade + 1);
    },
    { connection: redis, concurrency: 10 },
  );

  webhookWorker.on('failed', (job, err) => {
    console.warn(`[Webhooks] Job ${job?.id} failed:`, err.message);
  });

  return webhookQueue;
}

// ============================================
// REGISTRATION CRUD (DB-backed + memory fallback)
// ============================================

export async function registerWebhook(opts: {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  description?: string;
  appId?: string;
}): Promise<WebhookRegistration> {
  const id = randomUUID();
  const secret = opts.secret || randomUUID().replace(/-/g, '');

  if (opts.appId) {
    await prisma.webhookEndpoint.create({
      data: {
        id,
        appId: opts.appId,
        url: opts.url,
        secretHash: hashSecret(secret),
        events: opts.events,
        description: opts.description,
      },
    });
  }

  const reg: WebhookRegistration = {
    id,
    url: opts.url,
    secret,
    events: opts.events,
    createdAt: new Date().toISOString(),
    description: opts.description,
  };

  memRegistrations.set(id, reg);
  return reg;
}

function hashSecret(secret: string): string {
  return createHmac('sha256', 'substream-webhook').update(secret).digest('hex');
}

export function listWebhooks(): WebhookRegistration[] {
  return Array.from(memRegistrations.values());
}

export async function listWebhooksForApp(appId: string): Promise<WebhookRegistration[]> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { appId, isActive: true },
  });
  return endpoints.map((e) => ({
    id: e.id,
    url: e.url,
    secret: '***',
    events: e.events as WebhookEvent[],
    createdAt: e.createdAt.toISOString(),
    description: e.description ?? undefined,
  }));
}

export function getWebhook(id: string): WebhookRegistration | undefined {
  return memRegistrations.get(id);
}

export function deleteWebhook(id: string): boolean {
  const existed = memRegistrations.delete(id);
  prisma.webhookEndpoint.update({ where: { id }, data: { isActive: false } }).catch(() => {});
  return existed;
}

// ============================================
// DISPATCH
// ============================================

export function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>,
): void {
  const payload: WebhookPayload = {
    id: randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // In-memory registrations
  const matching = Array.from(memRegistrations.values()).filter((r) =>
    r.events.includes(event),
  );

  if (matching.length > 0) {
    for (const reg of matching) {
      enqueueOrDeliver(
        { id: reg.id, url: reg.url, secretHash: hashSecret(reg.secret) },
        payload,
      );
    }
  }

  // DB-persisted registrations (async, best-effort)
  dispatchToDbEndpoints(event, payload).catch((err) =>
    console.error('[Webhooks] DB dispatch error:', err),
  );
}

async function dispatchToDbEndpoints(event: WebhookEvent, payload: WebhookPayload): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { isActive: true, events: { has: event } },
  });

  for (const ep of endpoints) {
    if (memRegistrations.has(ep.id)) continue; // already dispatched via memory
    enqueueOrDeliver({ id: ep.id, url: ep.url, secretHash: ep.secretHash }, payload);
  }
}

async function enqueueOrDeliver(
  endpoint: { id: string; url: string; secretHash: string },
  payload: WebhookPayload,
): Promise<void> {
  const queue = await getQueue();

  if (queue) {
    await queue.add('deliver', { endpoint, payload });
    return;
  }

  // Fallback: fire-and-forget in memory
  deliverWithRetry(endpoint, payload).catch((err) =>
    console.error(`[Webhooks] Delivery failed for ${endpoint.id}:`, err),
  );
}

// ============================================
// DELIVERY
// ============================================

const RETRY_DELAYS_MS = [0, 2_000, 10_000];
const DELIVERY_TIMEOUT_MS = 10_000;

async function deliverWithRetry(
  endpoint: { id: string; url: string; secretHash: string },
  payload: WebhookPayload,
): Promise<void> {
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) await sleep(delay);
    const result = await attemptDelivery(endpoint, payload, attempt + 1);
    if (result.success) return;
  }
}

async function attemptDelivery(
  endpoint: { id: string; url: string; secretHash: string },
  payload: WebhookPayload,
  attempt: number,
): Promise<{ success: boolean }> {
  const body = JSON.stringify(payload);
  const signature = 'sha256=' + createHmac('sha256', endpoint.secretHash).update(body).digest('hex');

  const record: DeliveryAttempt = {
    webhookId: endpoint.id,
    payloadId: payload.id,
    attempt,
    status: null,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const resp = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Substream-Signature': signature,
        'X-Substream-Event': payload.event,
        'X-Substream-Delivery': payload.id,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);
    record.status = resp.status;

    // Persist delivery record
    prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event: payload.event,
        payloadId: payload.id,
        attempt,
        status: resp.status,
      },
    }).catch(() => {});

    if (resp.ok) {
      logDelivery(record);
      return { success: true };
    }

    record.error = `HTTP ${resp.status}`;
    logDelivery(record);
    return { success: false };
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
    logDelivery(record);

    prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event: payload.event,
        payloadId: payload.id,
        attempt,
        error: record.error,
      },
    }).catch(() => {});

    return { success: false };
  }
}

// ============================================
// SIGNING
// ============================================

export function verifySignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

// ============================================
// DELIVERY LOG
// ============================================

function logDelivery(attempt: DeliveryAttempt): void {
  recentDeliveries.push(attempt);
  if (recentDeliveries.length > MAX_DELIVERY_LOG) {
    recentDeliveries.splice(0, recentDeliveries.length - MAX_DELIVERY_LOG);
  }
}

export function getRecentDeliveries(webhookId?: string): DeliveryAttempt[] {
  if (webhookId) return recentDeliveries.filter((d) => d.webhookId === webhookId);
  return [...recentDeliveries];
}

// ============================================
// UTILS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
