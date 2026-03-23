import { z } from 'zod';

export const registerSchema = z.object({
  email:           z.string().email('Email invalide.'),
  password:        z.string().min(8, 'Minimum 8 caractères.').max(128),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Les mots de passe ne correspondent pas.', path: ['confirmPassword'] },
);

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Le nom ne peut pas être vide.').max(100, 'Nom trop long (max 100 caractères).'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis.'),
  newPassword:     z.string().min(8, 'Minimum 8 caractères.').max(128),
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'Le nouveau mot de passe doit être différent de l\'actuel.', path: ['newPassword'] },
);
