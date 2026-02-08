/**
 * Simple in-memory rate limiter for edge functions
 * Note: This is per-instance only. For distributed rate limiting,
 * use a persistent store like Redis or database.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

interface RateLimitConfig {
  maxRequests: number;      // Maximum requests allowed
  windowMs: number;         // Time window in milliseconds
  keyPrefix?: string;       // Optional prefix for the key
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;          // Milliseconds until reset
  retryAfter?: number;      // Seconds until retry (for 429 responses)
}

/**
 * Check if a request is rate limited
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
  identifier: string, 
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
  const record = rateLimitStore.get(key);

  // Clean up expired entries periodically (simple cleanup)
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) {
        rateLimitStore.delete(k);
      }
    }
  }

  // No existing record or expired
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { 
      allowed: true, 
      remaining: config.maxRequests - 1, 
      resetIn: config.windowMs 
    };
  }

  // Check if over limit
  if (record.count >= config.maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: record.resetAt - now,
      retryAfter 
    };
  }

  // Increment and allow
  record.count++;
  return { 
    allowed: true, 
    remaining: config.maxRequests - record.count, 
    resetIn: record.resetAt - now 
  };
}

/**
 * Get client IP from request headers
 * Handles common proxy headers
 */
export function getClientIp(req: Request): string {
  // Check common proxy headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback to a default identifier
  return 'unknown';
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Sensitive endpoints (admin, auth)
  sensitive: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Standard API endpoints
  standard: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  // Public/unauthenticated endpoints
  public: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // Heavy operations (scraping, AI analysis)
  heavy: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;
