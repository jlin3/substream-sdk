import * as jose from 'jose';
import { cookies } from 'next/headers';

const ALG = 'HS256';
const COOKIE_NAME = 'lw_session';

function getSessionSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-not-for-production';
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  orgId: string;
  orgSlug: string;
  orgName: string;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('livewave')
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSessionSecret(), {
      issuer: 'livewave',
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export { COOKIE_NAME };
