'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { Eye, EyeOff } from 'lucide-react';
import { GLOBAL, REGISTER, AUTH_NAV } from '@/src/frontend/content/copy';
import ThemeToggle from '@/src/frontend/components/common/ThemeToggle';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showPassword, setShowPwd]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session) router.replace('/notes');
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(REGISTER.errorPasswordMismatch);
      return;
    }

    setIsLoading(true);

    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ email, password, confirmPassword }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : GLOBAL.errors.generic);
        setIsLoading(false);
        return;
      }

      const result = await signIn('credentials', { email, password, redirect: false });
      router.replace(result?.error ? '/login' : '/notes');
    } catch {
      setError(GLOBAL.errors.network);
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#080c14]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-white dark:bg-[#080c14] px-4 transition-colors duration-300">

      {/* Lien retour accueil */}
      <Link
        href="/"
        aria-label={AUTH_NAV.backToHomeAriaLabel}
        className="fixed top-5 left-5 text-xs text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors flex items-center gap-1.5"
      >
        {AUTH_NAV.backToHome}
      </Link>

      {/* Bouton thème */}
      <div className="fixed top-4 right-5">
        <ThemeToggle variant="icon" />
      </div>

      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{GLOBAL.brand}</h1>
          </Link>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-2">{REGISTER.pageSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#111520] rounded-2xl p-6 shadow-sm dark:shadow-xl border border-gray-200 dark:border-slate-700 space-y-4">

          <div>
            <label htmlFor="email" className="block text-sm text-gray-700 dark:text-slate-300 mb-1">{REGISTER.emailLabel}</label>
            <input
              id="email" name="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              required maxLength={254} autoComplete="email"
              placeholder={REGISTER.emailPlaceholder}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a2030] border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 dark:text-slate-300 mb-1">
              {REGISTER.passwordLabel}
              <span className="text-gray-400 dark:text-slate-500 ml-1 text-xs">{REGISTER.passwordHint}</span>
            </label>
            <div className="relative">
              <input
                id="password" name="password" type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                required minLength={8} maxLength={128} autoComplete="new-password"
                placeholder={REGISTER.passwordPlaceholder}
                className="w-full px-3 py-2 pr-10 bg-gray-50 dark:bg-[#1a2030] border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm text-gray-700 dark:text-slate-300 mb-1">
              {REGISTER.confirmPasswordLabel}
            </label>
            <div className="relative">
              <input
                id="confirmPassword" name="confirmPassword" type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirm(e.target.value)}
                required maxLength={128} autoComplete="new-password"
                placeholder={REGISTER.confirmPlaceholder}
                className="w-full px-3 py-2 pr-10 bg-gray-50 dark:bg-[#1a2030] border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
              >
                {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" aria-live="polite" className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit" disabled={isLoading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            {isLoading ? REGISTER.submitLoading : REGISTER.submitIdle}
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-[#252d3d]" />
            <span className="text-gray-400 dark:text-slate-500 text-xs">{GLOBAL.separator}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-[#252d3d]" />
          </div>

          <button
            type="button" onClick={() => signIn('google', { callbackUrl: '/notes' })}
            disabled={isLoading} aria-label={GLOBAL.googleAriaRegister}
            className="w-full py-2 bg-white hover:bg-gray-50 dark:bg-white dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-gray-200"
          >
            <GoogleIcon />
            {GLOBAL.googleButton}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400">
            {REGISTER.alreadyAccount}{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
              {REGISTER.loginLink}
            </Link>
          </p>

        </form>
      </div>
    </main>
  );
}
