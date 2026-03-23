/**
 * Migration Firebase Storage → Cloudflare R2
 *
 * Pour chaque note contenant des URLs firebasestorage.googleapis.com :
 *   1. Télécharge le fichier Firebase
 *   2. Upload vers R2 sous workspaces/{wId}/notes/{nId}/{uuid}.ext
 *   3. Enregistre un Attachment (fichiers non-image seulement)
 *   4. Met à jour NoteContent.html avec la nouvelle URL R2
 *
 * Usage :
 *   npx tsx --env-file=.env.local scripts/migrate-storage-to-r2.ts [--dry-run] [--verbose]
 */

import path    from 'path';
import { randomUUID } from 'crypto';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.join(__dirname, '../.env.local') });

import { Pool }         from 'pg';
import { PrismaPg }     from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3Client }     from '@aws-sdk/client-s3';

// ── Flags CLI ─────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const log     = (...a: unknown[]) => console.log(...a);
const dbg     = (...a: unknown[]) => { if (VERBOSE) console.log('  ', ...a); };

// ── R2 ────────────────────────────────────────────────────────────────────────

const r2 = new S3Client({
  region:   'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});
const R2_BUCKET     = process.env.R2_BUCKET_NAME ?? '';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

// ── Prisma ────────────────────────────────────────────────────────────────────

const pool   = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) as never });

// ── Helpers ───────────────────────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
};

function getMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/** Extrait les URLs Firebase Storage uniques d'un HTML. */
function extractFirebaseUrls(html: string): string[] {
  const re = /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^"'\s<>)]+/g;
  return Array.from(new Set(html.match(re) ?? []));
}

/** Déduit le nom de fichier depuis une URL Firebase Storage. */
function filenameFromFbUrl(url: string): string {
  try {
    const obj      = new URL(url);
    const encoded  = obj.pathname.split('/o/')[1] ?? '';
    const decoded  = decodeURIComponent(encoded);
    return decoded.split('/').pop() ?? 'file';
  } catch {
    return `file_${Date.now()}`;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) log('🔍 Mode DRY-RUN — aucune écriture');

  // Workspace du compte de migration
  const userEmail = process.env.MIGRATION_USER_EMAIL;
  if (!userEmail) throw new Error('MIGRATION_USER_EMAIL requis');

  const user = await prisma.user.findFirst({ where: { email: userEmail }, select: { id: true } });
  if (!user) throw new Error(`Utilisateur ${userEmail} introuvable en base`);

  const workspace = await prisma.workspace.findFirst({
    where:  { ownerUserId: user.id },
    select: { id: true },
  });
  if (!workspace) throw new Error('Workspace introuvable');
  const workspaceId = workspace.id;
  log(`Workspace : ${workspaceId}`);

  // NoteContents contenant au moins une URL Firebase
  const noteContents = await (prisma.noteContent as any).findMany({
    where: {
      html: { contains: 'firebasestorage.googleapis.com' },
      note: { workspaceId },
    },
    select: { noteId: true, html: true },
  }) as { noteId: string; html: string }[];

  log(`${noteContents.length} note(s) contenant des URLs Firebase\n`);

  let totalFiles = 0, totalFailed = 0, totalNotes = 0;

  for (const nc of noteContents) {
    const { noteId, html } = nc;
    const fbUrls = extractFirebaseUrls(html);
    if (fbUrls.length === 0) continue;

    log(`📝 Note ${noteId} — ${fbUrls.length} fichier(s)`);

    let updatedHtml   = html;
    let noteModified  = false;

    for (const fbUrl of fbUrls) {
      const filename = filenameFromFbUrl(fbUrl);
      const ext      = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
      const mimeType = getMime(filename);

      try {
        dbg(`↓ Téléchargement : ${filename}`);
        const res = await fetch(fbUrl);
        if (!res.ok) {
          log(`  ⚠ Inaccessible (${res.status}) : ${filename} — ignoré`);
          totalFailed++;
          continue;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const key        = `workspaces/${workspaceId}/notes/${noteId}/${randomUUID()}.${ext}`;
        const publicUrl  = `${R2_PUBLIC_URL}/${key}`;

        if (!DRY_RUN) {
          // Upload R2
          await r2.send(new PutObjectCommand({
            Bucket:        R2_BUCKET,
            Key:           key,
            Body:          buffer,
            ContentType:   mimeType,
            ContentLength: buffer.length,
          }));

          // Attachment uniquement pour les non-images
          if (!mimeType.startsWith('image/')) {
            await (prisma.attachment as any).upsert({
              where:  { key },
              create: { workspaceId, noteId, key, filename, mimeType, size: buffer.length, publicUrl },
              update: {},
            });
          }

          updatedHtml  = updatedHtml.replaceAll(fbUrl, publicUrl);
          noteModified = true;
        }

        log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} Ko) → ${key}`);
        totalFiles++;

      } catch (err) {
        log(`  ✗ Erreur ${filename} :`, (err as Error).message);
        totalFailed++;
      }
    }

    if (!DRY_RUN && noteModified) {
      await (prisma.noteContent as any).update({
        where: { noteId },
        data:  { html: updatedHtml },
      });
      totalNotes++;
    }
  }

  log(`\n✅ Migration terminée`);
  log(`   Fichiers migrés  : ${totalFiles}`);
  log(`   Fichiers échoués : ${totalFailed}`);
  log(`   Notes mises à jour : ${totalNotes}`);
  if (DRY_RUN) log('   (dry-run — rien écrit)');

  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
