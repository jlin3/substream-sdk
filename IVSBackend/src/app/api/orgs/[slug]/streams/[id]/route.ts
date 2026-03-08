import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth/session';

/**
 * PATCH /api/orgs/:slug/streams/:id
 * Update a stream (e.g. mark recording URL, update status).
 * Useful for manually setting recording URLs when IVS auto-record
 * takes time to finalize.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session || session.orgSlug !== slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stream = await prisma.stream.findFirst({
    where: { id, org: { slug } },
  });

  if (!stream) {
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.recordingUrl) {
    data.recordingUrl = body.recordingUrl;
    if (stream.status === 'ENDED') {
      data.status = 'RECORDED';
    }
  }
  if (body.thumbnailUrl) data.thumbnailUrl = body.thumbnailUrl;
  if (body.title) data.title = body.title;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const updated = await prisma.stream.update({
    where: { id },
    data,
  });

  return NextResponse.json({ stream: updated });
}
