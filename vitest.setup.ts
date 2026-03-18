/**
 * ============================================================================
 * SETUP VITEST — vitest.setup.ts
 * ============================================================================
 *
 * Fichier de setup exécuté avant chaque suite de tests.
 * Importe @testing-library/jest-dom pour activer les matchers DOM étendus :
 *   - toBeInTheDocument(), toHaveTextContent(), toBeDisabled(), etc.
 * ============================================================================
 */

import '@testing-library/jest-dom';
