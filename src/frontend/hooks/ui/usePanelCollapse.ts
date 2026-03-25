"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * Gère l'état ouvert/fermé d'un panneau avec persistance localStorage.
 * SSR-safe : localStorage n'est lu qu'au montage côté client.
 *
 * @param key         Clé localStorage (ex: 'mns:sidebar-open')
 * @param defaultOpen Valeur par défaut si rien en localStorage (true = ouvert)
 * @returns [open, toggle, setOpen]
 */
export function usePanelCollapse(key: string, defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen);

  // Lecture localStorage uniquement côté client (évite l'hydration mismatch SSR)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setOpen(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [key]);

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  const set = useCallback((value: boolean) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    setOpen(value);
  }, [key]);

  return [open, toggle, set] as const;
}
