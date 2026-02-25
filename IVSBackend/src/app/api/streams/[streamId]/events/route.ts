/**
 * Server-Sent Events (SSE) endpoint for real-time stream updates.
 *
 * GET /api/streams/:streamId/events
 *
 * Streams events:
 *   - viewerCount: periodic viewer count updates
 *   - reaction:    emoji reactions from other viewers
 */

import { NextRequest } from 'next/server';
import { getViewerCount } from '@/lib/engagement/viewer-count';
import { subscribeReactions, type Reaction } from '@/lib/engagement/reactions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed
        }
      }

      // Send initial viewer count
      const count = await getViewerCount(streamId);
      send('viewerCount', { streamId, viewerCount: count });

      // Periodic viewer count updates
      const countInterval = setInterval(async () => {
        try {
          const c = await getViewerCount(streamId);
          send('viewerCount', { streamId, viewerCount: c });
        } catch {}
      }, 5000);

      // Subscribe to reactions
      const unsubReactions = await subscribeReactions(streamId, (reaction: Reaction) => {
        send('reaction', reaction);
      });

      // Keepalive
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {}
      }, 15000);

      // Cleanup on close
      _request.signal.addEventListener('abort', () => {
        clearInterval(countInterval);
        clearInterval(keepalive);
        unsubReactions();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
