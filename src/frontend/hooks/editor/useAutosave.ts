/**
 * ============================================================================
 * HOOK AUTOSAVE — hooks/notes/useAutosave.ts
 * ============================================================================
 *
 * Gère la sauvegarde automatique des notes dans Firestore.
 *
 * Fonctionnalités :
 *   - Autosave différé (AUTOSAVE_DELAY_MS après la dernière frappe)
 *   - Sauvegarde immédiate (Ctrl+S)
 *   - Background Sync API : si Firestore échoue, enregistre un tag SW
 *     → le navigateur retente automatiquement à la reconnexion
 *   - Listener SW : reçoit BACKGROUND_SYNC_READY → relance updateNote()
 *   - saveLabel / saveColor : libellés dérivés du statut pour l'UI
 *
 * Paramètres reçus :
 *   selectedId   — ID de la note ouverte (null = pas de note sélectionnée)
 *   isReadOnly   — true si la note est dans la corbeille (pas de save)
 *   prevTitle    — ref partagée vers le dernier titre envoyé (note sélection)
 *   prevContent  — ref partagée vers le dernier contenu envoyé
 *
 * Valeurs retournées :
 *   saveStatus          — 'saved' | 'saving' | 'unsaved' | 'error'
 *   setSaveStatus       — setter direct (utilisé par sync multi-appareil)
 *   lastSaved           — Date de la dernière save réussie (null = jamais)
 *   setLastSaved        — setter direct
 *   saveTimer           — ref du timer (pour clearTimeout au changement de note)
 *   scheduleAutoSave    — planifie une save différée
 *   saveImmediately     — save immédiate (Ctrl+S)
 *   registerBackgroundSync — enregistre un Background Sync SW
 *   saveLabel           — texte affiché dans l'UI (ex: "Sauvegardé 14:32")
 *   saveColor           — classe Tailwind de couleur selon le statut
 * ============================================================================
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { updateNote } from '../../services/notes-mutations-api';
import { stripHtml } from '@/lib/notes-utils';
import { AUTOSAVE_DELAY_MS } from '@/lib/notes-types';
import type { SaveStatus } from '@/lib/notes-types';

// ── Interface paramètres ───────────────────────────────────────────────────────

interface UseAutosaveParams {
  /** ID de la note actuellement ouverte — null si aucune note sélectionnée */
  selectedId:   string | null;
  /** true si la note est en corbeille — bloque toute sauvegarde */
  isReadOnly:   boolean;
  /**
   * Ref partagée vers le titre courant (ownership : useNoteSelection).
   * Passée ici pour que le listener Background Sync puisse lire la valeur
   * stable sans être recréé à chaque frappe.
   */
  prevTitle:    MutableRefObject<string>;
  /**
   * Ref partagée vers le contenu HTML courant (ownership : useNoteSelection).
   * Même raison que prevTitle.
   */
  prevContent:  MutableRefObject<string>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutosave({
  selectedId,
  isReadOnly,
  prevTitle,
  prevContent,
}: UseAutosaveParams) {

  // ── État de sauvegarde ─────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSaved,  setLastSaved]  = useState<Date | null>(null);

  /** Timer de l'autosave différé — exposé pour que le hook de sélection
   *  puisse l'annuler lors du changement de note (évite un save fantôme). */
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Dernier titre envoyé avec succès à l'API.
   * Permet d'éviter d'envoyer PATCH /api/notes/[id] quand seul le contenu
   * a changé (la route métadonnées n'est appelée que si le titre a évolué).
   */
  const savedTitleRef = useRef('');

  // Réinitialise le titre sauvegardé à chaque changement de note sélectionnée
  useEffect(() => {
    savedTitleRef.current = '';
  }, [selectedId]);

  // ── Background Sync — enregistrement lors d'un échec ──────────────────────
  /**
   * Envoie REGISTER_SYNC au Service Worker actif.
   * Le SW appelle self.registration.sync.register('sync-notes').
   * Le navigateur déclenchera l'événement 'sync' à la reconnexion.
   * Fallback silencieux si BG Sync non supporté (iOS Safari, Firefox).
   */
  const registerBackgroundSync = useCallback(() => {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({ type: 'REGISTER_SYNC' });
      })
      .catch(() => {/* SW indisponible — Firestore retente via IndexedDB */});
  }, []);

  // ── Autosave différé ───────────────────────────────────────────────────────
  /**
   * Planifie une sauvegarde après AUTOSAVE_DELAY_MS ms.
   * Chaque appel remet le timer à zéro (debounce).
   * Met à jour prevTitle/prevContent pour la détection de notes vides.
   *
   * @param t - Titre courant
   * @param c - Contenu HTML courant
   */
  const scheduleAutoSave = useCallback((t: string, c: string) => {
    if (!selectedId || isReadOnly) return;
    prevTitle.current   = t;
    prevContent.current = c;
    setSaveStatus('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const titleChanged = t !== savedTitleRef.current;
        await updateNote(selectedId, {
          ...(titleChanged && { title: t }),
          content: c,
        });
        if (titleChanged) savedTitleRef.current = t;
        setLastSaved(new Date());
        setSaveStatus('saved');
      } catch {
        // Sauvegarde échouée → Background Sync pour retry à la reconnexion
        setSaveStatus('error');
        registerBackgroundSync();
      }
    }, AUTOSAVE_DELAY_MS);
  }, [selectedId, isReadOnly, prevTitle, prevContent, registerBackgroundSync]);

  // ── Sauvegarde immédiate (Ctrl+S) ──────────────────────────────────────────
  /**
   * Sauvegarde sans délai — utilisé par le raccourci Ctrl+S.
   * Annule le timer d'autosave en cours pour éviter un double-envoi.
   *
   * @param t - Titre courant
   * @param c - Contenu HTML courant
   */
  const saveImmediately = useCallback((t: string, c: string) => {
    if (!selectedId || isReadOnly) return;
    clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    const titleChanged = t !== savedTitleRef.current;
    updateNote(selectedId, { ...(titleChanged && { title: t }), content: c })
      .then(() => {
        if (titleChanged) savedTitleRef.current = t;
        setLastSaved(new Date()); setSaveStatus('saved');
      })
      .catch(() => { setSaveStatus('error'); registerBackgroundSync(); });
  }, [selectedId, isReadOnly, registerBackgroundSync]);

  // ── Listener Background Sync (SW → App) ───────────────────────────────────
  /**
   * Écoute les messages { type: 'BACKGROUND_SYNC_READY' } du SW.
   * Déclenchés quand la connexion est restaurée après une perte réseau.
   * Re-tente la sauvegarde avec les valeurs stables depuis les refs.
   */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'BACKGROUND_SYNC_READY') return;
      // Lecture depuis les refs — valeurs stables, pas de re-création du listener
      const t = prevTitle.current;
      const c = prevContent.current;
      if (!selectedId || isReadOnly || (!t.trim() && !stripHtml(c).trim())) return;
      setSaveStatus('saving');
      const titleChanged = t !== savedTitleRef.current;
      updateNote(selectedId, { ...(titleChanged && { title: t }), content: c })
        .then(() => {
          if (titleChanged) savedTitleRef.current = t;
          setLastSaved(new Date()); setSaveStatus('saved');
        })
        .catch(() => setSaveStatus('error'));
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [selectedId, isReadOnly, prevTitle, prevContent]);

  // ── Libellés UI dérivés du statut ──────────────────────────────────────────

  /**
   * Retourne le texte affiché à côté de l'indicateur de statut.
   * Appelé à chaque render — dépend de saveStatus et lastSaved.
   */
  const saveLabel = () => {
    if (saveStatus === 'saving')  return 'Sauvegarde...';
    if (saveStatus === 'unsaved') return 'Non sauvegardé';
    if (saveStatus === 'error')   return 'Erreur';
    if (lastSaved) return `Sauvegardé ${lastSaved.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`;
    return '';
  };

  /** Classe Tailwind de couleur selon le statut de sauvegarde */
  const saveColor =
    saveStatus === 'error'   ? 'text-red-400' :
    saveStatus === 'unsaved' ? 'text-yellow-400' :
    saveStatus === 'saving'  ? 'text-gray-400' : 'text-gray-500';

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    saveStatus,
    setSaveStatus,
    lastSaved,
    setLastSaved,
    saveTimer,
    scheduleAutoSave,
    saveImmediately,
    registerBackgroundSync,
    saveLabel,
    saveColor,
  };
}
