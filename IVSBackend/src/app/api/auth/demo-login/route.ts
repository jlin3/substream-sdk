import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, code } = body;

    if (!slug || !code) {
      return NextResponse.json(
        { error: 'Organization slug and demo code are required' },
        { status: 400 },
      );
    }

    const expectedCode = process.env.DEMO_ORG_CODE || 'livewave123';
    if (code !== expectedCode) {
      return NextResponse.json(
        { error: 'Invalid demo code' },
        { status: 401 },
      );
    }

    const org = await prisma.organization.findUnique({
      where: { slug },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    const token = await createSessionToken({
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
    });

    const response = NextResponse.json({
      success: true,
      org: { id: org.id, name: org.name, slug: org.slug },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
