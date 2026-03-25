'use client';

import { useState, useEffect } from 'react';
import { History, X, RotateCcw, Clock } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';

interface Revision {
  id:        string;
  createdAt: string;
  wordCount: number;
  plainText: string;
}

interface NoteRevisionsModalProps {
  noteId:   string;
  onClose:  () => void;
  onRestore: (json: JSONContent) => void;
}

export function NoteRevisionsModal({ noteId, onClose, onRestore }: NoteRevisionsModalProps) {
  const [revisions, setRevisions]       = useState<Revision[]>([]);
  const [loading, setLoading]           = useState(true);
  const [restoring, setRestoring]       = useState<string | null>(null);
  const [preview, setPreview]           = useState<Revision | null>(null);

  useEffect(() => {
    fetch(`/api/notes/${noteId}/revisions`)
      .then(r => r.json())
      .then(({ data }) => setRevisions(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [noteId]);

  async function handleRestore(revisionId: string) {
    setRestoring(revisionId);
    try {
      const res = await fetch(`/api/notes/${noteId}/revisions/${revisionId}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      onRestore(data.json as JSONContent);
      onClose();
    } catch {
      alert('Erreur lors de la restauration.');
    } finally {
      setRestoring(null);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('fr-CA', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revisions-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#111520] rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-2">
            <History size={16} className="text-blue-500" aria-hidden="true" />
            <h2 id="revisions-modal-title" className="text-sm font-semibold text-gray-900 dark:text-white">
              Historique des versions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'historique"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-1 rounded"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="text-sm text-gray-400 text-center py-8">Chargement...</p>
          )}

          {!loading && revisions.length === 0 && (
            <div className="text-center py-8">
              <Clock size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucune version enregistrée pour l'instant.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Les versions sont créées automatiquement toutes les 5 minutes.
              </p>
            </div>
          )}

          {!loading && revisions.length > 0 && (
            <ul className="space-y-1">
              {revisions.map((rev, i) => (
                <li
                  key={rev.id}
                  className={`group flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                    preview?.id === rev.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'hover:bg-gray-50 dark:hover:bg-[#111520]'
                  }`}
                  onClick={() => setPreview(preview?.id === rev.id ? null : rev)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                        {formatDate(rev.createdAt)}
                      </span>
                      {i === 0 && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                          Plus récente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {rev.wordCount} mot{rev.wordCount !== 1 ? 's' : ''}
                    </p>
                    {preview?.id === rev.id && rev.plainText && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-3 leading-relaxed">
                        {rev.plainText.slice(0, 200)}{rev.plainText.length > 200 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleRestore(rev.id); }}
                    disabled={restoring === rev.id}
                    aria-label={`Restaurer la version du ${formatDate(rev.createdAt)}`}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 disabled:opacity-50 transition-colors px-2 py-1 rounded border border-transparent hover:border-blue-200 dark:hover:border-blue-700"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    {restoring === rev.id ? 'Restauration…' : 'Restaurer'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-dark-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Les 50 dernières versions sont conservées · Générées automatiquement toutes les 5 min
          </p>
        </div>
      </div>
    </div>
  );
}
