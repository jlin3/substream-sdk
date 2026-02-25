/**
 * Zod validation schemas for API request bodies.
 */

import { z } from 'zod';

export const WebPublishStartSchema = z.object({
  streamerId: z.string().min(1).max(255).optional(),
  childId: z.string().min(1).max(255).optional(),
  title: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  appId: z.string().uuid().optional(),
}).refine(
  (d) => d.streamerId || d.childId,
  { message: 'streamerId (or childId) is required' },
);

export const WebPublishStopSchema = z.object({
  streamId: z.string().uuid(),
});

export const WhipStartSchema = z.object({
  streamerId: z.string().min(1).max(255).optional(),
  childId: z.string().min(1).max(255).optional(),
}).refine(
  (d) => d.streamerId || d.childId,
  { message: 'streamerId (or childId) is required' },
);

export const WhipStopSchema = z.object({
  streamId: z.string().uuid(),
});

export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
});

export const CreateAppSchema = z.object({
  name: z.string().min(1).max(100),
  allowedOrigins: z.array(z.string().url()).max(20).optional(),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const WebhookRegisterSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'stream.started',
    'stream.stopped',
    'viewer.joined',
    'viewer.left',
  ])).min(1).optional(),
  secret: z.string().min(16).optional(),
  description: z.string().max(200).optional(),
  appId: z.string().uuid().optional(),
});

export const HeartbeatSchema = z.object({
  currentBitrateKbps: z.number().int().min(0).optional(),
  currentViewers: z.number().int().min(0).optional(),
  streamHealth: z.enum(['healthy', 'degraded', 'poor']).optional(),
});

/**
 * Parse and validate a request body with a zod schema.
 * Returns { data } on success, { error } on failure.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { data: T; error?: never } | { data?: never; error: string } {
  const result = schema.safeParse(body);
  if (result.success) return { data: result.data };

  const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return { error: messages.join('; ') };
}
