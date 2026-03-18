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
    /** Environnement jsdom — simule window, document, localStorage */
    environment: 'jsdom',
    /** Importe automatiquement @testing-library/jest-dom dans chaque test */
    setupFiles: ['./vitest.setup.ts'],
    /** Inclut les fichiers .test.ts et .test.tsx */
    include: ['**/*.test.{ts,tsx}'],
    /** Exclut node_modules et les répertoires Next.js */
    exclude: ['node_modules', '.next', 'dist'],
    globals: true,
  },
  resolve: {
    /** Résolution des alias @/ → racine du projet (comme next.config.js) */
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
