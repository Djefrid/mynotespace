/**
 * ============================================================================
 * CONFIGURATION VITEST — vitest.config.ts
 * ============================================================================
 *
 * Configuration de l'environnement de tests unitaires.
 * Utilise jsdom pour simuler le DOM du navigateur dans Node.js.
 * Plugin React permet de transformer le JSX/TSX pour les tests.
 * ============================================================================
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    /** Environnement jsdom par défaut — les tests d'intégration (// @vitest-environment node) l'écrasent */
    environment: 'jsdom',
    /** Fichiers tests/integration/** tournent en Node (pas de DOM) */
    environmentMatchGlobs: [['tests/integration/**', 'node']],
    /** Importe automatiquement @testing-library/jest-dom dans chaque test */
    setupFiles: ['./vitest.setup.ts'],
    /** Inclut les fichiers .test.ts et .test.tsx */
    include: ['**/*.test.{ts,tsx}'],
    /** Exclut node_modules et les répertoires Next.js */
    exclude: ['node_modules', '.next', 'dist'],
    globals: true,
  },
  resolve: {
    /** Résolution des alias @/ → racine du projet + aliases de refactoring structurel */
    alias: {
      '@/app/login/page': path.resolve(__dirname, 'app/(public)/login/page'),
      '@/app/notes/page': path.resolve(__dirname, 'app/(app)/notes/page'),
      '@/app/page': path.resolve(__dirname, 'app/(public)/page'),
      '@/components/Providers': path.resolve(__dirname, 'src/frontend/providers/Providers'),
      '@/components/NotesEditor': path.resolve(__dirname, 'src/frontend/components/editor/NotesEditor'),
      '@/components/NotesEditorErrorBoundary': path.resolve(__dirname, 'src/frontend/components/editor/NotesEditorErrorBoundary'),
      '@/components/notes/EditorToolbar': path.resolve(__dirname, 'src/frontend/components/editor/EditorToolbar'),
      '@/components/notes/BubbleLinkPopup': path.resolve(__dirname, 'src/frontend/components/editor/BubbleLinkPopup'),
      '@/components/notes/CodeModal': path.resolve(__dirname, 'src/frontend/components/editor/CodeModal'),
      '@/components/notes/ExcalidrawModal': path.resolve(__dirname, 'src/frontend/components/editor/ExcalidrawModal'),
      '@/components/notes/FolderTreeItem': path.resolve(__dirname, 'src/frontend/components/folders/FolderTreeItem'),
      '@/components/notes/SmartFolderModal': path.resolve(__dirname, 'src/frontend/components/folders/SmartFolderModal'),
      '@/components/notes/FlyToTrash': path.resolve(__dirname, 'src/frontend/components/common/FlyToTrash'),
      '@/components': path.resolve(__dirname, 'src/frontend/components'),
      '@/hooks/useAuth': path.resolve(__dirname, 'src/frontend/hooks/data/useAuth'),
      '@/hooks/useAdminNotes': path.resolve(__dirname, 'src/frontend/hooks/data/useAdminNotes'),
      '@/hooks/notes/useNoteEditor': path.resolve(__dirname, 'src/frontend/hooks/editor/useNoteEditor'),
      '@/hooks/notes/useAutosave': path.resolve(__dirname, 'src/frontend/hooks/editor/useAutosave'),
      '@/hooks/notes/useImageFile': path.resolve(__dirname, 'src/frontend/hooks/editor/useImageFile'),
      '@/hooks/notes/useImportExport': path.resolve(__dirname, 'src/frontend/hooks/editor/useImportExport'),
      '@/hooks/notes/useContentAutocomplete': path.resolve(__dirname, 'src/frontend/hooks/editor/useContentAutocomplete'),
      '@/hooks/notes/useTitleAutocomplete': path.resolve(__dirname, 'src/frontend/hooks/editor/useTitleAutocomplete'),
      '@/hooks/notes/useNoteFilters': path.resolve(__dirname, 'src/frontend/hooks/data/useNoteFilters'),
      '@/hooks/notes/useNoteSelection': path.resolve(__dirname, 'src/frontend/hooks/ui/useNoteSelection'),
      '@/hooks': path.resolve(__dirname, 'src/frontend/hooks'),
      '@/lib/notes-service': path.resolve(__dirname, 'src/backend/services/notes.service'),
      '@/lib/notes-types': path.resolve(__dirname, 'src/domain/notes/note.types'),
      '@/lib/notes-utils': path.resolve(__dirname, 'src/domain/notes/note.utils'),
      '@/lib/utils': path.resolve(__dirname, 'src/shared/utils/cn'),
      '@/lib/upload-image': path.resolve(__dirname, 'src/backend/integrations/storage/upload'),
      '@/lib/docx-utils': path.resolve(__dirname, 'src/frontend/lib/utils/docx-utils'),
      '@/lib/pdf-utils': path.resolve(__dirname, 'src/frontend/lib/utils/pdf-utils'),
      '@/lib/tiptap-extensions': path.resolve(__dirname, 'src/frontend/lib/utils/tiptap-extensions'),
      '@/types': path.resolve(__dirname, 'src/shared/types/index'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
