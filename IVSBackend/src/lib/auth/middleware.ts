/**
 * Auth Middleware for Next.js Route Handlers
 *
 * Resolves a request into an AuthContext containing the org, app, and user info.
 * Supports API keys, JWTs, and legacy demo tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../prisma';
import { hashApiKey, isApiKeyFormat } from './api-keys';
import { verifyJwt, type JwtPayload } from './jwt';

// ============================================
// AUTH CONTEXT
// ============================================

export interface AuthContext {
  orgId: string;
  appId: string | null;
  userId: string;
  scopes: string[];
  /** 'api_key' | 'jwt' | 'demo' */
  method: string;
}

// ============================================
// DEMO TOKENS (non-production only)
// ============================================

const DEMO_TOKENS: Record<string, AuthContext> = {
  'demo-token': {
    orgId: 'demo-org',
    appId: 'demo-app',
    userId: 'demo-user-001',
    scopes: ['streams:write', 'streams:read'],
    method: 'demo',
  },
  'demo-viewer-token': {
    orgId: 'demo-org',
    appId: 'demo-app',
    userId: 'demo-viewer-001',
    scopes: ['streams:read'],
    method: 'demo',
  },
  'test-token': {
    orgId: 'demo-org',
    appId: 'demo-app',
    userId: 'test-user-id',
    scopes: ['streams:write', 'streams:read'],
    method: 'demo',
  },
  'test-parent-token': {
    orgId: 'demo-org',
    appId: 'demo-app',
    userId: 'test-parent-user-id',
    scopes: ['streams:read'],
    method: 'demo',
  },
};

// ============================================
// CORE AUTH FUNCTION
// ============================================

/**
 * Extract and validate credentials from a request.
 * Returns null if no valid credentials found.
 */
export async function authenticate(request: NextRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) return null;

  const token = match[1];

  // 1. Demo tokens (non-production only)
  if (process.env.NODE_ENV !== 'production' && DEMO_TOKENS[token]) {
    return DEMO_TOKENS[token];
  }

  // 2. API Key
  if (isApiKeyFormat(token)) {
    return resolveApiKey(token);
  }

  // 3. JWT
  try {
    return await resolveJwt(token);
  } catch {
    return null;
  }
}

async function resolveApiKey(plaintext: string): Promise<AuthContext | null> {
  const hash = hashApiKey(plaintext);

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: { org: true },
  });

  if (!key || !key.isActive) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Touch lastUsedAt (fire-and-forget)
  prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    orgId: key.orgId,
    appId: null, // API keys are org-scoped; app resolved from request body/params
    userId: `apikey:${key.id}`,
    scopes: key.scopes,
    method: 'api_key',
  };
}

async function resolveJwt(token: string): Promise<AuthContext | null> {
  let payload: JwtPayload;
  try {
    payload = await verifyJwt(token);
  } catch {
    return null;
  }

  return {
    orgId: payload.orgId,
    appId: payload.appId || null,
    userId: payload.sub,
    scopes: payload.scopes || [],
    method: 'jwt',
  };
}

// ============================================
// ROUTE HELPERS
// ============================================

/**
 * Require authentication on a route. Returns AuthContext or sends 401.
 */
export async function requireAuth(
  request: NextRequest,
): Promise<AuthContext | NextResponse> {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }
  return auth;
}

/**
 * Verify the AuthContext has all required scopes.
 */
export function requireScopes(
  auth: AuthContext,
  required: string[],
): NextResponse | null {
  if (auth.method === 'demo') return null; // demo tokens bypass scope checks

  const missing = required.filter(s => !auth.scopes.includes(s));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required scopes: ${missing.join(', ')}`, code: 'FORBIDDEN' },
      { status: 403 },
    );
  }
  return null;
}
