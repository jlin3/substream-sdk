/**
 * Token Issuing API
 *
 * POST /api/apps/:appId/tokens
 *
 * Businesses call this from their backend (authenticated with API key)
 * to generate short-lived JWTs for their players to use client-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireScopes, type AuthContext } from '@/lib/auth';
import { signJwt } from '@/lib/auth/jwt';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const scopeErr = requireScopes(auth, ['streams:write']);
    if (scopeErr) return scopeErr;

    const { appId } = await params;

    // Verify app belongs to org
    if (auth.method !== 'demo') {
      const app = await prisma.app.findUnique({ where: { id: appId }, select: { orgId: true } });
      if (!app || app.orgId !== auth.orgId) {
        return NextResponse.json(
          { error: 'App not found or not accessible', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
    }

    const body = await request.json();
    if (!body.userId || typeof body.userId !== 'string') {
      return NextResponse.json(
        { error: 'Missing userId (the player/streamer identity)', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const scopes = body.scopes || ['streams:write', 'streams:read'];
    const expiresIn = body.expiresIn || '1h';

    const token = await signJwt(
      {
        sub: body.userId,
        orgId: auth.orgId,
        appId,
        scopes,
        displayName: body.displayName,
      },
      expiresIn,
    );

    return NextResponse.json({
      token,
      expiresIn,
      scopes,
      userId: body.userId,
    });
  } catch (error) {
    console.error('[Tokens] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
