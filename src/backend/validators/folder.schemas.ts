import { z } from 'zod';

export const createFolderSchema = z.object({
  name:     z.string().min(1).max(80).trim(),
  parentId: z.string().min(1).optional(),
});

export const updateFolderSchema = z.object({
  name:     z.string().min(1).max(80).trim().optional(),
  parentId: z.string().min(1).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);
