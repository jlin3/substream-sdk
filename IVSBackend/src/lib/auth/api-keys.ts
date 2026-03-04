/**
 * API Key Management
 *
 * Keys follow the format: sk_live_<32-char random hex>
 * Only the SHA-256 hash is stored; the plaintext is shown once at creation.
 */

import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'sk_live_';

export function generateApiKeyPair(): { plaintext: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex');
  const plaintext = `${KEY_PREFIX}${random}`;
  const hash = hashApiKey(plaintext);
  const prefix = plaintext.substring(0, KEY_PREFIX.length + 8);
  return { plaintext, hash, prefix };
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function verifyApiKey(plaintext: string, storedHash: string): boolean {
  return hashApiKey(plaintext) === storedHash;
}

export function isApiKeyFormat(token: string): boolean {
  return token.startsWith(KEY_PREFIX);
}
