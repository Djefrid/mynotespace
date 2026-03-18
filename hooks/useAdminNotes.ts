/**
 * ============================================================================
 * HOOK ADMIN NOTES — hooks/useAdminNotes.ts
 * ============================================================================
 *
 * Hook React qui établit 3 écouteurs Firestore en temps réel pour charger
 * et maintenir synchronisées toutes les données de l'éditeur de notes :
 *   - Notes actives (non supprimées)
 *   - Notes en corbeille (supprimées mais récupérables < 30 jours)
 *   - Dossiers (normaux + intelligents)
 *   - Bibliothèque de tags (liste globale triée alphabétiquement)
 *
 * Architecture en temps réel :
 *   Chaque onSnapshot() maintient une connexion WebSocket ouverte vers
 *   Firestore. Toute modification dans la base de données (depuis n'importe
 *   quel appareil ou onglet) se propage instantanément dans les états React.
 *   Les unsubscribe (unsub1, unsub2, unsub3) ferment ces connexions lors du
 *   démontage du composant pour éviter les fuites mémoire.
 *
 * Stratégie de chargement progressif :
 *   loading reste true jusqu'à ce que les 3 collections aient répondu au
 *   moins une fois. checkReady() incrémente via 3 flags booléens indépendants
 *   (notesReady, foldersReady, tagsReady). Dès que tous sont true, loading
 *   passe à false et l'UI peut s'afficher.
 *
 * Auto-purge de la corbeille (TRASH_RETENTION_DAYS = 30) :
 *   À chaque mise à jour de deletedNotes, un useEffect vérifie si certaines
 *   notes dépassent 30 jours en corbeille et les supprime définitivement.
 *   Cela réplique le comportement des corbeilles système (macOS, Gmail, etc.).
 *
 * Utilisation :
 *   const { notes, deletedNotes, folders, manualTags, loading } = useAdminNotes();
 *
 * Consommé par :
 *   components/admin/NotesEditor.tsx (composant principal de l'éditeur)
 * ============================================================================
 */

"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, Timestamp, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Note, Folder, permanentlyDeleteNote } from '@/lib/notes-service';

/**
 * Durée de rétention des notes en corbeille (en jours).
 * Après ce délai, les notes sont supprimées définitivement et irrécupérables.
 */
const TRASH_RETENTION_DAYS = 30;

/**
 * Hook principal de l'éditeur de notes.
 * Établit 3 listeners Firestore en temps réel et gère le cycle de vie
 * complet des données (notes actives, corbeille, dossiers, tags).
 *
 * @returns Objet contenant les données et l'état de chargement :
 *   - notes       : Note[]   — notes actives (non supprimées), triées par updatedAt desc
 *   - deletedNotes: Note[]   — notes en corbeille, triées par updatedAt desc
 *   - folders     : Folder[] — tous les dossiers (normaux + intelligents), triés par order asc
 *   - manualTags  : string[] — noms de tous les tags, triés alphabétiquement (fr)
 *   - loading     : boolean  — true jusqu'à ce que les 3 collections aient répondu
 */
