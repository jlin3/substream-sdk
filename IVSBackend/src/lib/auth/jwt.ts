/**
 * JWT Token Management
 *
 * Used for short-lived client-side tokens. Businesses issue these
 * from their own backend using their API key, then pass them to the
 * Substream SDK running in the player's browser.
 */

import * as jose from 'jose';

const ALG = 'HS256';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return new TextEncoder().encode('dev-jwt-secret-not-for-production');
  }
  return new TextEncoder().encode(secret);
}

export interface JwtPayload {
  sub: string;        // user/streamer ID
  orgId: string;
  appId: string;
  scopes: string[];
  [key: string]: unknown;
}

export async function signJwt(
  payload: JwtPayload,
  expiresIn: string = '1h',
): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer('substream')
    .sign(getJwtSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, getJwtSecret(), {
    issuer: 'substream',
  });
  return payload as unknown as JwtPayload;
}
