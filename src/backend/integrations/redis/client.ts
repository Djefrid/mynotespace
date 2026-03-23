import 'server-only';

import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Retourne le client Redis Upstash.
 * Lazy : ne throw que si les vars manquent ET qu'on tente de l'utiliser.
 * Le fail-open dans rate-limit.ts capture l'erreur — pas de crash au démarrage.
 */
export function getRedis(): Redis {
  if (_redis) return _redis;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont requis');
  }

  _redis = new Redis({ url, token });
  return _redis;
}