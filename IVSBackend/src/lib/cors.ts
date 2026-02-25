/**
 * Per-App CORS Resolution
 *
 * In production, the Access-Control-Allow-Origin header is set to the
 * requesting origin only if it appears in the App's allowedOrigins list.
 * In development, all origins are allowed.
 */

import { NextRequest } from 'next/server';
import { prisma } from './prisma';

const ALWAYS_ALLOWED = new Set(['http://localhost:3000', 'http://localhost:5173']);

export async function resolveAllowedOrigin(
  request: NextRequest,
  appId?: string | null,
): Promise<string> {
  const origin = request.headers.get('origin') || '*';

  if (process.env.NODE_ENV !== 'production') return origin;
  if (ALWAYS_ALLOWED.has(origin)) return origin;

  if (!appId) return '';

  try {
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { allowedOrigins: true },
    });

    if (app && (app.allowedOrigins.length === 0 || app.allowedOrigins.includes(origin))) {
      return origin;
    }
  } catch {
    // DB failure — deny by default in production
  }

  return '';
}

export function corsHeaders(allowedOrigin: string): Record<string, string> {
  if (!allowedOrigin) return {};
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}
