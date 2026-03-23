/**
 * Helpers pour construire des Request/Headers dans les tests d'intégration
 * des route handlers Next.js.
 */

/** Construit un Request POST avec body JSON */
export function makePost(url: string, body: unknown, headers?: Record<string, string>): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Construit un Request GET */
export function makeGet(url: string, headers?: Record<string, string>): Request {
  return new Request(url, {
    method: 'GET',
    headers: { ...headers },
  });
}

/** Construit un Request DELETE */
export function makeDelete(url: string, headers?: Record<string, string>): Request {
  return new Request(url, {
    method: 'DELETE',
    headers: { ...headers },
  });
}
