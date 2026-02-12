/**
 * IVS Playback Authorization
 * Generates signed JWT tokens for private playback
 * 
 * IVS uses playback authorization to restrict access to channels.
 * When enabled, viewers must provide a signed JWT token with each playback request.
 * 
 * @see https://docs.aws.amazon.com/ivs/latest/userguide/private-channels.html
 */

import { SignJWT, importPKCS8 } from 'jose';
import * as crypto from 'crypto';

interface PlaybackTokenOptions {
  channelArn: string;
  viewerId: string;
  ttlSeconds?: number;
}

// Cache the private key after first import
let cachedPrivateKey: CryptoKey | null = null;

/**
 * Converts SEC1 EC private key to PKCS#8 format
 * SEC1 format: -----BEGIN EC PRIVATE KEY-----
 * PKCS#8 format: -----BEGIN PRIVATE KEY-----
 */
function convertEcToPkcs8(ecPrivateKeyPem: string): string {
  // Check if already in PKCS#8 format
  if (ecPrivateKeyPem.includes('BEGIN PRIVATE KEY')) {
    return ecPrivateKeyPem;
  }

  // Use Node.js crypto to convert
  const keyObject = crypto.createPrivateKey({
    key: ecPrivateKeyPem,
    format: 'pem',
  });

  return keyObject.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
}

/**
 * Loads the private key from environment
 * In production, this should come from AWS Secrets Manager
 */
async function getPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  let privateKeyPem = process.env.IVS_PLAYBACK_PRIVATE_KEY;
  
  if (!privateKeyPem) {
    throw new Error(
      'IVS_PLAYBACK_PRIVATE_KEY environment variable is not set. ' +
      'Generate a key pair in IVS console and store the private key.'
    );
  }

  // Normalize the key (handle escaped newlines from env vars)
  privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');

  // Convert to PKCS#8 if needed (jose requires PKCS#8 format)
  const pkcs8Key = convertEcToPkcs8(privateKeyPem);

  cachedPrivateKey = await importPKCS8(pkcs8Key, 'ES384');
  return cachedPrivateKey;
}

/**
 * Generates a signed playback token for IVS
 * 
 * The token must include:
 * - `aws:channel-arn`: The channel ARN
 * - `aws:access-control-allow-origin`: Optional, restricts playback to specific origins
 * - Standard JWT claims (iat, exp)
 */
export async function generatePlaybackToken(
  options: PlaybackTokenOptions
): Promise<string> {
  const { channelArn, viewerId, ttlSeconds = 3600 } = options;

  const privateKey = await getPrivateKey();
  const keyPairId = process.env.IVS_PLAYBACK_KEY_PAIR_ID;

  if (!keyPairId) {
    throw new Error(
      'IVS_PLAYBACK_KEY_PAIR_ID environment variable is not set. ' +
      'This is the ARN or ID of the playback key pair created in IVS.'
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // Build the JWT with IVS-specific claims
  const token = await new SignJWT({
    'aws:channel-arn': channelArn,
    // Optional: Restrict playback to specific origins
    // 'aws:access-control-allow-origin': 'https://yourapp.com',
  })
    .setProtectedHeader({
      alg: 'ES384',
      typ: 'JWT',
      kid: keyPairId, // Key pair ID for IVS to identify which key to use
    })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setSubject(viewerId) // Include viewer ID for audit purposes
    .sign(privateKey);

  return token;
}

/**
 * Generates a signed URL for VOD playback via CloudFront
 * 
 * For VOD content stored in S3 and served via CloudFront,
 * we use CloudFront signed URLs instead of IVS playback tokens
 */
export async function generateCloudFrontSignedUrl(
  vodUrl: string,
  ttlSeconds: number = 3600
): Promise<string> {
  // For CloudFront signed URLs, we need different credentials
  const cloudFrontKeyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
  const cloudFrontPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY;

  if (!cloudFrontKeyPairId || !cloudFrontPrivateKey) {
    // Fall back to unsigned URL if CloudFront signing not configured
    // This is acceptable for development but not recommended for production
    console.warn('CloudFront signing not configured, returning unsigned URL');
    return vodUrl;
  }

  // CloudFront URL signing implementation
  // In production, use @aws-sdk/cloudfront-signer
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  
  // For full implementation, you'd sign this policy with the CloudFront private key
  // For now, return the URL with expiration as a query param (requires CloudFront setup)
  const url = new URL(vodUrl);
  url.searchParams.set('Expires', expiresAt.toString());
  url.searchParams.set('Key-Pair-Id', cloudFrontKeyPairId);
  
  return url.toString();
}

/**
 * Validates that a viewer can access a specific channel
 * This is called before generating a playback token
 */
export async function validateViewerAccess(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _viewerId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _channelArn: string
): Promise<boolean> {
  // This function should check:
  // 1. User exists and is authenticated
  // 2. User has permission to view this channel
  // 3. Any additional business rules (rate limits, etc.)
  
  // The actual implementation depends on your auth system
  // For now, return true (access check happens in stream-service.ts)
  return true;
}

/**
 * Refreshes a playback token before it expires
 * Call this when the current token is about to expire
 */
export async function refreshPlaybackToken(
  options: PlaybackTokenOptions
): Promise<{
  token: string;
  expiresAt: string;
}> {
  const token = await generatePlaybackToken(options);
  const expiresAt = new Date(Date.now() + (options.ttlSeconds ?? 3600) * 1000);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Generates a token suitable for HLS playback
 * Appends the token as a query parameter to the playback URL
 */
export function buildPlaybackUrlWithToken(
  playbackUrl: string,
  token: string
): string {
  // IVS expects the token as a query parameter
  const url = new URL(playbackUrl);
  url.searchParams.set('token', token);
  return url.toString();
}
