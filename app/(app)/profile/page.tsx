"use client";

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon, Shield, FolderOpen, ArrowLeft,
  LogOut, Trash2, Download, FileText,
  AlertTriangle, X, Pencil, Check, AlertCircle,
} from 'lucide-react';
import {
  PROFILE_NAV,
  PROFILE_ACCOUNT,
  PROFILE_SECURITY,
  PROFILE_WORKSPACE,
  PROFILE_DATA,
  PROFILE_DANGER,
  PROFILE_APPEARANCE,
} from '@/src/frontend/content/copy';
import ThemeToggle from '@/src/frontend/components/common/ThemeToggle';
import { Palette } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

// ─── Navigation latérale ──────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'compte',    label: PROFILE_NAV.compte,      icon: UserIcon      },
  { id: 'securite',  label: PROFILE_NAV.securite,    icon: Shield        },
  { id: 'apparence', label: PROFILE_APPEARANCE.sectionTitle, icon: Palette },
  { id: 'espace',    label: PROFILE_NAV.espace,      icon: FolderOpen    },
  { id: 'donnees',   label: PROFILE_NAV.donnees,     icon: FileText      },
  { id: 'danger',    label: PROFILE_NAV.danger,      icon: AlertTriangle },
] as const;

function Sidebar({ active }: { active: string }) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return (
    <aside className="w-36 shrink-0 sticky top-10 self-start hidden md:block">
      <nav className="space-y-0.5">
        {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
              active === id
                ? 'bg-gray-100 dark:bg-[#111520] text-gray-900 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111520]/50'
            }`}
          >
            <Icon size={11} className="shrink-0" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0)       return '0 o';
  if (bytes < 1_024)     return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} Ko`;
  return `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function Skeleton() {
  return <span className="inline-block w-16 h-3 bg-gray-200 dark:bg-[#1a2030] rounded animate-pulse align-middle" />;
}

function StatRow({ label, value, loading }: { label: string; value: string | number; loading: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-dark-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-mono">{loading ? <Skeleton /> : value}</span>
    </div>
  );
}

function Feedback({ state }: { state: FeedbackState }) {
  if (!state) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs ${state.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {state.type === 'success' ? <Check size={11} /> : <AlertCircle size={11} />}
      {state.message}
    </p>
  );
}

// ─── Mini modal de confirmation générique ────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
  onClose,
  onConfirm,
}: {
  title:         string;
  message:       string;
  confirmLabel?: string;
  danger?:       boolean;
  onClose:       () => void;
  onConfirm:     () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl p-5 w-full max-w-sm shadow-xl">
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
                : 'bg-gray-100 dark:bg-[#111520] text-gray-900 dark:text-white border-gray-300 dark:border-dark-600 hover:bg-gray-200 dark:hover:bg-[#1a2030]'
            }`}>
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal suppression ────────────────────────────────────────────────────────

function DeleteAccountModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<void> }) {
  const [input, setInput]         = useState('');
  const [deleting, setDeleting]   = useState(false);
  const [error, setError]         = useState('');

  async function handleDelete() {
    if (input !== 'SUPPRIMER') return;
    setDeleting(true);
    try { await onConfirm(); }
    catch { setError(PROFILE_DANGER.deleteErrorRetry); setDeleting(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-[#0d1117] border border-red-500/30 rounded-xl p-6 w-full max-w-md shadow-xl">
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          {PROFILE_DANGER.deleteModalWarning}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
          {PROFILE_DANGER.deleteModalInstruction}
          <span className="font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-[#1a2030] px-1.5 py-0.5 rounded">{PROFILE_DANGER.deleteModalKeyword}</span>
          {PROFILE_DANGER.deleteModalSuffix}
        </p>
        <input id="delete-confirm-input" name="deleteConfirm" type="text"
          value={input} onChange={(e) => setInput(e.target.value)}
          autoFocus autoComplete="off" placeholder="SUPPRIMER"
          className="w-full bg-gray-50 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white mb-3 focus:outline-none focus:ring-1 focus:ring-red-500/50"
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session, update }         = useSession();
  const router                            = useRouter();
  const [stats, setStats]                 = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading]   = useState(true);
  const [showDelete, setShowDelete]       = useState(false);
  const [showLogout, setShowLogout]       = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('compte');

  // ── Édition nom ───────────────────────────────────────────────────────────
  const [editingName, setEditingName]   = useState(false);
  const [name, setName]                 = useState('');
  const [savingName, setSavingName]     = useState(false);
  const [nameFeedback, setNameFeedback] = useState<FeedbackState>(null);

  // ── Changement mot de passe ───────────────────────────────────────────────
  const [editingPwd, setEditingPwd]     = useState(false);
  const [pwdCurrent, setPwdCurrent]     = useState('');
  const [pwdNext, setPwdNext]           = useState('');
  const [pwdConfirm, setPwdConfirm]     = useState('');
  const [savingPwd, setSavingPwd]       = useState(false);
  const [pwdFeedback, setPwdFeedback]   = useState<FeedbackState>(null);

  const pwdConfirmError = pwdConfirm.length > 0 && pwdNext !== pwdConfirm
    ? 'Les mots de passe ne correspondent pas.' : null;
  const canSavePwd = pwdCurrent && pwdNext.length >= 8 && pwdNext === pwdConfirm && !savingPwd;

  useEffect(() => {
    fetch('/api/profile/stats')
      .then((r) => r.json())
      .then((json) => setStats(json.data ?? null))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // Suivi section visible
  useEffect(() => {
    const ids = NAV_SECTIONS.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) setActiveSection(e.target.id); } },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

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

  async function handleDeleteAccount() {
    const res = await fetch('/api/auth/account', { method: 'DELETE' });
    if (!res.ok) throw new Error(PROFILE_DANGER.deleteErrorServer);
    await signOut({ callbackUrl: '/' });
  }

  return (
    <>
      {showLogout && (
        <ConfirmModal
          title={PROFILE_DANGER.logoutModalTitle}
          message={PROFILE_DANGER.logoutModalMessage}
          confirmLabel={PROFILE_DANGER.logoutButton}
          danger
          onClose={() => setShowLogout(false)}
          onConfirm={() => signOut({ callbackUrl: '/' })}
        />
      )}
      {showDelete && (
        <DeleteAccountModal onClose={() => setShowDelete(false)} onConfirm={handleDeleteAccount} />
      )}

      <main id="main-content" className="min-h-screen bg-white dark:bg-[#080c14] text-gray-900 dark:text-white">
        <div className="max-w-3xl mx-auto px-4 py-10">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <button type="button" onClick={() => router.push('/notes')}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#111520] transition-colors"
              title={PROFILE_NAV.backTitle}>
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-lg font-semibold">{PROFILE_NAV.pageTitle}</h1>
          </div>

          <div className="flex gap-8">
            <Sidebar active={activeSection} />

            <div className="flex-1 min-w-0 space-y-4">

              {/* ── Compte ──────────────────────────────────────────────── */}
              <section id="compte" className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl p-5 scroll-mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <UserIcon size={12} /> {PROFILE_ACCOUNT.sectionTitle}
                  </h2>
                  {!editingName && (
                    <button type="button"
                      onClick={() => { setName(session?.user?.name ?? ''); setNameFeedback(null); setEditingName(true); }}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-dark-600 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-dark-500 transition-colors">
                      <Pencil size={11} /> {PROFILE_ACCOUNT.editButton}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-200 dark:border-dark-700">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="Avatar" referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full ring-2 ring-gray-300 dark:ring-dark-600 shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center ring-2 ring-yellow-500/30 shrink-0">
                      <UserIcon size={24} className="text-yellow-500 dark:text-yellow-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{session?.user?.name || '—'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
                  </div>
                </div>

                {editingName && (
                  <form onSubmit={handleSaveName} className="space-y-2 mb-4 pb-4 border-b border-gray-200 dark:border-dark-700">
                    <label htmlFor="profile-name" className="block text-xs text-gray-500 dark:text-gray-400">{PROFILE_ACCOUNT.nameLabel}</label>
                    <input id="profile-name" name="name" type="text" value={name}
                      onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus
                      className="w-full bg-gray-50 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                      placeholder={PROFILE_ACCOUNT.namePlaceholder} />
                    <Feedback state={nameFeedback} />
                    <div className="flex items-center gap-2">
                      <button type="submit"
                        disabled={savingName || !name.trim() || name.trim() === session?.user?.name}
                        className="px-4 py-1.5 text-sm bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {savingName ? PROFILE_ACCOUNT.nameSaveLoading : PROFILE_ACCOUNT.nameSaveIdle}
                      </button>
                      <button type="button" onClick={() => setEditingName(false)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
                        <X size={12} /> Annuler
                      </button>
                    </div>
                  </form>
                )}

                <StatRow label={PROFILE_ACCOUNT.labelAuthMethod} loading={statsLoading}
                  value={stats?.authMethod === 'credentials' ? PROFILE_ACCOUNT.authCredentials : PROFILE_ACCOUNT.authGoogle} />
                <StatRow label={PROFILE_ACCOUNT.labelMemberSince} loading={statsLoading}
                  value={formatDate(stats?.createdAt ?? null)} />
              </section>

              {/* ── Sécurité ────────────────────────────────────────────── */}
              <section id="securite" className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl p-5 scroll-mt-6">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield size={12} /> {PROFILE_SECURITY.sectionTitle}
                </h2>

                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">{PROFILE_SECURITY.sessionLabel}</p>
                    <p className="text-xs text-gray-500">{PROFILE_SECURITY.sessionDetail}</p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-md">
                    {PROFILE_SECURITY.sessionBadge}
                  </span>
                </div>

                <div className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{PROFILE_SECURITY.passwordLabel}</p>
                      <p className="text-xs text-gray-500">••••••••</p>
                    </div>
                    {!editingPwd && (
                      <button type="button"
                        onClick={() => { setPwdFeedback(null); setEditingPwd(true); }}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-dark-600 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-dark-500 transition-colors">
                        <Pencil size={11} /> {PROFILE_SECURITY.passwordEditBtn}
                      </button>
                    )}
                  </div>

                  {editingPwd && (
                    <form onSubmit={handleSavePwd} className="mt-3 space-y-2 border-t border-gray-200 dark:border-dark-700 pt-3">
                      <div>
                        <label htmlFor="pwd-current" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{PROFILE_SECURITY.currentPwdLabel}</label>
                        <input id="pwd-current" name="currentPassword" type="password"
                          value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)}
                          autoComplete="current-password" autoFocus
                          className="w-full bg-gray-50 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                          placeholder="••••••••" />
                      </div>
                      <div>
                        <label htmlFor="pwd-new" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {PROFILE_SECURITY.newPwdLabel} <span className="text-gray-400">{PROFILE_SECURITY.newPwdHint}</span>
                        </label>
                        <input id="pwd-new" name="newPassword" type="password"
                          value={pwdNext} onChange={(e) => setPwdNext(e.target.value)}
                          autoComplete="new-password"
                          className="w-full bg-gray-50 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                          placeholder="••••••••" />
                      </div>
                      <div>
                        <label htmlFor="pwd-confirm" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{PROFILE_SECURITY.confirmPwdLabel}</label>
                        <input id="pwd-confirm" name="confirmPassword" type="password"
                          value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)}
                          autoComplete="new-password"
                          className={`w-full bg-gray-50 dark:bg-[#111520] border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 ${
                            pwdConfirmError ? 'border-red-500/50 focus:ring-red-500/30' : 'border-gray-300 dark:border-dark-600 focus:ring-yellow-500/50'
                          }`}
                          placeholder="••••••••" />
                        {pwdConfirmError && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={11} /> {PROFILE_SECURITY.pwdMismatch}
                          </p>
                        )}
                      </div>
                      <Feedback state={pwdFeedback} />
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={!canSavePwd}
                          className="px-4 py-1.5 text-sm bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
              </section>

              {/* ── Apparence ───────────────────────────────────────────── */}
              <section id="apparence" className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl p-5 scroll-mt-6">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Palette size={12} /> {PROFILE_APPEARANCE.sectionTitle}
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">{PROFILE_APPEARANCE.themeLabel}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{PROFILE_APPEARANCE.themeHint}</p>
                  </div>
                  <ThemeToggle variant="segmented" />
                </div>
              </section>

              {/* ── Espace personnel ────────────────────────────────────── */}
              <section id="espace" className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl p-5 scroll-mt-6">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <FolderOpen size={12} /> {PROFILE_WORKSPACE.sectionTitle}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 mb-4">{stats?.workspaceName || ''}</p>

                <StatRow label={PROFILE_WORKSPACE.statActiveNotes} loading={statsLoading} value={stats?.activeNotes  ?? '—'} />
                <StatRow label={PROFILE_WORKSPACE.statTrashed}     loading={statsLoading} value={stats?.trashedNotes ?? '—'} />
                <StatRow label={PROFILE_WORKSPACE.statFolders}     loading={statsLoading} value={stats?.folderCount  ?? '—'} />
                <StatRow label={PROFILE_WORKSPACE.statTags}        loading={statsLoading} value={stats?.tagCount     ?? '—'} />
                <StatRow label={PROFILE_WORKSPACE.statFiles}       loading={statsLoading} value={stats?.fileCount    ?? '—'} />
                <StatRow label={PROFILE_WORKSPACE.statStorage}     loading={statsLoading}
                  value={stats ? formatBytes(stats.storageBytes) : '—'} />
              </section>

              {/* ── Données & confidentialité ───────────────────────────── */}
              <section id="donnees" className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl p-5 scroll-mt-6">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FileText size={12} /> {PROFILE_DATA.sectionTitle}
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  {PROFILE_DATA.description}
                </p>
                <button type="button" onClick={handleExport} disabled={exportLoading}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#111520] border border-gray-200 dark:border-dark-600 rounded-lg hover:bg-gray-200 dark:hover:bg-[#1a2030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Download size={14} />
                  {exportLoading ? PROFILE_DATA.exportLoading : PROFILE_DATA.exportIdle}
                </button>
              </section>

              {/* ── Zone de danger ──────────────────────────────────────── */}
              <section id="danger" className="bg-white dark:bg-[#0d1117] border border-red-500/20 rounded-xl p-5 scroll-mt-6">
                <h2 className="text-xs font-semibold text-red-500/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle size={12} /> {PROFILE_DANGER.sectionTitle}
                </h2>

                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">{PROFILE_DANGER.logoutLabel}</p>
                    <p className="text-xs text-gray-500">{PROFILE_DANGER.logoutDetail}</p>
                  </div>
                  <button type="button" onClick={() => setShowLogout(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-colors">
                    <LogOut size={13} /> {PROFILE_DANGER.logoutButton}
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">{PROFILE_DANGER.deleteLabel}</p>
                    <p className="text-xs text-gray-500">{PROFILE_DANGER.deleteDetail}</p>
                  </div>
                  <button type="button" onClick={() => setShowDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-colors">
                    <Trash2 size={13} /> {PROFILE_DANGER.deleteButton}
                  </button>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}
