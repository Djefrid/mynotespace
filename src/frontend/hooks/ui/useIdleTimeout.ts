"use client";

import { useEffect, useRef, useCallback } from 'react';

/** Événements considérés comme "activité utilisateur" */
const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'scroll', 'wheel',
] as const;

interface UseIdleTimeoutOptions {
  /** Durée d'inactivité avant d'afficher l'avertissement (ms) */
  warningAfterMs: number;
  /** Durée d'inactivité avant déconnexion automatique (ms) */
  logoutAfterMs: number;
  /** Appelé quand l'avertissement doit s'afficher */
  onWarning: () => void;
  /** Appelé quand la déconnexion automatique doit se déclencher */
  onLogout: () => void;
  /** Appelé quand l'utilisateur reprend son activité (pour cacher l'avertissement) */
  onReset: () => void;
}

/**
 * Détecte l'inactivité utilisateur et déclenche des callbacks.
 *
 * Flux :
 *   1. Aucune activité pendant `warningAfterMs` → `onWarning()`
 *   2. Aucune activité pendant `logoutAfterMs`  → `onLogout()`
 *   3. Activité détectée → reset des timers + `onReset()`
 */
export function useIdleTimeout({
  warningAfterMs,
  logoutAfterMs,
  onWarning,
  onLogout,
  onReset,
}: UseIdleTimeoutOptions) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onWarningRef = useRef(onWarning);
  const onLogoutRef  = useRef(onLogout);
  const onResetRef   = useRef(onReset);

  // Mise à jour des refs sans re-créer les listeners
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onLogoutRef.current  = onLogout;  }, [onLogout]);
  useEffect(() => { onResetRef.current   = onReset;   }, [onReset]);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current)  clearTimeout(logoutTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    warningTimer.current = setTimeout(() => {
      onWarningRef.current();
      logoutTimer.current = setTimeout(() => {
        onLogoutRef.current();
      }, logoutAfterMs - warningAfterMs);
    }, warningAfterMs);
  }, [clearTimers, warningAfterMs, logoutAfterMs]);

  const handleActivity = useCallback(() => {
    onResetRef.current();
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    resetTimers();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [resetTimers, handleActivity, clearTimers]);
}
