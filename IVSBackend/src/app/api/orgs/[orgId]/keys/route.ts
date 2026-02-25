/**
 * API Key Management
 *
 * POST   /api/orgs/:orgId/keys — Create a new API key
 * GET    /api/orgs/:orgId/keys — List API keys (prefix + metadata only)
 * DELETE /api/orgs/:orgId/keys — Revoke a key by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, type AuthContext } from '@/lib/auth';
import { generateApiKeyPair } from '@/lib/auth/api-keys';

export async function POST(
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
      if (!membership || membership.role === 'MEMBER') {
        return NextResponse.json(
          { error: 'Must be org admin or owner', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
    }

    const body = await request.json();
    const { plaintext, hash, prefix } = generateApiKeyPair();

    const key = await prisma.apiKey.create({
      data: {
        orgId,
        keyHash: hash,
        prefix,
        name: body.name || 'Unnamed Key',
        scopes: body.scopes || ['streams:write', 'streams:read'],
        rateLimit: body.rateLimit || 100,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });

    return NextResponse.json(
      {
        id: key.id,
        prefix: key.prefix,
        name: key.name,
        scopes: key.scopes,
        rateLimit: key.rateLimit,
        apiKey: plaintext,
        _note: 'Store the apiKey securely — it will not be shown again.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Keys] Create error:', error);
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

    const keys = await prisma.apiKey.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k.id,
        prefix: k.prefix,
        name: k.name,
        scopes: k.scopes,
        rateLimit: k.rateLimit,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
        expiresAt: k.expiresAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error('[Keys] List error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
      if (!membership || membership.role === 'MEMBER') {
        return NextResponse.json(
          { error: 'Must be org admin or owner', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing "id"', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const key = await prisma.apiKey.findFirst({
      where: { id: body.id, orgId },
    });
    if (!key) {
      return NextResponse.json(
        { error: 'Key not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    await prisma.apiKey.update({
      where: { id: body.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, id: body.id });
  } catch (error) {
    console.error('[Keys] Revoke error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
