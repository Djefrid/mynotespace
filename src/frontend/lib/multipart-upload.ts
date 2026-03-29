'use client';

/**
 * Utilitaire multipart upload — pour les fichiers >= 5 Mo.
 *
 * Flux :
 *   1. uploadMultipart(file, noteId, onProgress)
 *   2. Calcule le nombre de chunks (CHUNK_SIZE = 5 MiB)
 *   3. POST /api/upload/multipart/start → { key, uploadId, presignedUrls }
 *   4. Upload chaque chunk via PUT vers sa presignedUrl (séquentiel, suivi progression)
 *   5. POST /api/upload/multipart/complete → { publicUrl }
 *   6. Retourne publicUrl
 *
 * Seuil : utiliser pour les fichiers >= MULTIPART_THRESHOLD (10 Mo par défaut).
 * En dessous, utiliser le flux standard presign + PUT.
 */

/** Taille d'un chunk : 10 MiB (doit être >= 5 MiB sauf dernier chunk) */
const CHUNK_SIZE = 10 * 1024 * 1024;

/** Seuil au-dessus duquel le multipart est utilisé */
export const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

export interface MultipartUploadResult {
  publicUrl: string;
  key:       string;
}

/**
 * Upload un fichier en multipart vers R2 via les routes dédiées.
 *
 * @param file       - Fichier à uploader
 * @param noteId     - ID de la note à laquelle le fichier est attaché
 * @param onProgress - Callback progression (0-100)
 */
export async function uploadMultipart(
  file:       File,
  noteId:     string,
  onProgress: (pct: number) => void,
): Promise<MultipartUploadResult> {
  const partCount = Math.ceil(file.size / CHUNK_SIZE);

  // ── 1. Initier le multipart ──────────────────────────────────────────────────
  const startRes = await fetch('/api/upload/multipart/start', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      noteId,
      filename:  file.name,
      mimeType:  file.type,
      totalSize: file.size,
      partCount,
    }),
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Multipart start échoué (${startRes.status})`);
  }

  const { data: startData } = await startRes.json();
  const { key, uploadId, presignedUrls } = startData as {
    key:           string;
    uploadId:      string;
    presignedUrls: string[];
  };

  // ── 2. Upload chaque chunk directement vers R2 ────────────────────────────────
  const parts: Array<{ partNumber: number; etag: string }> = [];

  for (let i = 0; i < partCount; i++) {
    const start  = i * CHUNK_SIZE;
    const end    = Math.min(start + CHUNK_SIZE, file.size);
    const chunk  = file.slice(start, end);

    const partRes = await fetch(presignedUrls[i], {
      method: 'PUT',
      body:   chunk,
      headers: { 'Content-Type': file.type },
    });

    if (!partRes.ok) {
      throw new Error(`Chunk ${i + 1}/${partCount} échoué (${partRes.status})`);
    }

    const etag = partRes.headers.get('ETag') ?? partRes.headers.get('etag') ?? '';
    parts.push({ partNumber: i + 1, etag });

    onProgress(Math.round(((i + 1) / partCount) * 90)); // 0-90% pendant upload
  }

  // ── 3. Finaliser le multipart ────────────────────────────────────────────────
  const completeRes = await fetch('/api/upload/multipart/complete', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ key, uploadId, parts }),
  });

  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Multipart complete échoué (${completeRes.status})`);
  }

  const { data: completeData } = await completeRes.json();
  onProgress(100);

  return { publicUrl: completeData.publicUrl, key: completeData.key };
}
