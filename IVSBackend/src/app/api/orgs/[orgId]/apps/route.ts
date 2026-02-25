/**
 * App Management
 *
 * POST /api/orgs/:orgId/apps — Create a new app
 * GET  /api/orgs/:orgId/apps — List apps for the organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, type AuthContext } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const { orgId } = await params;

    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: auth.userId } },
    });
    if (!membership || membership.role === 'MEMBER') {
      return NextResponse.json(
        { error: 'Must be org admin or owner', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "name"', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const app = await prisma.app.create({
      data: {
        orgId,
        name: body.name,
        allowedOrigins: body.allowedOrigins || [],
      },
    });

    return NextResponse.json(
      { id: app.id, name: app.name, orgId: app.orgId, allowedOrigins: app.allowedOrigins },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Apps] Create error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const { orgId } = await params;

    if (auth.method !== 'demo') {
      const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: auth.userId } },
      });
      if (!membership) {
        return NextResponse.json(
          { error: 'Not a member of this org', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
    }

    const apps = await prisma.app.findMany({
      where: { orgId },
      include: { _count: { select: { streams: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      apps: apps.map((a) => ({
        id: a.id,
        name: a.name,
        allowedOrigins: a.allowedOrigins,
        streams: a._count.streams,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Apps] List error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
