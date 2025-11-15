/**
 * Rate Limiting Utility
 *
 * In-memory rate limiter using token bucket algorithm.
 * For production with multiple instances, consider Upstash/Redis.
 */

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  maxRequests: number; // Max requests per interval
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage (use Redis/Upstash for production multi-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Authentication endpoints - prevent brute force
  AUTH: { interval: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes

  // AI endpoints - prevent abuse and manage costs
  AI_CHAT: { interval: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
  AI_GENERATE: { interval: 60 * 1000, maxRequests: 5 }, // 5 generations per minute

  // Data sync - prevent excessive API calls
  GARMIN_SYNC: { interval: 60 * 60 * 1000, maxRequests: 10 }, // 10 syncs per hour

  // Payment endpoints - critical operations
  STRIPE: { interval: 60 * 1000, maxRequests: 5 }, // 5 requests per minute

  // Team management
  TEAM_INVITE: { interval: 60 * 60 * 1000, maxRequests: 20 }, // 20 invites per hour

  // General API endpoints
  API_DEFAULT: { interval: 60 * 1000, maxRequests: 60 }, // 60 requests per minute

  // Public pages (less restrictive)
  PUBLIC: { interval: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
} as const;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds until reset
}

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${config.interval}:${config.maxRequests}`;

  let entry = rateLimitStore.get(key);

  // Initialize or reset if expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.interval,
    };
    rateLimitStore.set(key, entry);
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
      retryAfter,
    };
  }

  // Increment count
  entry.count++;

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get identifier from request (IP or user ID)
 */
export function getIdentifier(
  req: Request,
  userId?: string
): string {
  // Use user ID if authenticated (more accurate)
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limit response with headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message?: string
): Response {
  const headers = new Headers({
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  });

  if (result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString());
  }

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: message || `Too many requests. Please try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...Object.fromEntries(headers.entries()),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.reset.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Reset rate limit for a specific identifier (admin use)
 */
export function resetRateLimit(identifier: string): void {
  const keysToDelete: string[] = [];

  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(identifier)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${config.interval}:${config.maxRequests}`;

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: now + config.interval,
    };
  }

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const retryAfter = remaining === 0 ? Math.ceil((entry.resetTime - now) / 1000) : undefined;

  return {
    success: remaining > 0,
    limit: config.maxRequests,
    remaining,
    reset: entry.resetTime,
    retryAfter,
  };
}
