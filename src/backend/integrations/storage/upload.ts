/**
 * Upload vers Cloudflare R2 via URL présignée.
 *
 * Flux :
 *   1. POST /api/upload/presign → { uploadUrl, key, publicUrl }
 *   2. PUT uploadUrl (XHR pour la progression)
 *   3. Retourne publicUrl
 *
 * Aliasé par tsconfig : @/lib/upload-image → ce fichier.
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 Mo
const MAX_FILE_BYTES  = 10 * 1024 * 1024; // 10 Mo (cohérent avec presignSchema)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requestPresign(
  noteId: string, filename: string, mimeType: string, size: number,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const res = await fetch('/api/upload/presign', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ noteId, filename, mimeType, size }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error ?? `Presign failed (${res.status})`);
  }
  const { data } = await res.json();
  return data as { uploadUrl: string; publicUrl: string };
}

/** PUT direct vers R2 avec suivi de progression via XHR. */
function putToR2(
  uploadUrl: string, file: File, mimeType: string, onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload  = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload R2 échoué (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload'));
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.send(file);
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Upload une image inline dans R2.
 * Retourne l'URL publique utilisée comme `src` de l'image TipTap.
 */
export async function uploadNoteImage(
  file: File,
  noteId: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Format non supporté (jpg, png, gif, webp)');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image trop grande (max 10 Mo)');

  const { uploadUrl, publicUrl } = await requestPresign(noteId, file.name, file.type, file.size);
  await putToR2(uploadUrl, file, file.type, onProgress);
  return publicUrl;
}

/**
 * Upload un fichier joint dans R2.
 * Retourne { url, name, size }.
 */
export async function uploadNoteFile(
  file: File,
  noteId: string,
  onProgress?: (percent: number) => void,
): Promise<{ url: string; name: string; size: number }> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Fichier trop grand (max 10 Mo)');

  const { uploadUrl, publicUrl } = await requestPresign(noteId, file.name, file.type, file.size);
  await putToR2(uploadUrl, file, file.type, onProgress);
  return { url: publicUrl, name: file.name, size: file.size };
}
