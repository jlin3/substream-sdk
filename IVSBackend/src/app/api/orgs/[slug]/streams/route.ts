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

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  const where: Record<string, unknown> = { org: { slug } };
  if (status) {
    where.status = status;
  }

  const streams = await prisma.stream.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    include: {
      _count: { select: { highlights: true } },
    },
  });

  return NextResponse.json({ streams });
}
