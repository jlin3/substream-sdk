/**
 * Organization Management
 *
 * POST /api/orgs — Create a new organization
 * GET  /api/orgs — List organizations for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, type AuthContext } from '@/lib/auth';
import { generateApiKeyPair } from '@/lib/auth/api-keys';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const body = await request.json();
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "name"', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: 'Organization slug already taken', code: 'CONFLICT' },
        { status: 409 },
      );
    }

    const org = await prisma.organization.create({
      data: {
        name: body.name,
        slug,
        members: {
          create: {
            userId: auth.userId,
            role: 'OWNER',
          },
        },
      },
    });

    // Auto-create a first API key
    const { plaintext, hash, prefix } = generateApiKeyPair();
    await prisma.apiKey.create({
      data: {
        orgId: org.id,
        keyHash: hash,
        prefix,
        name: 'Default Key',
        scopes: ['streams:write', 'streams:read', 'analytics:read'],
      },
    });

    return NextResponse.json(
      {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        apiKey: plaintext,
        _note: 'Store the apiKey securely — it will not be shown again.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Orgs] Create error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const memberships = await prisma.orgMember.findMany({
      where: { userId: auth.userId },
      include: {
        org: {
          include: { _count: { select: { apps: true, members: true, apiKeys: true } } },
        },
      },
    });

    return NextResponse.json({
      organizations: memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        slug: m.org.slug,
        plan: m.org.plan,
        role: m.role,
        apps: m.org._count.apps,
        members: m.org._count.members,
      })),
    });
  } catch (error) {
    console.error('[Orgs] List error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
