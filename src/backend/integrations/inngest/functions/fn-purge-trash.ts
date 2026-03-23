/**
 * fn-purge-trash — purge automatique de la corbeille.
 *
 * Déclenché chaque jour à 03:00 UTC.
 * Supprime définitivement les notes en corbeille depuis plus de 30 jours,
 * puis envoie un événement note/deleted pour chaque note supprimée
 * (→ nettoyage Typesense + R2 via fn-remove-note-from-index + fn-cleanup-attachments).
 */

import { cron } from 'inngest';
import { inngest, noteDeleted } from '../client';
import { purgeOldTrashedNotes } from '@/src/backend/services/notes-pg.service';

const TRASH_RETENTION_DAYS = 30;

export const fnPurgeTrash = inngest.createFunction(
  {
    id:       'purge-trash',
    name:     'Purger la corbeille (notes > 30 jours)',
    retries:  2,
    triggers: cron('0 3 * * *'), // 03:00 UTC chaque jour
  },
  async ({ step }: { step: any }) => {
    const deletedIds: string[] = await step.run('delete-old-notes', () =>
      purgeOldTrashedNotes(TRASH_RETENTION_DAYS)
    );

    if (deletedIds.length === 0) {
      return { purged: 0 };
    }

    // Déclenche le nettoyage index + R2 pour chaque note supprimée
    await step.sendEvent(
      'send-deleted-events',
      deletedIds.map((noteId: string) => noteDeleted.create({ noteId, workspaceId: '' }))
    );

    return { purged: deletedIds.length, ids: deletedIds };
  },
);
