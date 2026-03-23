import 'server-only';

import { Client, type CollectionCreateSchema } from 'typesense';

// ── Client Typesense ──────────────────────────────────────────────────────────

let _tsClient: Client | null = null;

/**
 * Retourne le client Typesense.
 * Lazy : ne throw que si les vars manquent ET qu'on tente de l'utiliser.
 */
export function getTsClient(): Client {
  if (_tsClient) return _tsClient;

  const host   = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_API_KEY;

  if (!host || !apiKey) {
    throw new Error('TYPESENSE_HOST et TYPESENSE_API_KEY sont requis');
  }

  _tsClient = new Client({
    nodes:                    [{ host, port: 443, protocol: 'https' }],
    apiKey,
    connectionTimeoutSeconds: 5,
    retryIntervalSeconds:     0.1,
    numRetries:               2,
  });
  return _tsClient;
}

// ── Schéma de la collection notes ────────────────────────────────────────────

export const NOTES_COLLECTION = 'notes';

/** Document stocké dans Typesense pour chaque note. */
export interface NoteDocument {
  id:           string;   // = noteId
  workspace_id: string;   // filtre de sécurité — toujours injecté côté serveur
  title:        string;
  plain_text:   string;   // contenu HTML stripé
  status:       string;   // 'ACTIVE' | 'TRASHED'
  is_pinned:    boolean;
  folder_id:    string;   // '' si pas de dossier
  updated_at:   number;   // Unix seconds (int64) — tri par défaut
}

const notesSchema: CollectionCreateSchema = {
  name: NOTES_COLLECTION,
  fields: [
    { name: 'id',           type: 'string' },
    { name: 'workspace_id', type: 'string', facet: true, index: true },
    { name: 'title',        type: 'string', infix: true },
    { name: 'plain_text',   type: 'string' },
    { name: 'status',       type: 'string', facet: true },
    { name: 'is_pinned',    type: 'bool',   facet: true },
    { name: 'folder_id',    type: 'string', facet: true, optional: true },
    { name: 'updated_at',   type: 'int64',  sort:  true },
  ],
  default_sorting_field: 'updated_at',
};

// ── Initialisation paresseuse de la collection ────────────────────────────────
// Crée la collection si elle n'existe pas encore.
// Résultat mis en cache : une seule tentative par processus.

let _ensurePromise: Promise<void> | null = null;

export function ensureCollection(): Promise<void> {
  if (_ensurePromise) return _ensurePromise;

  _ensurePromise = getTsClient()
    .collections(NOTES_COLLECTION)
    .retrieve()
    .then(() => {/* existe déjà */})
    .catch(async () => {
      // La collection n'existe pas — on la crée
      await getTsClient().collections().create(notesSchema);
    })
    .catch((err) => {
      // Réinitialise pour réessayer au prochain appel
      _ensurePromise = null;
      console.error('[Typesense ensureCollection]', err);
    }) as Promise<void>;

  return _ensurePromise;
}