import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Rate limiting for Edge Runtime
 * Using simplified in-memory approach (upgrade to Upstash for production)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Edge-compatible rate limit storage
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(identifier: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
} {
  const now = Date.now();
  const key = `${identifier}:${windowMs}`;

  let entry = rateLimitMap.get(key);

  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + windowMs };
    rateLimitMap.set(key, entry);
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      reset: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;

  return {
    allowed: true,
    remaining: limit - entry.count,
    reset: entry.resetTime,
  };
}

function getIdentifier(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.ip || 'unknown';
  return `ip:${ip}`;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Get user session for authenticated rate limiting
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = token?.sub;

  // Apply rate limiting based on route
  let rateLimit: { limit: number; window: number } | null = null;

  if (pathname.startsWith('/api/chat')) {
    rateLimit = { limit: 10, window: 60 * 1000 }; // 10 per minute
  } else if (pathname.startsWith('/api/plans/generate')) {
    rateLimit = { limit: 5, window: 60 * 1000 }; // 5 per minute
  } else if (pathname.startsWith('/api/garmin/sync')) {
    rateLimit = { limit: 10, window: 60 * 60 * 1000 }; // 10 per hour
  } else if (pathname.startsWith('/api/stripe')) {
    rateLimit = { limit: 5, window: 60 * 1000 }; // 5 per minute
  } else if (pathname.startsWith('/api/team/invite')) {
    rateLimit = { limit: 20, window: 60 * 60 * 1000 }; // 20 per hour
  } else if (pathname.startsWith('/api/')) {
    rateLimit = { limit: 60, window: 60 * 1000 }; // 60 per minute (general API)
  }

  // Check rate limit
  if (rateLimit) {
    const identifier = getIdentifier(req, userId);
    const result = checkRateLimit(identifier, rateLimit.limit, rateLimit.window);

    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': result.retryAfter!.toString(),
          },
        }
      );
    }

    // Add rate limit headers to successful requests
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());

    // Require authentication for dashboard routes
    if (pathname.startsWith('/dashboard') && !token) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    return response;
  }

  // Authentication for dashboard routes
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
  ],
};
