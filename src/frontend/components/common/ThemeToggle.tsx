'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';

type ThemeValue = 'light' | 'dark' | 'system';

interface ThemeOption {
  value: ThemeValue;
  icon:  React.ReactNode;
  label: string;
}

const OPTIONS: ThemeOption[] = [
  { value: 'light',  icon: <Sun  size={14} />, label: 'Clair'   },
  { value: 'dark',   icon: <Moon size={14} />, label: 'Sombre'  },
  { value: 'system', icon: <Monitor size={14} />, label: 'Système' },
];

interface ThemeToggleProps {
  /** 'icon' : bouton compact avec icône seule (navbar)
   *  'segmented' : sélecteur 3 boutons visuels (préférences) */
  variant?: 'icon' | 'segmented';
  className?: string;
}

export default function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  /* Évite le mismatch SSR/client (next-themes lit localStorage après hydratation) */
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    /* Placeholder de même taille pour éviter le layout shift */
    if (variant === 'segmented') return <div className="h-9 w-56 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />;
    return <div className="h-8 w-8 rounded-lg" />;
  }

  /* ── Variante icône (navbar) ──────────────────────────────────────────────── */
  if (variant === 'icon') {
    const current = OPTIONS.find(o => o.value === theme) ?? OPTIONS[1];
    const next    = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length];

    return (
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        aria-label={`Thème actuel : ${current.label}. Passer à : ${next.label}`}
        title={`Thème : ${current.label}`}
        className={`flex items-center justify-center w-8 h-8 rounded-lg
          text-gray-500 hover:text-gray-900 hover:bg-gray-100
          dark:text-white/50 dark:hover:text-white dark:hover:bg-white/[0.08]
          transition-colors ${className}`}
      >
        {resolvedTheme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
      </button>
    );
  }

  /* ── Variante segmented (préférences profil) ──────────────────────────────── */
  return (
    <div
      role="radiogroup"
      aria-label="Thème de l'interface"
      className={`inline-flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-dark-800 ${className}`}
    >
      {OPTIONS.map(({ value, icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active
                ? 'bg-white dark:bg-dark-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
