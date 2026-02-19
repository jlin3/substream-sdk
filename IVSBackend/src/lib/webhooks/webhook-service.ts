/**
 * Webhook Service
 *
 * Manages webhook registrations and dispatches events with retry logic.
 * Uses an in-memory store for v1; move to Prisma model for persistence
 * across deploys.
 *
 * Supported events:
 *   stream.started  - game starts publishing
 *   stream.stopped  - game stops publishing
 *   viewer.joined   - parent connects to watch
 *   viewer.left     - parent disconnects
 */

import { createHmac, randomUUID } from 'crypto';

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
// IN-MEMORY STORE
// ============================================

const registrations = new Map<string, WebhookRegistration>();
const recentDeliveries: DeliveryAttempt[] = [];
const MAX_DELIVERY_LOG = 200;

// ============================================
// REGISTRATION CRUD
// ============================================

export function registerWebhook(opts: {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  description?: string;
}): WebhookRegistration {
  const id = randomUUID();
  const secret = opts.secret || randomUUID().replace(/-/g, '');

  const reg: WebhookRegistration = {
    id,
    url: opts.url,
    secret,
    events: opts.events,
    createdAt: new Date().toISOString(),
    description: opts.description,
  };

  registrations.set(id, reg);
  console.log(`[Webhooks] Registered ${id} -> ${opts.url} for [${opts.events.join(', ')}]`);
  return reg;
}

export function listWebhooks(): WebhookRegistration[] {
  return Array.from(registrations.values());
}

export function getWebhook(id: string): WebhookRegistration | undefined {
  return registrations.get(id);
}

export function deleteWebhook(id: string): boolean {
  const existed = registrations.delete(id);
  if (existed) console.log(`[Webhooks] Deleted ${id}`);
  return existed;
}

// ============================================
// DISPATCH
// ============================================

const RETRY_DELAYS_MS = [0, 2_000, 10_000]; // immediate, 2s, 10s
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Fire a webhook event to all matching registrations.
 * Dispatch is non-blocking -- callers don't wait for delivery.
 */
export function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>,
): void {
  const matching = Array.from(registrations.values()).filter(r =>
    r.events.includes(event),
  );

  if (matching.length === 0) return;

  const payload: WebhookPayload = {
    id: randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  console.log(`[Webhooks] Dispatching ${event} (${payload.id}) to ${matching.length} endpoint(s)`);

  for (const reg of matching) {
    deliverWithRetry(reg, payload).catch(err => {
      console.error(`[Webhooks] Delivery failed permanently for ${reg.id}:`, err);
    });
  }
}

async function deliverWithRetry(
  reg: WebhookRegistration,
  payload: WebhookPayload,
): Promise<void> {
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) await sleep(delay);

    const result = await attemptDelivery(reg, payload, attempt + 1);
    if (result.success) return;
  }
}

async function attemptDelivery(
  reg: WebhookRegistration,
  payload: WebhookPayload,
  attempt: number,
): Promise<{ success: boolean }> {
  const body = JSON.stringify(payload);
  const signature = sign(body, reg.secret);

  const record: DeliveryAttempt = {
    webhookId: reg.id,
    payloadId: payload.id,
    attempt,
    status: null,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const resp = await fetch(reg.url, {
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

    if (resp.ok) {
      logDelivery(record);
      return { success: true };
    }

    record.error = `HTTP ${resp.status}`;
    logDelivery(record);
    console.warn(`[Webhooks] ${reg.url} returned ${resp.status} (attempt ${attempt})`);
    return { success: false };
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
    logDelivery(record);
    console.warn(`[Webhooks] ${reg.url} delivery error (attempt ${attempt}): ${record.error}`);
    return { success: false };
  }
}

// ============================================
// SIGNING
// ============================================

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Verify a webhook signature (for consumers to validate payloads).
 * Exported so integrators can use the same logic.
 */
export function verifySignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = sign(body, secret);
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
  if (webhookId) {
    return recentDeliveries.filter(d => d.webhookId === webhookId);
  }
  return [...recentDeliveries];
}

// ============================================
// UTILS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
