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

import { inngest, noteDeleted } from '../client';
import { prisma } from '@/src/backend/db/prisma';

export const fnCleanupAttachments = inngest.createFunction(
  {
    id:       'cleanup-attachments',
    name:     "Nettoyer les attachments d'une note supprimée",
    retries:  3,
    triggers: noteDeleted,
  },
  async ({ event, step }: { event: { data: { noteId: string } }; step: any }) => {
    const { noteId } = event.data;

    // Récupère les clés R2 avant suppression (pour logging)
    const attachments: { id: string; key: string }[] = await step.run('fetch-attachments', () =>
      prisma.attachment.findMany({
        where:  { noteId },
        select: { id: true, key: true },
      })
    );

    if (attachments.length === 0) {
      return { cleaned: 0 };
    }

    // TODO (itération suivante) : supprimer les objets dans R2 via DeleteObjectsCommand
    // const r2Keys = attachments.map(a => ({ Key: a.key }));
    // await r2.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: r2Keys } }));

    // Supprime les enregistrements Attachment en DB
    await step.run('delete-attachment-records', () =>
      prisma.attachment.deleteMany({ where: { noteId } })
    );

    return {
      cleaned: attachments.length,
      keys:    attachments.map((a) => a.key),
    };
  },
);
