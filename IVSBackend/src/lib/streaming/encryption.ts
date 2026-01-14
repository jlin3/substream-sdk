/**
 * Stream Key Encryption
 * 
 * Encrypts/decrypts sensitive stream keys before storing in database.
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.STREAM_KEY_ENCRYPTION_KEY;
  
  if (!keyHex) {
    // Use a default demo key (NOT secure for production with real users!)
    console.warn('[Encryption] STREAM_KEY_ENCRYPTION_KEY not set - using demo key');
    // Demo key - this allows SDK testing without full setup
    return Buffer.from('8af6b8fb7572d8f31767f27b809445ccf1dc97e5c64073a46ecaccdb7b0c333c', 'hex');
  }

  if (keyHex.length !== 64) {
    throw new Error('STREAM_KEY_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a stream key for storage
 * Returns format: iv:tag:ciphertext (all hex encoded)
 */
export function encryptStreamKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stream key from storage
 */
export function decryptStreamKey(encrypted: string): string {
  const key = getEncryptionKey();
  
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted stream key format');
  }

  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(data) + decipher.final('utf8');
}

/**
 * Check if a value is already encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  
  const [ivHex, tagHex, dataHex] = parts;
  
  // Check if all parts are valid hex
  const hexRegex = /^[0-9a-f]+$/i;
  return (
    hexRegex.test(ivHex) &&
    hexRegex.test(tagHex) &&
    hexRegex.test(dataHex) &&
    ivHex.length === IV_LENGTH * 2 &&
    tagHex.length === TAG_LENGTH * 2
  );
}

/**
 * Generate a new encryption key (for initial setup)
 * Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
