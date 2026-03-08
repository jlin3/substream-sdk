import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session || session.orgSlug !== slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      _count: { select: { streams: true, highlights: true } },
    },
  });

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const liveStreams = await prisma.stream.count({
    where: { orgId: org.id, status: 'LIVE' },
  });

  return NextResponse.json({
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      totalStreams: org._count.streams,
      totalHighlights: org._count.highlights,
      liveStreams,
    },
  });
}
