/**
 * ============================================================================
 * CONFIGURATION TAILWIND CSS — tailwind.config.ts
 * ============================================================================
 *
 * dark-* : palette slate + rampes 650 / 710 / 725 pour surfaces (évite les hex en dur).
 * primary-* : bleu marque, aligné avec les variables CSS shadcn `--primary` dans globals.css.
 * success / warning : états sémantiques — utiliser text-success, bg-success-muted, etc.
 * ============================================================================
 */

import type { Config } from 'tailwindcss';

const config: Config = {
  // Mode sombre via classe .dark sur <html> (next-themes)
  darkMode: ['class'],

  // Fichiers à scanner pour les classes Tailwind
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      fontFamily: {
        // Stack système Notion-style : Inter auto-hébergé + fallbacks OS natifs
        // → SF Pro sur macOS, Segoe UI sur Windows, Roboto sur Android
        sans: [
          'var(--font-inter)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Palette primary (bleu) — accents et boutons
        primary: {
          '50':  '#eff6ff',
          '100': '#dbeafe',
          '200': '#bfdbfe',
          '300': '#93c5fd',
          '400': '#60a5fa',
          '500': '#3b82f6',
          '600': '#2563eb',
          '700': '#1d4ed8',
          '800': '#1e40af',
          '900': '#1e3a8a',
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // Palette dark (slate) — fonds sombres + rampes UX (évite les hex éparpillés)
        // 650 = surfaces surélevées / hovers · 710 = zone éditeur · 725 = champs / puits
        dark: {
          '50':  '#f8fafc',
          '100': '#f1f5f9',
          '200': '#e2e8f0',
          '300': '#cbd5e1',
          '400': '#94a3b8',
          '500': '#64748b',
          '600': '#475569',
          '650': '#2a3442',
          '700': '#202935',
          '710': '#1b2430',
          '725': '#161e29',
          '800': '#121923',
          '900': '#0d131b',
          '950': '#020617',
        },
        // États sémantiques — synchronisés avec `globals.css` (--success / --warning)
        success: {
          DEFAULT:    'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          muted:      'rgba(34, 197, 94, 0.14)',
        },
        warning: {
          DEFAULT:    'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          muted:      'rgba(245, 158, 11, 0.16)',
        },
        // Variables CSS shadcn/ui
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },

  // tailwindcss-animate : requis pour les animations shadcn/ui (accordion, etc.)
  plugins: [require('tailwindcss-animate')],
};

export default config;
