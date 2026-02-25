/**
 * Authentication & Authorization Module
 *
 * Supports two auth strategies:
 *   1. API Key (server-to-server): Authorization: Bearer sk_live_xxx
 *   2. JWT (client-side): Authorization: Bearer eyJhbGci...
 *
 * Legacy demo tokens are preserved for backward compatibility but
 * gated behind NODE_ENV !== 'production'.
 */

export { authenticate, requireAuth, requireScopes, type AuthContext } from './middleware';
export { hashApiKey, verifyApiKey, generateApiKeyPair } from './api-keys';
export { signJwt, verifyJwt } from './jwt';
