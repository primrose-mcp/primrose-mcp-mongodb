/**
 * Environment Bindings
 *
 * Type definitions for Cloudflare Worker environment variables and bindings.
 *
 * MULTI-TENANT ARCHITECTURE:
 * This server supports multiple tenants. Tenant-specific credentials (API keys,
 * App IDs, etc.) are passed via request headers, NOT stored in wrangler
 * secrets. This allows a single server instance to serve multiple customers.
 *
 * Request Headers:
 * - X-MongoDB-API-Key: MongoDB Atlas Data API key
 * - X-MongoDB-App-ID: MongoDB Atlas App ID
 * - X-MongoDB-Data-Source: Cluster name (e.g., "Cluster0")
 * - X-MongoDB-Base-URL: (Optional) Override the default Data API base URL
 */

// =============================================================================
// Tenant Credentials (parsed from request headers)
// =============================================================================

export interface TenantCredentials {
  /** MongoDB Atlas Data API key (from X-MongoDB-API-Key header) */
  apiKey?: string;

  /** MongoDB Atlas App ID (from X-MongoDB-App-ID header) */
  appId?: string;

  /** MongoDB Data Source / Cluster name (from X-MongoDB-Data-Source header) */
  dataSource?: string;

  /** Override Data API base URL (from X-MongoDB-Base-URL header) */
  baseUrl?: string;
}

/**
 * Parse tenant credentials from request headers
 */
export function parseTenantCredentials(request: Request): TenantCredentials {
  const headers = request.headers;

  return {
    apiKey: headers.get('X-MongoDB-API-Key') || undefined,
    appId: headers.get('X-MongoDB-App-ID') || undefined,
    dataSource: headers.get('X-MongoDB-Data-Source') || undefined,
    baseUrl: headers.get('X-MongoDB-Base-URL') || undefined,
  };
}

/**
 * Validate that required credentials are present
 */
export function validateCredentials(credentials: TenantCredentials): void {
  if (!credentials.apiKey) {
    throw new Error('Missing X-MongoDB-API-Key header.');
  }
  if (!credentials.appId) {
    throw new Error('Missing X-MongoDB-App-ID header.');
  }
  if (!credentials.dataSource) {
    throw new Error('Missing X-MongoDB-Data-Source header.');
  }
}

// =============================================================================
// Environment Configuration (from wrangler.jsonc vars and bindings)
// =============================================================================

export interface Env {
  // ===========================================================================
  // Environment Variables (from wrangler.jsonc vars)
  // ===========================================================================

  /** Maximum character limit for responses */
  CHARACTER_LIMIT: string;

  /** Default page size for list operations */
  DEFAULT_PAGE_SIZE: string;

  /** Maximum page size allowed */
  MAX_PAGE_SIZE: string;

  // ===========================================================================
  // Bindings
  // ===========================================================================

  /** Durable Object namespace for MCP sessions */
  MCP_SESSIONS?: DurableObjectNamespace;

  /** Cloudflare AI binding (optional) */
  AI?: Ai;
}

// ===========================================================================
// Helper Functions
// ===========================================================================

/**
 * Get a numeric environment value with a default
 */
export function getEnvNumber(env: Env, key: keyof Env, defaultValue: number): number {
  const value = env[key];
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Get the character limit from environment
 */
export function getCharacterLimit(env: Env): number {
  return getEnvNumber(env, 'CHARACTER_LIMIT', 50000);
}

/**
 * Get the default page size from environment
 */
export function getDefaultPageSize(env: Env): number {
  return getEnvNumber(env, 'DEFAULT_PAGE_SIZE', 20);
}

/**
 * Get the maximum page size from environment
 */
export function getMaxPageSize(env: Env): number {
  return getEnvNumber(env, 'MAX_PAGE_SIZE', 100);
}
