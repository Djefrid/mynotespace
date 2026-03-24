'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080c14] text-white">
        <h2 className="text-xl font-semibold">Une erreur critique est survenue</h2>
        <p className="text-sm text-gray-400">
          {error.message || 'Erreur inattendue'}
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
