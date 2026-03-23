import 'server-only';

/**
 * Client Inngest pour mynotespace — API v4.
 *
 * Événements :
 *  - note/written  → indexation (création, mise à jour, restauration)
 *  - note/trashed  → mise à jour statut dans l'index Typesense
 *  - note/deleted  → suppression index + nettoyage attachments R2
 */

import { Inngest, eventType, staticSchema } from 'inngest';

// ── Définitions d'événements typés ───────────────────────────────────────────

export const noteWritten = eventType('note/written', {
  schema: staticSchema<{ noteId: string; workspaceId: string }>(),
});

export const noteTrashed = eventType('note/trashed', {
  schema: staticSchema<{ noteId: string; workspaceId: string }>(),
});

export const noteDeleted = eventType('note/deleted', {
  schema: staticSchema<{ noteId: string; workspaceId: string }>(),
});

// ── Singleton client ──────────────────────────────────────────────────────────

export const inngest = new Inngest({ id: 'mynotespace' });