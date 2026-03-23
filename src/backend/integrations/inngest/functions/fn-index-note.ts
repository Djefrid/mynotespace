/**
 * fn-index-note — indexation Typesense fiable via Inngest.
 *
 * Écoute :
 *  - note/written → indexe la note (créée, modifiée, restaurée)
 *  - note/trashed → met à jour l'index avec status=TRASHED
 *  - note/deleted → supprime la note de l'index Typesense
 *
 * Pour written/trashed : indexNoteById relit depuis la DB, donc le statut
 * courant est automatiquement correct dans les deux cas.
 */

import { inngest, noteWritten, noteTrashed, noteDeleted } from '../client';
import { indexNoteById, removeFromIndex } from '@/src/backend/services/search.service';

export const fnIndexNote = inngest.createFunction(
  {
    id:       'index-note',
    name:     'Indexer une note dans Typesense',
    retries:  3,
    triggers: [noteWritten, noteTrashed],
  },
  async ({ event }: { event: { data: { noteId: string; workspaceId: string } } }) => {
    const { noteId, workspaceId } = event.data;
    await indexNoteById(noteId, workspaceId);
    return { indexed: noteId };
  },
);

export const fnRemoveNoteFromIndex = inngest.createFunction(
  {
    id:       'remove-note-from-index',
    name:     "Supprimer une note de l'index Typesense",
    retries:  3,
    triggers: noteDeleted,
  },
  async ({ event }: { event: { data: { noteId: string } } }) => {
    const { noteId } = event.data;
    await removeFromIndex(noteId);
    return { removed: noteId };
  },
);
