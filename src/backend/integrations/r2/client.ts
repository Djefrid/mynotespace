import 'server-only';

import { S3Client } from '@aws-sdk/client-s3';

/**
 * Client S3 compatible Cloudflare R2.
 * Toutes les variables sont lues depuis l'environnement — aucun secret en dur.
 *
 * Variables requises dans .env.local :
 *   R2_ACCOUNT_ID        — ID de compte Cloudflare
 *   R2_ACCESS_KEY_ID     — Clé d'accès R2 (API token)
 *   R2_SECRET_ACCESS_KEY — Secret R2
 *   R2_BUCKET_NAME       — Nom du bucket (ex: mynotespace)
 *   R2_PUBLIC_URL        — URL publique du domaine custom (ex: https://assets.djefrid.ca)
 */

function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error('R2_ACCOUNT_ID est manquant dans les variables d\'environnement');

  return new S3Client({
    region:   'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

// Singleton — une seule instance par processus Node
const globalForR2 = globalThis as unknown as { r2?: S3Client };
export const r2 = globalForR2.r2 ?? createR2Client();
if (process.env.NODE_ENV !== 'production') globalForR2.r2 = r2;

export const R2_BUCKET     = process.env.R2_BUCKET_NAME ?? '';
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');