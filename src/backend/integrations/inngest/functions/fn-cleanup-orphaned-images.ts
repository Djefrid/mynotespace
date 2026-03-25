/**
 * fn-cleanup-orphaned-images
 * ─────────────────────────
 * Supprime de R2 les images retirées du contenu d'une note lors d'un autosave.
 *
 * Déclencheur : note/images-orphaned
 * Payload     : { noteId, workspaceId, keys: string[] }
 *
 * Règles :
 *  - Vérifie que chaque clé appartient bien au workspace avant de supprimer
 *    (préfixe "workspaces/{workspaceId}/")
 *  - Batch de 1000 max (limite R2/S3)
 *  - Quiet: true → seules les erreurs sont retournées
 *  - Retire aussi les lignes Attachment correspondantes en DB
 */

import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { inngest, noteImagesOrphaned } from '../client';
import { prisma } from '@/src/backend/db/prisma';
import { r2, R2_BUCKET } from '@/src/backend/integrations/r2/client';

export const fnCleanupOrphanedImages = inngest.createFunction(
  {
    id:       'cleanup-orphaned-images',
    name:     'Supprimer les images orphelines de R2',
    retries:  3,
    triggers: noteImagesOrphaned,
  },
  async ({ event, step }: { event: { data: { noteId: string; workspaceId: string; keys: string[] } }; step: any }) => {
    const { noteId, workspaceId, keys } = event.data;

    if (keys.length === 0) return { deleted: 0 };

    // Sécurité : ne supprimer que les clés appartenant à ce workspace
    const expectedPrefix = `workspaces/${workspaceId}/`;
    const safeKeys = keys.filter(k => k.startsWith(expectedPrefix));

    if (safeKeys.length === 0) return { deleted: 0 };

    // Suppression R2 par batches de 1000
    const r2Objects = safeKeys.map(k => ({ Key: k }));
    const BATCH = 1000;
    for (let i = 0; i < r2Objects.length; i += BATCH) {
      const batch = r2Objects.slice(i, i + BATCH);
      await step.run(`delete-r2-orphans-${i}`, () =>
        r2.send(new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: { Objects: batch, Quiet: true },
        }))
      );
    }

    // Supprime les enregistrements Attachment orphelins en DB
    await step.run('delete-orphan-records', () =>
      prisma.attachment.deleteMany({
        where: {
          noteId,
          workspaceId,
          key: { in: safeKeys },
        },
      })
    );

    return { deleted: safeKeys.length, keys: safeKeys };
  },
);
