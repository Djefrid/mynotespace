/**
 * fn-cleanup-attachments — nettoyage des fichiers R2 orphelins.
 *
 * Scaffold — sera complété quand l'API upload sera connectée au frontend.
 *
 * Déclenché par : note/deleted
 * Objectif : supprimer les objets R2 associés à une note supprimée définitivement
 * et retirer les enregistrements Attachment de la base.
 *
 * Pour l'instant : supprime les enregistrements Attachment en DB (sans orphelins R2).
 * La suppression R2 réelle sera ajoutée dans une itération future
 * (nécessite DeleteObjectsCommand + listing par préfixe).
 */

import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { inngest, noteDeleted } from '../client';
import { prisma } from '@/src/backend/db/prisma';
import { r2, R2_BUCKET } from '@/src/backend/integrations/r2/client';

export const fnCleanupAttachments = inngest.createFunction(
  {
    id:       'cleanup-attachments',
    name:     "Nettoyer les attachments d'une note supprimée",
    retries:  3,
    triggers: noteDeleted,
  },
  async ({ event, step }: { event: { data: { noteId: string; workspaceId: string } }; step: any }) => {
    const { noteId, workspaceId } = event.data;

    // Récupère les clés R2 avant suppression (pour logging)
    // workspaceId inclus : isolation garantie même sur un noteId recyclé
    const attachments: { id: string; key: string }[] = await step.run('fetch-attachments', () =>
      prisma.attachment.findMany({
        where:  { noteId, workspaceId },
        select: { id: true, key: true },
      })
    );

    if (attachments.length === 0) {
      return { cleaned: 0 };
    }

    // Supprime les objets R2 par batches de 1000 (limite S3/R2)
    const r2Keys = attachments.map((a) => ({ Key: a.key }));
    const BATCH  = 1000;
    for (let i = 0; i < r2Keys.length; i += BATCH) {
      const batch = r2Keys.slice(i, i + BATCH);
      await step.run(`delete-r2-batch-${i}`, () =>
        r2.send(new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: { Objects: batch, Quiet: true }, // Quiet: true = ne retourne que les erreurs
        }))
      );
    }

    // Supprime les enregistrements Attachment en DB
    await step.run('delete-attachment-records', () =>
      prisma.attachment.deleteMany({ where: { noteId, workspaceId } })
    );

    return {
      cleaned: attachments.length,
      keys:    attachments.map((a) => a.key),
    };
  },
);
