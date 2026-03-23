const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Valide qu'une URL utilise uniquement un protocole autorisé (http, https, mailto).
 * Bloque javascript:, data:, vbscript:, etc. — prévention XSS.
 */
export function isSafeUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed.startsWith('http') || trimmed.startsWith('mailto:')
      ? trimmed
      : `https://${trimmed}`
    );
    return SAFE_PROTOCOLS.includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalise une URL utilisateur : ajoute https:// si aucun protocole détecté.
 * Retourne null si l'URL n'est pas sûre.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = trimmed.includes('://') || trimmed.startsWith('mailto:')
    ? trimmed
    : `https://${trimmed}`;
  return isSafeUrl(withProto) ? withProto : null;
}
