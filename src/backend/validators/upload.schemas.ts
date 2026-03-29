import { z } from 'zod';

/** Types MIME autorisés à l'upload. */
export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
]);

/** Taille maximale par fichier — peut être surchargée via MAX_UPLOAD_BYTES. */
export const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES ?? '') || 10 * 1024 * 1024; // 10 MB

/** Schéma de la requête de génération d'URL signée. */
export const presignSchema = z.object({
  noteId:   z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().refine(
    (v) => ALLOWED_MIME_TYPES.has(v),
    { message: 'Type de fichier non autorisé' }
  ),
  size: z.number().int().positive().max(
    MAX_UPLOAD_BYTES,
    { message: `Taille maximale : ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` }
  ),
});

/** Types MIME image uniquement — pour le re-upload d'URLs externes. */
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
]);

/**
 * Schéma pour POST /api/upload/from-url.
 * Valide côté serveur avant tout fetch externe.
 */
export const fromUrlSchema = z.object({
  noteId: z.string().min(1),
  url: z.string().url().refine(
    (url) => {
      try {
        const { hostname } = new URL(url);
        // Blocage SSRF : localhost, IPs privées, link-local AWS metadata
        if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) return false;
        const privateRanges = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./];
        return !privateRanges.some(r => r.test(hostname));
      } catch { return false; }
    },
    { message: 'URL non autorisée' }
  ),
});

export type FromUrlInput = z.infer<typeof fromUrlSchema>;

/** Schéma d'enregistrement d'un fichier après upload réussi. */
export const registerAttachmentSchema = z.object({
  noteId:   z.string().min(1),
  key:      z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  size:     z.number().int().positive(),
});

// ── Multipart upload ─────────────────────────────────────────────────────────

/** Taille minimale d'un chunk multipart (5 MiB — exigence R2/S3) */
export const MULTIPART_MIN_PART_BYTES = 5 * 1024 * 1024;

/** Taille maximale d'un fichier en multipart (5 Go — limite R2) */
export const MULTIPART_MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;

/** Schéma pour POST /api/upload/multipart/start */
export const multipartStartSchema = z.object({
  noteId:    z.string().min(1),
  filename:  z.string().min(1).max(255),
  mimeType:  z.string().refine(
    (v) => ALLOWED_MIME_TYPES.has(v),
    { message: 'Type de fichier non autorisé' }
  ),
  totalSize: z.number().int().positive().max(
    MULTIPART_MAX_FILE_BYTES,
    { message: 'Taille maximale : 5 Go' }
  ),
  partCount: z.number().int().min(1).max(10_000),
});

/** Schéma pour POST /api/upload/multipart/complete */
export const multipartCompleteSchema = z.object({
  key:      z.string().min(1),
  uploadId: z.string().min(1),
  parts:    z.array(z.object({
    partNumber: z.number().int().min(1).max(10_000),
    etag:       z.string().min(1),
  })).min(1),
});