export function useAdminNotes() {
  /** Notes actives — ne contient PAS les notes avec deletedAt non null */
  const [notes,        setNotes]        = useState<Note[]>([]);

  /** Notes en corbeille — contient UNIQUEMENT les notes avec deletedAt non null */
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);

  /** Dossiers (normaux et intelligents) */
  const [folders,      setFolders]      = useState<Folder[]>([]);

  /**
   * Bibliothèque globale de tags.
   * Contient tous les tags de la collection adminTags, triés par localeCompare('fr').
   * Utilisée pour l'autocomplétion (#tag) dans l'éditeur.
   */
  const [manualTags,   setManualTags]   = useState<string[]>([]);

  /**
   * Indicateur de chargement initial.
   * Reste true jusqu'à ce que les 3 onSnapshot aient retourné un premier résultat.
   * Permet d'afficher un spinner à l'ouverture de l'éditeur.
   */
  const [loading,      setLoading]      = useState(true);

  // ── Écoute Firestore — 3 listeners en temps réel ──────────────────────────
  useEffect(() => {
    // Guard : si Firestore n'est pas initialisé (ex: config manquante), on arrête
    if (!db) { setLoading(false); return; }

    /**
     * Flags de chargement initial pour chaque collection.
     * Chaque listener passe son flag à true dès sa première réponse.
     * Réinitialisés lors du remontage du composant via la closure.
     */
    let notesReady = false, foldersReady = false, tagsReady = false;

    /**
     * Vérifie si les 3 collections ont répondu au moins une fois.
     * Dès que tous les flags sont true, désactive le spinner de chargement.
     */
    const checkReady = () => {
      if (notesReady && foldersReady && tagsReady) setLoading(false);
    };

    // ── Listener 1 : collection adminNotes (actives + corbeille) ────────────
    // orderBy('updatedAt', 'desc') : notes les plus récemment modifiées en premier
    // limit(200) : pagination légère — évite de charger des milliers de notes
    //              en mémoire. 200 notes couvre 99% des usages réels.
    const unsub1 = onSnapshot(
      query(collection(db, 'adminNotes'), orderBy('updatedAt', 'desc'), limit(200)),
      (snap) => {
        // Convertit chaque document Firestore en objet Note typé
        const all: Note[] = snap.docs.map((d) => {
          const v = d.data();
          return {
            id:        d.id,
            title:     v.title    ?? '',
            content:   v.content  ?? '',
            pinned:    v.pinned   ?? false,
            folderId:  v.folderId ?? null,
            tags:      v.tags     ?? [],
            // Timestamps Firestore → Date JS (null si champ absent)
            deletedAt: (v.deletedAt as Timestamp)?.toDate() ?? null,
            createdAt: (v.createdAt as Timestamp)?.toDate() ?? new Date(),
            updatedAt: (v.updatedAt as Timestamp)?.toDate() ?? new Date(),
          } as Note;
        });
        // Sépare les notes actives des notes en corbeille selon deletedAt
        setNotes(all.filter(n => !n.deletedAt));
        setDeletedNotes(all.filter(n => !!n.deletedAt));
        notesReady = true;
        checkReady();
      }
    );

    // ── Listener 2 : collection adminFolders (normaux + intelligents) ────────
    // orderBy('order', 'asc') : respecte l'ordre défini par l'utilisateur (drag & drop)
    const unsub2 = onSnapshot(
      query(collection(db, 'adminFolders'), orderBy('order', 'asc')),
      (snap) => {
        setFolders(snap.docs.map((d) => {
          const v = d.data();
          return {
            id:        d.id,
            name:      v.name     ?? '',
            order:     v.order    ?? 0,
            parentId:  v.parentId ?? null,
            isSmart:   v.isSmart  ?? false,    // true → dossier intelligent (filtre automatique)
            filters:   v.filters  ?? undefined, // Présent uniquement pour les dossiers intelligents
            createdAt: (v.createdAt as Timestamp)?.toDate() ?? new Date(),
            updatedAt: (v.updatedAt as Timestamp)?.toDate() ?? new Date(),
          } as Folder;
        }));
        foldersReady = true;
        checkReady();
      }
    );

    // ── Listener 3 : collection adminTags (bibliothèque globale de tags) ─────
    // Pas de orderBy Firestore — tri côté client par localeCompare('fr')
    // pour garantir un tri alphabétique correct avec les caractères accentués
    const unsub3 = onSnapshot(
      collection(db, 'adminTags'),
      (snap) => {
        const names = snap.docs
          // Utilise d.data().name si disponible, sinon l'ID du document comme fallback
          .map(d => (d.data().name as string) ?? d.id)
          .filter(Boolean) // Supprime les chaînes vides
          .sort((a, b) => a.localeCompare(b, 'fr')); // Tri alphabétique respectant l'accent français
        setManualTags(names);
        tagsReady = true;
        checkReady();
      }
    );

    // Cleanup : ferme les 3 connexions WebSocket à la désactivation de l'effet
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []); // Dépendances vides : les listeners sont établis une seule fois au montage

  // ── Auto-purge : supprime définitivement les notes > 30 jours en corbeille ─
  useEffect(() => {
    // Calcule la date limite (maintenant - 30 jours en millisecondes)
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400000);

    // Filtre les notes dont deletedAt est antérieur au cutoff
    const toDelete = deletedNotes.filter(n => n.deletedAt && n.deletedAt < cutoff);
    if (toDelete.length === 0) return;

    // Suppression en parallèle (Promise.all) au lieu de forEach séquentiel.
    // Chaque permanentlyDeleteNote supprime le doc Firestore ET les fichiers Storage.
    // Exécution concurrente → plus rapide quand plusieurs notes expirent le même jour.
    Promise.all(toDelete.map(n => permanentlyDeleteNote(n.id))).catch(console.error);
  }, [deletedNotes]); // Se déclenche à chaque mise à jour de la corbeille

  return { notes, deletedNotes, folders, manualTags, loading };
}
