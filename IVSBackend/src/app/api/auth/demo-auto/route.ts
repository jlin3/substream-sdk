import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth/session';

const DEMO_SLUG = 'substream-demo';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: DEMO_SLUG },
    });

    if (!org) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const token = await createSessionToken({
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
    });

    const response = NextResponse.redirect(`${origin}/dashboard`);

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }
}
