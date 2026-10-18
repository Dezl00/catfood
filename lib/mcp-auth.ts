import crypto from 'node:crypto';

/**
 * Verifies optional MCP authentication secret.
 *
 * Requirements:
 * - If MCP_SECRET is not set in the environment, the server is open (returns true).
 * - If MCP_SECRET is set, it checks Authorization header (Bearer token) or query params (?secret=, ?key=, ?apiKey=, ?token=).
 * - Constant-time comparison using crypto.timingSafeEqual on SHA-256 digests to eliminate any timing vulnerability.
 */
export function verifyMcpSecret(request: Request): boolean {
  const mcpSecret = process.env.MCP_SECRET;
  if (!mcpSecret) {
    return true; // Open access when variable is not set
  }

  let providedToken: string | null = null;

  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.slice(7).trim();
  }

  // 2. Check query parameters
  if (!providedToken) {
    try {
      const url = new URL(request.url);
      providedToken =
        url.searchParams.get('secret') ||
        url.searchParams.get('key') ||
        url.searchParams.get('apiKey') ||
        url.searchParams.get('token');
    } catch {
      // Ignore URL parsing errors
    }
  }

  if (!providedToken) {
    return false;
  }

  // SHA-256 hash both to ensure fixed 32-byte buffers for timingSafeEqual
  const expectedHash = crypto.createHash('sha256').update(mcpSecret).digest();
  const providedHash = crypto.createHash('sha256').update(providedToken).digest();

  return crypto.timingSafeEqual(expectedHash, providedHash);
}
