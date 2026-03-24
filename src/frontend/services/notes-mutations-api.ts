/**
 * Mutations notes — appelées depuis les hooks frontend.
 * Mirrors les signatures du service Firebase (notes.service.ts) pour
 * un swap minimal : même noms de fonctions, même types retournés.
 *
 * Mappings de champs :
 *   Firebase content  → API html
 *   Firebase pinned   → API isPinned
 */

// ── Helper HTTP ───────────────────────────────────────────────────────────────

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Crée une note vide — retourne son id. */
export async function createNote(folderId?: string | null): Promise<string> {
  const res = await apiFetch('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ folderId: folderId ?? undefined }),
  });
  const { data } = await res.json() as { data: { id: string } };
  return data.id;
}

/**
 * Payload contenu riche — json est la source de vérité,
 * html et plainText sont des dérivés stockés en cache.
 */
type NoteContentPayload = {
  html:      string;
  json:      Record<string, unknown>;
  plainText: string;
};

/**
 * Met à jour une note en bifurquant selon ce qui change :
 *   - métadonnées (title, pinned, folderId) → PATCH /api/notes/[id]
 *   - contenu                               → PATCH /api/notes/[id]/content
 * Les deux appels partent en parallèle si les deux sont nécessaires.
 * Version++ uniquement côté serveur sur isPinned/folderId (pas sur title ni content).
 */
export async function updateNote(
  id: string,
  data: Partial<{ title: string; content: NoteContentPayload | string; pinned: boolean; folderId: string | null }>
): Promise<void> {
  const calls: Promise<Response>[] = [];

  // ── Métadonnées ────────────────────────────────────────────────────────────
  const metaBody: Record<string, unknown> = {};
  if (data.title   !== undefined) metaBody.title    = data.title;
  if (data.pinned  !== undefined) metaBody.isPinned = data.pinned;
  if ('folderId' in data)         metaBody.folderId = data.folderId; // null doit passer

  if (Object.keys(metaBody).length > 0) {
    calls.push(apiFetch(`/api/notes/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(metaBody),
    }));
  }

  // ── Contenu — json (source de vérité) + html (cache) + plainText (search) ─
  if (data.content !== undefined) {
    const c = data.content;
    const body = typeof c === 'string'
      ? { html: c }
      : { html: c.html, json: c.json, plainText: c.plainText };
    calls.push(apiFetch(`/api/notes/${id}/content`, {
      method: 'PATCH',
      body:   JSON.stringify(body),
    }));
  }

  await Promise.all(calls);
}

/** Soft delete — déplace la note dans la corbeille. */
export async function deleteNote(id: string): Promise<void> {
  await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
}

/** Restaure une note depuis la corbeille. */
export async function recoverNote(id: string): Promise<void> {
  await apiFetch(`/api/notes/${id}/restore`, { method: 'POST' });
}

/**
 * Suppression définitive — sans nettoyage Storage (R2 non encore intégré).
 * Identique à deleteNote pour les notes actives (vides), suppression hard
 * pour les notes en corbeille via ?permanent=true.
 */
export async function permanentlyDeleteNote(id: string): Promise<void> {
  await apiFetch(`/api/notes/${id}?permanent=true`, { method: 'DELETE' });
}

/**
 * Suppression silencieuse d'une note vide (comportement Apple Notes).
 * Pour l'instant : soft delete (pas de fichiers Storage à nettoyer).
 */
export async function silentlyDeleteNote(id: string): Promise<void> {
  await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
}

/** Déplace une note dans un dossier (null = inbox). */
export async function moveNote(noteId: string, folderId: string | null): Promise<void> {
  await apiFetch(`/api/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ folderId }),
  });
}

// ── Dossiers ──────────────────────────────────────────────────────────────────

/** Crée un dossier — retourne son id. */
export async function createFolder(
  name: string,
  _order?: number,
  parentId?: string | null,
): Promise<string> {
  const body: Record<string, unknown> = { name };
  if (parentId) body.parentId = parentId;
  const res = await apiFetch('/api/folders', { method: 'POST', body: JSON.stringify(body) });
  const { data } = await res.json() as { data: { id: string } };
  return data.id;
}

/** Crée un dossier "intelligent" — mappé sur un dossier normal en PG (pas de smart folders). */
export async function createSmartFolder(
  name: string,
  _order?: number,
  _filters?: unknown,
): Promise<string> {
  return createFolder(name);
}

/** Met à jour le nom d'un dossier. */
export async function updateFolder(id: string, data: { name?: string; parentId?: string | null }): Promise<void> {
  await apiFetch(`/api/folders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

/** Supprime un dossier (les notes orphelines retournent dans l'inbox via PG). */
export async function deleteFolder(id: string): Promise<void> {
  await apiFetch(`/api/folders/${id}`, { method: 'DELETE' });
}

/** Met à jour le nom d'un dossier. */
export async function updateSmartFolderFilters(
  id: string,
  name: string,
  _filters?: unknown,
): Promise<void> {
  await apiFetch(`/api/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

// ── Tags ──────────────────────────────────────────────────────────────────────

/** Crée un tag — retourne son nom. */
export async function createTag(name: string): Promise<string> {
  await apiFetch('/api/tags', { method: 'POST', body: JSON.stringify({ name }) });
  return name;
}

/** Supprime un tag par nom (lookup id puis delete). */
export async function deleteTag(name: string): Promise<void> {
  const res = await fetch('/api/tags');
  if (!res.ok) return;
  const { data } = await res.json() as { data: { id: string; name: string }[] };
  const tag = data.find(t => t.name === name);
  if (tag) await apiFetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
}
