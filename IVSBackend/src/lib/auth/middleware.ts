/**
 * Auth Middleware for Next.js Route Handlers
 *
 * Resolves a request into an AuthContext. Supports JWTs, API key format
 * tokens (validated externally by the platform), and legacy demo tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isApiKeyFormat } from './api-keys';
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

  // 2. API Key format — accept as authenticated identity
  //    Full DB-backed validation happens in the platform repo.
  if (isApiKeyFormat(token)) {
    return {
      orgId: 'sdk',
      appId: null,
      userId: `apikey:${token.substring(0, 16)}`,
      scopes: ['streams:write', 'streams:read'],
      method: 'api_key',
    };
  }

  // 3. JWT
  try {
    return await resolveJwt(token);
  } catch {
    return null;
  }
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

export function requireScopes(
  auth: AuthContext,
  required: string[],
): NextResponse | null {
  if (auth.method === 'demo') return null;

  const missing = required.filter(s => !auth.scopes.includes(s));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required scopes: ${missing.join(', ')}`, code: 'FORBIDDEN' },
      { status: 403 },
    );
  }
  return null;
}
