import { serve } from 'inngest/next';
import { inngest } from '@/src/backend/integrations/inngest/client';
import {
  fnIndexNote,
  fnRemoveNoteFromIndex,
  fnPurgeTrash,
  fnCleanupAttachments,
  fnCleanupOrphanedImages,
} from '@/src/backend/integrations/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fnIndexNote,
    fnRemoveNoteFromIndex,
    fnPurgeTrash,
    fnCleanupAttachments,
    fnCleanupOrphanedImages,
  ],
});
