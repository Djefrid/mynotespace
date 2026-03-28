"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon, Shield, FolderOpen,
  LogOut, Trash2, Download, FileText,
  AlertTriangle, X, Pencil, Check, AlertCircle, Users,
  Palette, Search,
} from 'lucide-react';
import {
  PROFILE_NAV,
  PROFILE_ACCOUNT,
  PROFILE_SECURITY,
  PROFILE_WORKSPACE,
  PROFILE_MEMBERS,
  PROFILE_DATA,
  PROFILE_DANGER,
  PROFILE_APPEARANCE,
} from '@/src/frontend/content/copy';
import ThemeToggle from '@/src/frontend/components/common/ThemeToggle';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceMember {
  userId:   string;
  name:     string | null;
  email:    string | null;
  role:     'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
}

interface ProfileStats {
  createdAt:     string | null;
  authMethod:    'credentials' | 'oauth';
  workspaceName: string;
  activeNotes:   number;
  trashedNotes:  number;
  folderCount:   number;
  tagCount:      number;
  fileCount:     number;
  storageBytes:  number;
}

type SectionId = 'compte' | 'securite' | 'apparence' | 'espace' | 'membres' | 'donnees' | 'danger';
type FeedbackState = { type: 'success' | 'error'; message: string } | null;

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'compte',    label: PROFILE_NAV.compte,               icon: UserIcon      },
  { id: 'securite',  label: PROFILE_NAV.securite,             icon: Shield        },
  { id: 'apparence', label: PROFILE_APPEARANCE.sectionTitle,  icon: Palette       },
  { id: 'espace',    label: PROFILE_NAV.espace,               icon: FolderOpen    },
  { id: 'membres',   label: PROFILE_MEMBERS.sectionTitle,     icon: Users         },
  { id: 'donnees',   label: PROFILE_NAV.donnees,              icon: FileText      },
  { id: 'danger',    label: PROFILE_NAV.danger,               icon: AlertTriangle },
];

/** Mots-clés pour la recherche (synonymes / thèmes), en plus du libellé affiché */
const NAV_SEARCH_HINTS: Record<SectionId, string> = {
  compte:    'compte profil nom email avatar identité',
  securite:  'sécurité mot de passe session connexion',
  apparence: 'apparence thème sombre clair couleurs affichage',
  espace:    'espace workspace statistiques notes dossiers stockage',
  membres:   'membres équipe collaboration rôles invités',
  donnees:   'données export json sauvegarde télécharger',
  danger:    'danger supprimer déconnexion compte effacer',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0)       return '0 o';
  if (bytes < 1_024)     return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} Ko`;
  return `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function Skeleton() {
  return <span className="inline-block w-16 h-3 bg-gray-200 dark:bg-dark-725 rounded animate-pulse align-middle" />;
}

function StatRow({ label, value, loading }: { label: string; value: string | number; loading: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-dark-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-mono">{loading ? <Skeleton /> : value}</span>
    </div>
  );
}

function Feedback({ state }: { state: FeedbackState }) {
  if (!state) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs ${state.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {state.type === 'success' ? <Check size={12} /> : <AlertCircle size={12} />}
      {state.message}
    </p>
  );
}

// ─── Mini modal de confirmation ───────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel = 'Confirmer', danger = false, onClose, onConfirm,
}: {
  title: string; message: string; confirmLabel?: string; danger?: boolean;
  onClose: () => void; onConfirm: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  }
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-dark-650 border border-gray-200 dark:border-dark-600 rounded-xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <h2 id="confirm-title" className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors ml-4 shrink-0">
            <X size={15} />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={handle} disabled={loading}
            className={`px-4 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/30 hover:bg-red-500/30'
                : 'bg-gray-100 dark:bg-dark-650 text-gray-900 dark:text-white border-gray-300 dark:border-dark-600 hover:bg-gray-200 dark:hover:bg-dark-725'
            }`}>
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal suppression de compte ──────────────────────────────────────────────

function DeleteAccountModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<void> }) {
  const [input, setInput]       = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  async function handleDelete() {
    if (input !== 'SUPPRIMER') return;
    setDeleting(true);
    try { await onConfirm(); }
    catch { setError(PROFILE_DANGER.deleteErrorRetry); setDeleting(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-dark-650 border border-red-500/30 rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
            <AlertTriangle size={18} />
            <h2 id="delete-title" className="font-semibold">{PROFILE_DANGER.deleteModalTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">{PROFILE_DANGER.deleteModalWarning}</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
          {PROFILE_DANGER.deleteModalInstruction}
          <span className="font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-dark-725 px-1.5 py-0.5 rounded">{PROFILE_DANGER.deleteModalKeyword}</span>
          {PROFILE_DANGER.deleteModalSuffix}
        </p>
        <input id="delete-confirm-input" name="deleteConfirm" type="text"
          value={input} onChange={(e) => setInput(e.target.value)}
          autoFocus autoComplete="off" placeholder="SUPPRIMER"
          className="w-full bg-gray-50 dark:bg-dark-725 border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white mb-3 focus:outline-none focus:ring-1 focus:ring-red-500/50"
        />
        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleDelete}
            disabled={input !== 'SUPPRIMER' || deleting}
            className="flex-1 py-2 text-sm bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {deleting ? PROFILE_DANGER.deleteConfirmLoading : PROFILE_DANGER.deleteConfirmIdle}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SectionCompte({
  session, stats, statsLoading,
  editingName, name, setName, nameFeedback, savingName,
  setEditingName, setNameFeedback, handleSaveName,
}: {
  session: ReturnType<typeof useSession>['data'];
  stats: ProfileStats | null; statsLoading: boolean;
  editingName: boolean; name: string; setName: (v: string) => void;
  nameFeedback: FeedbackState; savingName: boolean;
  setEditingName: (v: boolean) => void;
  setNameFeedback: (v: FeedbackState) => void;
  handleSaveName: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <UserIcon size={12} /> {PROFILE_ACCOUNT.sectionTitle}
        </h2>
        {!editingName && (
          <button type="button"
            onClick={() => { setName(session?.user?.name ?? ''); setNameFeedback(null); setEditingName(true); }}
            className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-dark-600 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-colors">
            <Pencil size={12} /> {PROFILE_ACCOUNT.editButton}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-dark-600">
        {session?.user?.image ? (
          <img src={session.user.image} alt="Avatar" referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full ring-2 ring-gray-300 dark:ring-dark-600 shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary-500/10 flex items-center justify-center ring-2 ring-primary-500/25 shrink-0">
            <UserIcon size={22} className="text-primary-600 dark:text-primary-400" />
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{session?.user?.name || '—'}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
        </div>
      </div>

      {editingName && (
        <form onSubmit={handleSaveName} className="space-y-2 pb-4 border-b border-gray-200 dark:border-dark-600">
          <label htmlFor="modal-profile-name" className="block text-xs text-gray-500 dark:text-gray-400">{PROFILE_ACCOUNT.nameLabel}</label>
          <input id="modal-profile-name" name="name" type="text" value={name}
            onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus
            className="w-full bg-gray-50 dark:bg-dark-725 border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            placeholder={PROFILE_ACCOUNT.namePlaceholder} />
          <Feedback state={nameFeedback} />
          <div className="flex items-center gap-2">
            <button type="submit"
              disabled={savingName || !name.trim() || name.trim() === session?.user?.name}
              className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {savingName ? PROFILE_ACCOUNT.nameSaveLoading : PROFILE_ACCOUNT.nameSaveIdle}
            </button>
            <button type="button" onClick={() => setEditingName(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
              <X size={12} /> Annuler
            </button>
          </div>
        </form>
      )}

      <div>
        <StatRow label={PROFILE_ACCOUNT.labelAuthMethod} loading={statsLoading}
          value={stats?.authMethod === 'credentials' ? PROFILE_ACCOUNT.authCredentials : PROFILE_ACCOUNT.authGoogle} />
        <StatRow label={PROFILE_ACCOUNT.labelMemberSince} loading={statsLoading}
          value={formatDate(stats?.createdAt ?? null)} />
      </div>
    </div>
  );
}

function SectionSecurite({
  session, isOwner,
  sessionDays, setSessionDays, savingSession, sessionFeedback, handleSaveSessionDays,
  editingPwd, setEditingPwd,
  pwdCurrent, setPwdCurrent, pwdNext, setPwdNext, pwdConfirm, setPwdConfirm,
  pwdConfirmError, canSavePwd, savingPwd, pwdFeedback, setPwdFeedback, handleSavePwd,
}: {
  session: ReturnType<typeof useSession>['data'];
  isOwner: boolean;
  sessionDays: number; setSessionDays: (v: number) => void;
  savingSession: boolean; sessionFeedback: FeedbackState;
  handleSaveSessionDays: (e: React.FormEvent) => void;
  editingPwd: boolean; setEditingPwd: (v: boolean) => void;
  pwdCurrent: string; setPwdCurrent: (v: string) => void;
  pwdNext: string; setPwdNext: (v: string) => void;
  pwdConfirm: string; setPwdConfirm: (v: string) => void;
  pwdConfirmError: string | null; canSavePwd: boolean;
  savingPwd: boolean; pwdFeedback: FeedbackState;
  setPwdFeedback: (v: FeedbackState) => void;
  handleSavePwd: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <Shield size={12} /> {PROFILE_SECURITY.sectionTitle}
      </h2>

      {/* Session active */}
      <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-600">
        <div>
          <p className="text-sm text-gray-900 dark:text-white">{PROFILE_SECURITY.sessionLabel}</p>
          <p className="text-xs text-gray-500">{PROFILE_SECURITY.sessionDetail}</p>
          {(session?.user as { sessionExpiresAt?: number })?.sessionExpiresAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {PROFILE_SECURITY.sessionExpireLabel}{' '}
              {new Date(((session?.user as { sessionExpiresAt?: number }).sessionExpiresAt ?? 0) * 1000)
                .toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
        <span className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-md shrink-0">
          {PROFILE_SECURITY.sessionBadge}
        </span>
      </div>

      {/* Durée de session (OWNER) */}
      {isOwner && (
        <div className="py-3 border-b border-gray-200 dark:border-dark-600">
          <form onSubmit={handleSaveSessionDays} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{PROFILE_SECURITY.sessionDurationLabel}</p>
                <p className="text-xs text-gray-500">{PROFILE_SECURITY.sessionDurationHint}</p>
              </div>
              <select id="modal-session-days" name="sessionDays"
                aria-label={PROFILE_SECURITY.sessionDurationLabel}
                value={sessionDays}
                onChange={(e) => { setSessionDays(Number(e.target.value)); }}
                className="bg-gray-50 dark:bg-dark-725 border border-gray-300 dark:border-dark-600 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                {[7, 14, 30, 60, 90, 180].map(d => <option key={d} value={d}>{d} jours</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={savingSession}
                className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {savingSession ? PROFILE_SECURITY.sessionDurationSaveLoading : PROFILE_SECURITY.sessionDurationSaveIdle}
              </button>
              <Feedback state={sessionFeedback} />
            </div>
          </form>
        </div>
      )}

      {/* Mot de passe */}
      <div className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-900 dark:text-white">{PROFILE_SECURITY.passwordLabel}</p>
            <p className="text-xs text-gray-500">••••••••</p>
          </div>
          {!editingPwd && (
            <button type="button"
              onClick={() => { setPwdFeedback(null); setEditingPwd(true); }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-dark-600 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-colors">
              <Pencil size={12} /> {PROFILE_SECURITY.passwordEditBtn}
            </button>
          )}
        </div>

        {editingPwd && (
          <form onSubmit={handleSavePwd} className="mt-3 space-y-2 border-t border-gray-200 dark:border-dark-600 pt-3">
            <div>
              <label htmlFor="modal-pwd-current" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{PROFILE_SECURITY.currentPwdLabel}</label>
              <input id="modal-pwd-current" name="currentPassword" type="password"
                value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)}
                autoComplete="current-password" autoFocus
                className="w-full bg-gray-50 dark:bg-dark-725 border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                placeholder="••••••••" />
            </div>
            <div>
              <label htmlFor="modal-pwd-new" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {PROFILE_SECURITY.newPwdLabel} <span className="text-gray-400">{PROFILE_SECURITY.newPwdHint}</span>
              </label>
              <input id="modal-pwd-new" name="newPassword" type="password"
                value={pwdNext} onChange={(e) => setPwdNext(e.target.value)} autoComplete="new-password"
                className="w-full bg-gray-50 dark:bg-dark-725 border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                placeholder="••••••••" />
            </div>
            <div>
              <label htmlFor="modal-pwd-confirm" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{PROFILE_SECURITY.confirmPwdLabel}</label>
              <input id="modal-pwd-confirm" name="confirmPassword" type="password"
                value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} autoComplete="new-password"
                className={`w-full bg-gray-50 dark:bg-dark-725 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                  pwdConfirmError ? 'border-red-500/50 focus:ring-red-500/30' : 'border-gray-300 dark:border-dark-600 focus:ring-primary-500/40'
                }`}
                placeholder="••••••••" />
              {pwdConfirmError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {PROFILE_SECURITY.pwdMismatch}
                </p>
              )}
            </div>
            <Feedback state={pwdFeedback} />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={!canSavePwd}
                className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {savingPwd ? PROFILE_SECURITY.pwdSaveLoading : PROFILE_SECURITY.pwdSaveIdle}
              </button>
              <button type="button"
                onClick={() => { setEditingPwd(false); setPwdCurrent(''); setPwdNext(''); setPwdConfirm(''); setPwdFeedback(null); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
                <X size={12} /> Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── SettingsModal ────────────────────────────────────────────────────────────

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data: session, update } = useSession();
  const router                    = useRouter();

  const [activeSection, setActiveSection] = useState<SectionId>('compte');
  const [navSearch, setNavSearch]           = useState('');
  const dialogRef                         = useRef<HTMLDivElement>(null);
  const searchInputRef                    = useRef<HTMLInputElement>(null);

  const filteredNav = useMemo(() => {
    const q = stripDiacritics(navSearch.trim());
    if (!q) return NAV_SECTIONS;
    return NAV_SECTIONS.filter((s) => {
      const label = stripDiacritics(s.label);
      const hints = stripDiacritics(NAV_SEARCH_HINTS[s.id]);
      return label.includes(q) || hints.includes(q);
    });
  }, [navSearch]);

  useEffect(() => {
    if (filteredNav.length === 0) return;
    setActiveSection((prev) => (filteredNav.some((s) => s.id === prev) ? prev : filteredNav[0].id));
  }, [filteredNav]);

  useEffect(() => {
    const rootEl = dialogRef.current;
    if (!rootEl) return;
    const container = rootEl;
    const prevActive = document.activeElement as HTMLElement | null;

    function getFocusables(el: HTMLElement): HTMLElement[] {
      const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(el.querySelectorAll<HTMLElement>(sel)).filter(
        (node) => !node.closest('[aria-hidden="true"]') && node.offsetParent !== null,
      );
    }

    const id = window.requestAnimationFrame(() => {
      const searchEl = searchInputRef.current;
      if (searchEl && container.contains(searchEl)) searchEl.focus();
      else getFocusables(container)[0]?.focus();
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const els = getFocusables(container);
      if (els.length === 0) return;
      const first = els[0];
      const last  = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(id);
      container.removeEventListener('keydown', onKeyDown);
      prevActive?.focus?.();
    };
  }, []);

  const [stats, setStats]               = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showDelete, setShowDelete]     = useState(false);
  const [showLogout, setShowLogout]     = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [members, setMembers]               = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [removingId, setRemovingId]         = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove]   = useState<WorkspaceMember | null>(null);
  const [changingRole, setChangingRole]     = useState<string | null>(null);

  const [sessionDays, setSessionDays]         = useState(30);
  const [savingSession, setSavingSession]     = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState<FeedbackState>(null);

  const currentUserId = (session?.user as { id?: string })?.id ?? '';
  const currentRole   = (session?.user as { workspaceRole?: string })?.workspaceRole ?? 'VIEWER';
  const isOwner       = currentRole === 'OWNER';

  const [editingName, setEditingName]   = useState(false);
  const [name, setName]                 = useState('');
  const [savingName, setSavingName]     = useState(false);
  const [nameFeedback, setNameFeedback] = useState<FeedbackState>(null);

  const [editingPwd, setEditingPwd]     = useState(false);
  const [pwdCurrent, setPwdCurrent]     = useState('');
  const [pwdNext, setPwdNext]           = useState('');
  const [pwdConfirm, setPwdConfirm]     = useState('');
  const [savingPwd, setSavingPwd]       = useState(false);
  const [pwdFeedback, setPwdFeedback]   = useState<FeedbackState>(null);

  const pwdConfirmError = pwdConfirm.length > 0 && pwdNext !== pwdConfirm ? 'Les mots de passe ne correspondent pas.' : null;
  const canSavePwd = pwdCurrent && pwdNext.length >= 8 && pwdNext === pwdConfirm && !savingPwd;

  // Fermer sur Escape (sauf si une sous-modale est ouverte)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDelete && !showLogout && !confirmRemove) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showDelete, showLogout, confirmRemove]);

  useEffect(() => {
    fetch('/api/profile/stats')
      .then(r => r.json()).then(j => setStats(j.data ?? null)).catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/workspace/members')
      .then(r => r.json()).then(j => setMembers(j.data ?? [])).catch(() => {})
      .finally(() => setMembersLoading(false));
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/workspace/session')
      .then(r => r.json())
      .then(j => { if (j.data?.sessionMaxAgeDays) setSessionDays(j.data.sessionMaxAgeDays); })
      .catch(() => {});
  }, [isOwner]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavingName(true); setNameFeedback(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) { const d = await res.json(); setNameFeedback({ type: 'error', message: d.error ?? PROFILE_ACCOUNT.errorGeneric }); return; }
      await update({ name: trimmed });
      setNameFeedback({ type: 'success', message: PROFILE_ACCOUNT.nameSuccess });
      setEditingName(false);
    } catch { setNameFeedback({ type: 'error', message: PROFILE_ACCOUNT.errorNetwork }); }
    finally { setSavingName(false); }
  }

  async function handleSavePwd(e: React.FormEvent) {
    e.preventDefault();
    if (!canSavePwd) return;
    setSavingPwd(true); setPwdFeedback(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNext }),
      });
      const data = await res.json();
      if (!res.ok) { setPwdFeedback({ type: 'error', message: data.error ?? PROFILE_SECURITY.errorGeneric }); return; }
      setPwdFeedback({ type: 'success', message: PROFILE_SECURITY.pwdSuccess });
      setPwdCurrent(''); setPwdNext(''); setPwdConfirm('');
      setEditingPwd(false);
    } catch { setPwdFeedback({ type: 'error', message: PROFILE_SECURITY.errorNetwork }); }
    finally { setSavingPwd(false); }
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      const res  = await fetch('/api/notes?status=ACTIVE&limit=1000');
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json.data ?? [], null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `mynotespace-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch { /* silencieux */ } finally { setExportLoading(false); }
  }

  async function handleSaveSessionDays(e: React.FormEvent) {
    e.preventDefault();
    setSavingSession(true); setSessionFeedback(null);
    try {
      const res = await fetch('/api/workspace/session', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionMaxAgeDays: sessionDays }),
      });
      if (!res.ok) { setSessionFeedback({ type: 'error', message: PROFILE_SECURITY.errorGeneric }); return; }
      setSessionFeedback({ type: 'success', message: PROFILE_SECURITY.sessionDurationSuccess });
    } catch { setSessionFeedback({ type: 'error', message: PROFILE_SECURITY.errorNetwork }); }
    finally { setSavingSession(false); }
  }

  async function handleChangeRole(targetId: string, newRole: WorkspaceMember['role']) {
    setChangingRole(targetId);
    try {
      const res = await fetch(`/api/workspace/members/${targetId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) return;
      setMembers(prev => prev.map(m => m.userId === targetId ? { ...m, role: newRole } : m));
    } catch { /* silencieux */ }
    finally { setChangingRole(null); }
  }

  async function handleRemoveMember(targetId: string) {
    setRemovingId(targetId);
    try {
      await fetch(`/api/workspace/members/${targetId}`, { method: 'DELETE' });
      setMembers(prev => prev.filter(m => m.userId !== targetId));
    } catch { /* silencieux */ }
    finally { setRemovingId(null); setConfirmRemove(null); }
  }

  async function handleDeleteAccount() {
    const res = await fetch('/api/auth/account', { method: 'DELETE' });
    if (!res.ok) throw new Error(PROFILE_DANGER.deleteErrorServer);
    await signOut({ redirect: false });
    router.push('/login');
  }

  // ── Contenu de la section active ─────────────────────────────────────────

  function renderSection() {
    switch (activeSection) {

      case 'compte':
        return (
          <SectionCompte
            session={session} stats={stats} statsLoading={statsLoading}
            editingName={editingName} name={name} setName={setName}
            nameFeedback={nameFeedback} savingName={savingName}
            setEditingName={setEditingName} setNameFeedback={setNameFeedback}
            handleSaveName={handleSaveName}
          />
        );

      case 'securite':
        return (
          <SectionSecurite
            session={session} isOwner={isOwner}
            sessionDays={sessionDays} setSessionDays={setSessionDays}
            savingSession={savingSession} sessionFeedback={sessionFeedback}
            handleSaveSessionDays={handleSaveSessionDays}
            editingPwd={editingPwd} setEditingPwd={setEditingPwd}
            pwdCurrent={pwdCurrent} setPwdCurrent={setPwdCurrent}
            pwdNext={pwdNext} setPwdNext={setPwdNext}
            pwdConfirm={pwdConfirm} setPwdConfirm={setPwdConfirm}
            pwdConfirmError={pwdConfirmError} canSavePwd={!!canSavePwd}
            savingPwd={savingPwd} pwdFeedback={pwdFeedback}
            setPwdFeedback={setPwdFeedback} handleSavePwd={handleSavePwd}
          />
        );

      case 'apparence':
        return (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Palette size={12} /> {PROFILE_APPEARANCE.sectionTitle}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 border-b border-gray-200 dark:border-dark-600">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{PROFILE_APPEARANCE.themeLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">{PROFILE_APPEARANCE.themeHint}</p>
              </div>
              <ThemeToggle variant="segmented" />
            </div>
          </div>
        );

      case 'espace':
        return (
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1">
              <FolderOpen size={12} /> {PROFILE_WORKSPACE.sectionTitle}
            </h2>
            {stats?.workspaceName && <p className="text-xs text-gray-500 mb-4">{stats.workspaceName}</p>}
            <StatRow label={PROFILE_WORKSPACE.statActiveNotes} loading={statsLoading} value={stats?.activeNotes  ?? '—'} />
            <StatRow label={PROFILE_WORKSPACE.statTrashed}     loading={statsLoading} value={stats?.trashedNotes ?? '—'} />
            <StatRow label={PROFILE_WORKSPACE.statFolders}     loading={statsLoading} value={stats?.folderCount  ?? '—'} />
            <StatRow label={PROFILE_WORKSPACE.statTags}        loading={statsLoading} value={stats?.tagCount     ?? '—'} />
            <StatRow label={PROFILE_WORKSPACE.statFiles}       loading={statsLoading} value={stats?.fileCount    ?? '—'} />
            <StatRow label={PROFILE_WORKSPACE.statStorage}     loading={statsLoading} value={stats ? formatBytes(stats.storageBytes) : '—'} />
          </div>
        );

      case 'membres': {
        const roleLabels: Record<WorkspaceMember['role'], string> = {
          OWNER: PROFILE_MEMBERS.roleOwner, ADMIN: PROFILE_MEMBERS.roleAdmin,
          MEMBER: PROFILE_MEMBERS.roleMember, VIEWER: PROFILE_MEMBERS.roleViewer,
        };
        const roleColors: Record<WorkspaceMember['role'], string> = {
          OWNER:  'text-primary-700 dark:text-primary-300 bg-primary-500/15',
          ADMIN:  'text-primary-600 dark:text-primary-400 bg-primary-500/10',
          MEMBER: 'text-green-600 bg-green-500/10 dark:text-green-400',
          VIEWER: 'text-gray-500 bg-gray-200/60 dark:bg-gray-700/40',
        };
        return (
          <div className="space-y-3">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Users size={12} /> {PROFILE_MEMBERS.sectionTitle}
              </h2>
              <p className="text-xs text-gray-500 mt-1">{PROFILE_MEMBERS.sectionDesc}</p>
            </div>
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-dark-725 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-32 bg-gray-200 dark:bg-dark-725 rounded animate-pulse" />
                      <div className="h-2.5 w-48 bg-gray-100 dark:bg-dark-650 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {members.map(m => {
                  const isMe = m.userId === currentUserId;
                  const initials = (m.name ?? m.email ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                  return (
                    <li key={m.userId} className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-dark-800 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-semibold shrink-0 select-none">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {m.name ?? m.email}
                          {isMe && <span className="ml-1.5 text-[10px] text-gray-400">{PROFILE_MEMBERS.you}</span>}
                        </p>
                        {m.name && m.email && <p className="text-xs text-gray-500 truncate">{m.email}</p>}
                      </div>
                      {isOwner && !isMe ? (
                        <select value={m.role} disabled={changingRole === m.userId}
                          onChange={e => handleChangeRole(m.userId, e.target.value as WorkspaceMember['role'])}
                          aria-label={PROFILE_MEMBERS.changeRole}
                          className="text-xs bg-gray-100 dark:bg-dark-650 border border-gray-200 dark:border-dark-600 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-40 cursor-pointer">
                          <option value="ADMIN">{PROFILE_MEMBERS.roleAdmin}</option>
                          <option value="MEMBER">{PROFILE_MEMBERS.roleMember}</option>
                          <option value="VIEWER">{PROFILE_MEMBERS.roleViewer}</option>
                        </select>
                      ) : (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${roleColors[m.role]}`}>
                          {roleLabels[m.role]}
                        </span>
                      )}
                      {isOwner && !isMe && (
                        <button type="button" title={PROFILE_MEMBERS.removeLabel}
                          onClick={() => setConfirmRemove(m)} disabled={removingId === m.userId}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors rounded disabled:opacity-40">
                          <X size={14} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      }

      case 'donnees':
        return (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <FileText size={12} /> {PROFILE_DATA.sectionTitle}
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">{PROFILE_DATA.description}</p>
            <button type="button" onClick={handleExport} disabled={exportLoading}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-650 border border-gray-200 dark:border-dark-600 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-725 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={14} />
              {exportLoading ? PROFILE_DATA.exportLoading : PROFILE_DATA.exportIdle}
            </button>
          </div>
        );

      case 'danger':
        return (
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-red-500/70 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle size={12} /> {PROFILE_DANGER.sectionTitle}
            </h2>

            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-600">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{PROFILE_DANGER.logoutLabel}</p>
                <p className="text-xs text-gray-500">{PROFILE_DANGER.logoutDetail}</p>
              </div>
              <button type="button" onClick={() => setShowLogout(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-colors shrink-0">
                <LogOut size={14} /> {PROFILE_DANGER.logoutButton}
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{PROFILE_DANGER.deleteLabel}</p>
                <p className="text-xs text-gray-500">{PROFILE_DANGER.deleteDetail}</p>
              </div>
              <button type="button" onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-colors shrink-0">
                <Trash2 size={14} /> {PROFILE_DANGER.deleteButton}
              </button>
            </div>
          </div>
        );
    }
  }

  const activeNav = NAV_SECTIONS.find(s => s.id === activeSection);

  return (
    <>
      {showLogout && (
        <ConfirmModal
          title={PROFILE_DANGER.logoutModalTitle}
          message={PROFILE_DANGER.logoutModalMessage}
          confirmLabel={PROFILE_DANGER.logoutButton}
          danger
          onClose={() => setShowLogout(false)}
          onConfirm={async () => { await signOut({ redirect: false }); router.push('/login'); }}
        />
      )}
      {showDelete && (
        <DeleteAccountModal onClose={() => setShowDelete(false)} onConfirm={handleDeleteAccount} />
      )}
      {confirmRemove && (
        <ConfirmModal
          title={PROFILE_MEMBERS.removeConfirm}
          message={PROFILE_MEMBERS.removeMessage(confirmRemove.name ?? confirmRemove.email ?? '?')}
          confirmLabel={PROFILE_MEMBERS.removeYes}
          danger
          onClose={() => setConfirmRemove(null)}
          onConfirm={() => handleRemoveMember(confirmRemove.userId)}
        />
      )}

      {/* Overlay */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Panel */}
        <div className="relative w-full max-w-5xl max-h-[85vh] flex flex-col bg-white dark:bg-dark-650 rounded-2xl shadow-2xl overflow-hidden border border-gray-200/80 dark:border-dark-600/60">

          {/* Header : titre fixe + section courante */}
          <div className="flex items-start sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-dark-600 shrink-0">
            <div className="min-w-0">
              <h1 id="settings-modal-title" className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
                {PROFILE_NAV.modalTitle}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate" aria-live="polite">
                {activeNav?.label ?? '\u00a0'}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fermer"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-650 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
              <X size={18} />
            </button>
          </div>

          {/* Recherche (tous écrans, style Notion) */}
          <div className="px-5 py-3 border-b border-gray-200 dark:border-dark-600 shrink-0">
            <div className="relative max-w-xl">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
              <input
                ref={searchInputRef}
                type="search"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder={PROFILE_NAV.searchPlaceholder}
                aria-label={PROFILE_NAV.searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-725 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          {/* Corps : nav + contenu (scroll interne) */}
          <div className="flex flex-1 min-h-0 overflow-hidden min-h-[28rem]">

            <aside className="w-52 shrink-0 border-r border-gray-200 dark:border-dark-700 py-3 hidden sm:flex flex-col min-h-0" aria-label={PROFILE_NAV.modalTitle}>
              <nav className="space-y-0.5 px-2 overflow-y-auto flex-1 min-h-0">
                {filteredNav.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-4 leading-snug">{PROFILE_NAV.searchNoResults}</p>
                ) : (
                  filteredNav.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveSection(id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                        activeSection === id
                          ? 'bg-gray-100 dark:bg-dark-650 text-gray-900 dark:text-white font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-dark-650/50'
                      }`}
                    >
                      <Icon size={16} className="shrink-0 opacity-80" />
                      {label}
                    </button>
                  ))
                )}
              </nav>
            </aside>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4 sm:p-5">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-gray-200/90 dark:border-dark-700/80 bg-gray-50/70 dark:bg-dark-800/35 p-5 sm:p-6">
                {filteredNav.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[12rem] text-center gap-2 text-sm text-gray-500 dark:text-gray-400 px-4">
                    <Search size={28} className="opacity-40 shrink-0" strokeWidth={1.5} aria-hidden />
                    {PROFILE_NAV.searchNoResults}
                  </div>
                ) : (
                  renderSection()
                )}
              </div>
            </div>
          </div>

          {/* Nav mobile */}
          <div className="sm:hidden flex border-t border-gray-200 dark:border-dark-600 overflow-x-auto shrink-0 bg-white/90 dark:bg-dark-650/95">
            {(filteredNav.length > 0 ? filteredNav : NAV_SECTIONS).map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" aria-label={label} onClick={() => setActiveSection(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 text-[10px] transition-colors shrink-0 min-w-[3.25rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-inset ${
                  activeSection === id
                    ? 'text-primary-600 dark:text-primary-400 border-t-2 border-primary-500 -mt-px bg-primary-500/5'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}>
                <Icon size={14} className="shrink-0" />
                <span className="truncate max-w-[4.5rem]">{label}</span>
              </button>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
