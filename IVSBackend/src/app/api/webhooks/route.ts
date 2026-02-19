/**
 * Webhook Management Endpoints
 *
 * POST   /api/webhooks   - Register a new webhook
 * GET    /api/webhooks   - List registered webhooks
 * DELETE /api/webhooks    - Delete a webhook by id (body: { id })
 *
 * Webhooks receive POST requests with JSON payloads signed via HMAC-SHA256.
 * Include the X-Substream-Signature header to verify authenticity.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  registerWebhook,
  listWebhooks,
  deleteWebhook,
  getRecentDeliveries,
  type WebhookEvent,
} from '@/lib/webhooks/webhook-service';

const VALID_EVENTS: WebhookEvent[] = [
  'stream.started',
  'stream.stopped',
  'viewer.joined',
  'viewer.left',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================
// POST - Register webhook
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url"', code: 'INVALID_PARAMS' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        { error: '"url" must be a valid URL', code: 'INVALID_PARAMS' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const events: WebhookEvent[] = body.events || VALID_EVENTS;
    const invalid = events.filter((e: string) => !VALID_EVENTS.includes(e as WebhookEvent));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid event(s): ${invalid.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`,
          code: 'INVALID_PARAMS',
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const reg = registerWebhook({
      url: body.url,
      events: events as WebhookEvent[],
      secret: body.secret,
      description: body.description,
    });

    return NextResponse.json(
      {
        id: reg.id,
        url: reg.url,
        secret: reg.secret,
        events: reg.events,
        createdAt: reg.createdAt,
        description: reg.description,
        _note: 'Store the "secret" securely. It is used to verify webhook signatures via HMAC-SHA256.',
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[Webhooks API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// ============================================
// GET - List webhooks
// ============================================

export async function GET() {
  const hooks = listWebhooks().map(h => ({
    id: h.id,
    url: h.url,
    events: h.events,
    createdAt: h.createdAt,
    description: h.description,
  }));

  const deliveries = getRecentDeliveries().slice(-20);

  return NextResponse.json(
    {
      webhooks: hooks,
      recentDeliveries: deliveries,
      supportedEvents: VALID_EVENTS,
    },
    { headers: CORS_HEADERS },
  );
}

// ============================================
// DELETE - Remove webhook
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing "id"', code: 'INVALID_PARAMS' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const removed = deleteWebhook(body.id);
    if (!removed) {
      return NextResponse.json(
        { error: 'Webhook not found', code: 'NOT_FOUND' },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    return NextResponse.json(
      { success: true, id: body.id },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[Webhooks API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// ============================================
// OPTIONS - CORS
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
