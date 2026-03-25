import { z } from 'zod';

export const createNoteSchema = z.object({
  title:    z.string().max(200).optional(),
  html:     z.string().optional(),
  folderId: z.string().min(1).optional(),
});

/** Métadonnées uniquement — le contenu HTML va sur PATCH /api/notes/[id]/content */
export const updateNoteSchema = z.object({
  title:    z.string().max(200).optional(),
  folderId: z.string().min(1).nullable().optional(),
  isPinned: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

/** Sauvegarde du contenu — route dédiée /api/notes/[id]/content.
 *  json      = structure ProseMirror (source de vérité)
 *  html      = dérivé cache (exports)
 *  plainText = dérivé recherche (Typesense)
 */
export const saveContentSchema = z.object({
  html:            z.string(),
  json:            z.record(z.string(), z.unknown()).optional(),
  plainText:       z.string().optional(),
  wordCount:       z.number().int().min(0).optional(),
  characterCount:  z.number().int().min(0).optional(),
});

/** Paramètres de recherche Typesense */
export const searchNotesSchema = z.object({
  q:        z.string().default(''),
  status:   z.enum(['ACTIVE', 'TRASHED']).optional(),
  folderId: z.string().min(1).optional(),
  limit:    z.coerce.number().int().min(1).max(100).optional(),
  page:     z.coerce.number().int().min(1).optional(),
});

/**
 * folderId accepte :
 *  - un cuid   → filtrer par ce dossier
 *  - 'null'    → filtrer les notes sans dossier (inbox)
 *  - absent    → pas de filtre sur le dossier
 */
export const listNotesSchema = z.object({
  status:   z.enum(['ACTIVE', 'TRASHED']).optional(),
  folderId: z.union([z.string().min(1), z.literal('null')]).optional(),
  cursor:   z.string().optional(),
  limit:    z.coerce.number().int().min(1).max(200).optional(),
});
