import 'server-only';

/**
 * Gestion des mots de passe — migration progressive bcrypt → Argon2id
 *
 * Stratégie :
 *   - Nouveaux comptes     → Argon2id directement
 *   - Comptes existants    → bcrypt vérifié au login, re-hashé en Argon2id silencieusement
 *   - Argon2id reconnu par le préfixe "$argon2id$"
 *   - bcrypt reconnu par le préfixe "$2b$" / "$2a$" / "$2y$"
 *
 * Paramètres Argon2id (conformes OWASP 2025) :
 *   memoryCost : 19 456 = 19 MiB  → résistance GPU/ASIC
 *   timeCost   : 2 itérations
 *   parallelism: 1 thread
 */

import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

// Argon2id est l'algorithme par défaut de @node-rs/argon2 — inutile de l'importer
const ARGON2_OPTIONS = {
  memoryCost:  19_456, // 19 MiB (minimum OWASP)
  timeCost:    2,
  parallelism: 1,
};

/** Détecte si un hash est un hash bcrypt legacy */
function isBcryptHash(h: string): boolean {
  return h.startsWith('$2b$') || h.startsWith('$2a$') || h.startsWith('$2y$');
}

/**
 * Vérifie un mot de passe contre un hash stocké.
 * Supporte bcrypt (legacy) et Argon2id (nouveau).
 *
 * @returns valid      — true si le mot de passe correspond
 * @returns needsRehash — true si le hash est bcrypt et doit être migré vers Argon2id
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isBcryptHash(storedHash)) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: valid }; // re-hash seulement si le mot de passe est correct
  }

  // Hash Argon2id
  const valid = await argon2Verify(storedHash, password);
  return { valid, needsRehash: false };
}

/**
 * Hash un mot de passe avec Argon2id.
 * À utiliser pour tout nouveau hash (inscription, changement de mot de passe).
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}
