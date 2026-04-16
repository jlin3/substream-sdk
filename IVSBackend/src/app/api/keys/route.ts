import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth/session';
import { generateApiKeyPair, hashApiKey } from '@/lib/auth/api-keys';

export async function GET(request: NextRequest) {
  const session = await getSessionOrFail(request);
  if (session instanceof NextResponse) return session;

  const keys = await prisma.apiKey.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest) {
  const session = await getSessionOrFail(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { plaintext, hash, prefix } = generateApiKeyPair();

  const key = await prisma.apiKey.create({
    data: {
      orgId: session.orgId,
      name,
      hashedKey: hash,
      prefix,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ key, plaintext }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionOrFail(request);
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const keyId = url.searchParams.get('id');
  if (!keyId) {
    return NextResponse.json({ error: 'Key id is required' }, { status: 400 });
  }

  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, orgId: session.orgId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  if (existing.revokedAt) {
    return NextResponse.json({ error: 'Key already revoked' }, { status: 400 });
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

async function getSessionOrFail(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return session;
}
