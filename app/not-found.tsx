'use client';

import Link from 'next/link';
import ThemeToggle from '@/src/frontend/components/common/ThemeToggle';
import { GLOBAL } from '@/src/frontend/content/copy';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white dark:bg-[#080c14] px-4 transition-colors duration-300">

      {/* Bouton thème */}
      <div className="fixed top-4 right-5">
        <ThemeToggle variant="icon" />
      </div>

      <div className="w-full max-w-sm text-center">

        {/* Logo */}
        <Link href="/" className="inline-block hover:opacity-80 transition-opacity mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {GLOBAL.brand}
          </h1>
        </Link>

        {/* Code 404 */}
        <div className="text-[96px] font-black leading-none text-gray-100 dark:text-[#080c14] select-none mb-2">
          404
        </div>

        {/* Message */}
        <p className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
          Page introuvable
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/notes"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Ouvrir mes notes
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-[#111520] dark:hover:bg-[#1a2030] text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-slate-700"
          >
            Retour à l&apos;accueil
          </Link>
        </div>

      </div>
    </main>
  );
}
