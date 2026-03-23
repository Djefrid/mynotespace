/**
 * ============================================================================
 * TYPES GLOBAUX — types/index.ts
 * ============================================================================
 *
 * Définitions TypeScript partagées dans mynotespace.
 * Les types Note, Folder, Tag, SmartFolderFilter sont définis dans
 * lib/notes-service.ts et exportés directement depuis là.
 * ============================================================================
 */

// Ré-exports pratiques pour les imports raccourcis
export type { Note, Folder, Tag, SmartFolderFilter } from '@/lib/notes-service';
