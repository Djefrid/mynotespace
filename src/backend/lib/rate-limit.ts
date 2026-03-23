import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/src/backend/integrations/redis/client';

export type RateLimitRoute = 'search' | 'presign' | 'create' | 'auth' | 'from-url';

export interface RateLimitResult {
  success:   boolean;
  remaining: number;
  reset:     number;
}

const CONFIGS: Record<RateLimitRoute, { limit: number; window: string }> = {
  search:    { limit: 60,  window: '1 m' },
  presign:   { limit: 20,  window: '1 m' },
  'from-url':{ limit: 60,  window: '1 m' }, // coller une note peut contenir 20-50 images
  create:    { limit: 30,  window: '1 m' },
  auth:      { limit: 5,   window: '15 m' },
};

/**
 * Vérifie la limite de requêtes.
 * Fail-open si Redis est indisponible ou non configuré.
 */
export async function checkRateLimit(
  route:      RateLimitRoute,
  identifier: string,
): Promise<RateLimitResult> {
  try {
    const { limit, window } = CONFIGS[route];
    const limiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(limit, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
      prefix:  `rl:${route}`,
    });
    const { success, remaining, reset } = await limiter.limit(identifier);
    return { success, remaining, reset };
  } catch {
    console.warn(`[RateLimit] Redis indisponible pour "${route}" — fail open`);
    return { success: true, remaining: -1, reset: 0 };
  }
}

export function rateLimitResponse(reset: number): Response {
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return Response.json(
    { error: 'Trop de requêtes — réessayez dans un moment.' },
    {
      status:  429,
      headers: {
        'Retry-After':           String(retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}