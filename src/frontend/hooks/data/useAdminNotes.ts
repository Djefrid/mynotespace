// Compat — le hook s'appelle maintenant useNotes.
// Cet alias est conservé pour ne pas casser les imports existants (vitest, etc.)
export { useNotes as useAdminNotes } from './useNotes';
