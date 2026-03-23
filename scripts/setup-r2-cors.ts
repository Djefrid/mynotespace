/**
 * Configure la politique CORS du bucket R2 pour autoriser les uploads
 * directs depuis le browser (XHR PUT vers URL présignée).
 *
 * Usage : npx tsx --env-file=.env.local scripts/setup-r2-cors.ts
 */
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;
const siteUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error('Variables manquantes : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  process.exit(1);
}

const r2 = new S3Client({
  region:   'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

// Origines autorisées : localhost dev + domaine de production
const allowedOrigins = [
  'http://localhost:3000',
  ...(siteUrl ? [siteUrl] : []),
];

console.log('Bucket  :', bucket);
console.log('Origines:', allowedOrigins.join(', '));

async function main() {
  await r2.send(new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: allowedOrigins,
          AllowedMethods: ['PUT'],
          // Headers envoyés par le browser lors du XHR presigned PUT
          AllowedHeaders: [
            'content-type',
            'content-length',
            'x-amz-checksum-crc32',
            'x-amz-sdk-checksum-algorithm',
          ],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }));

  console.log('✓ CORS R2 configuré avec succès.');
}

main().catch((err) => { console.error(err); process.exit(1); });
