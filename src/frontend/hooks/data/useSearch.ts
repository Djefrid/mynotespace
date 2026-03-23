"use client";

import { useState, useEffect, useRef } from 'react';

export interface SearchNoteResult {
  id:         string;
  title:      string;
  plain_text: string;
  status:     string;
  is_pinned:  boolean;
  folder_id:  string;
  updated_at: number;
  highlights?: { field: string; snippet: string }[];
}

/**
 * Recherche backend debounced (350 ms) via GET /api/search.
 * Retourne un tableau vide si query est vide.
 */
export function useSearch(query: string) {
  const [results,    setResults]    = useState<SearchNoteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=50`);
        if (res.ok) {
          const { data } = await res.json() as { data: SearchNoteResult[] };
          setResults(data ?? []);
        }
      } catch {
        // silencieux — pas de crash si l'API est indisponible
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return { results, isSearching };
}
