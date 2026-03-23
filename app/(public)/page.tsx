'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { LazyMotion, domAnimation, m, useScroll, useMotionValueEvent } from 'framer-motion';
import {
  GLOBAL,
  LANDING_NAV,
  LANDING_HERO,
  LANDING_FEATURES_SECTION,
  LANDING_FEATURE_ITEMS,
  LANDING_FINAL_CTA,
  LANDING_FOOTER,
} from '@/src/frontend/content/copy';
import type { FeatureKey } from '@/src/frontend/content/copy';
import ThemeToggle from '@/src/frontend/components/common/ThemeToggle';

// ── Variants d'animation ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { y: 28, opacity: 0 },
  show:   { y: 0,  opacity: 1 },
};

const heroStagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const sectionStagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const cardVariant = {
  hidden: { y: 36, opacity: 0, scale: 0.97 },
  show:   { y: 0,  opacity: 1, scale: 1 },
};

// ── Icônes des fonctionnalités ─────────────────────────────────────────────────

const FEATURE_ICONS: Record<FeatureKey, ReactNode> = {
  editor: (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  folders: (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  search: (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  offline: (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  attachments: (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  privacy: (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-screen bg-white dark:bg-[#080c14] text-gray-900 dark:text-white antialiased transition-colors duration-300">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <m.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`fixed top-0 inset-x-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? 'border-gray-200 dark:border-white/[0.08] bg-white/95 dark:bg-[#080c14]/95 backdrop-blur-lg shadow-sm dark:shadow-none'
            : 'border-gray-100 dark:border-white/[0.04] bg-white/80 dark:bg-[#080c14]/70 backdrop-blur-md'
        }`}
      >
        <nav
          role="navigation"
          aria-label={LANDING_NAV.ariaLabel}
          className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between"
        >
          <Link href="/" className="flex items-center gap-2 group">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="#3b82f6"/>
              <path d="M8 9h12M8 14h8M8 19h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="font-semibold text-[15px] tracking-tight text-gray-900 dark:text-white/90 group-hover:text-blue-600 dark:group-hover:text-white transition-colors">
              {GLOBAL.brand}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" />
            <Link
              href="/login"
              className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-white/70 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            >
              {LANDING_NAV.loginLabel}
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              {LANDING_NAV.registerLabel}
            </Link>
          </div>
        </nav>
      </m.header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-16 overflow-hidden">

        <div className="landing-hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

        <m.div
          variants={heroStagger}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center"
        >
          {/* Badge */}
          <m.div
            variants={fadeUp}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" aria-hidden="true" />
            {LANDING_HERO.badge}
          </m.div>

          {/* Titre */}
          <m.h1
            variants={fadeUp}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.12] text-gray-900 dark:text-white"
          >
            {LANDING_HERO.headline}
            <span className="landing-headline-gradient bg-clip-text text-transparent">
              {LANDING_HERO.headlineAccent}
            </span>
          </m.h1>

          {/* Sous-titre */}
          <m.p
            variants={fadeUp}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-base sm:text-lg text-gray-500 dark:text-white/50 leading-relaxed"
          >
            {LANDING_HERO.subheadline}
          </m.p>

          {/* CTAs */}
          <m.div
            variants={fadeUp}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-col sm:flex-row items-center gap-3"
          >
            <Link
              href="/register"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              {LANDING_HERO.ctaPrimary}
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white rounded-xl border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
            >
              {LANDING_HERO.ctaSecondary}
            </Link>
          </m.div>

          {/* Réassurance */}
          <m.p
            variants={fadeUp}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="mt-8 text-xs text-gray-400 dark:text-white/25"
          >
            {LANDING_HERO.reassurance}
          </m.p>
        </m.div>

        {/* Indicateur scroll */}
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6, ease: 'easeOut' }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-gray-300 dark:text-white/20"
          aria-hidden="true"
        >
          <span className="text-[10px] tracking-widest uppercase">{LANDING_HERO.scrollLabel}</span>
          <m.svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          >
            <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </m.svg>
        </m.div>
      </section>

      {/* ── Fonctionnalités ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24" id="features">

        <m.div
          variants={sectionStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, margin: '-80px' }}
          className="text-center mb-16"
        >
          <m.p
            variants={fadeUp}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400/80 mb-3"
          >
            {LANDING_FEATURES_SECTION.eyebrow}
          </m.p>
          <m.h2
            variants={fadeUp}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white"
          >
            {LANDING_FEATURES_SECTION.headline}
            <br className="hidden sm:block" />
            {LANDING_FEATURES_SECTION.headlinePart2}
          </m.h2>
          <m.p
            variants={fadeUp}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 text-sm text-gray-400 dark:text-white/40 max-w-md mx-auto"
          >
            {LANDING_FEATURES_SECTION.subheadline}
          </m.p>
        </m.div>

        <m.div
          variants={sectionStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, margin: '-60px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {LANDING_FEATURE_ITEMS.map((feature) => (
            <m.div
              key={feature.key}
              variants={cardVariant}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
              className="group relative rounded-2xl border border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100/80 dark:hover:bg-white/[0.05] p-6 cursor-default transition-colors hover:border-gray-200 dark:hover:border-white/[0.12]"
            >
              <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/15 transition-colors">
                {FEATURE_ICONS[feature.key]}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 dark:text-white/40 leading-relaxed">{feature.description}</p>
            </m.div>
          ))}
        </m.div>
      </section>

      {/* ── Appel à l'action final ────────────────────────────────────────────── */}
      <m.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: '-80px' }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-6xl px-6 pb-28"
      >
        <div className="landing-cta-bg relative rounded-3xl overflow-hidden border border-blue-100 dark:border-white/[0.08] bg-blue-50/50 dark:bg-transparent p-10 sm:p-16 text-center">
          <m.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 text-gray-900 dark:text-white"
          >
            {LANDING_FINAL_CTA.headline}
          </m.h2>
          <m.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="text-sm text-gray-500 dark:text-white/40 max-w-sm mx-auto mb-8"
          >
            {LANDING_FINAL_CTA.subheadline}
          </m.p>
          <m.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.45, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-xl shadow-blue-600/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0"
            >
              {LANDING_FINAL_CTA.button}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </m.div>
        </div>
      </m.section>

      {/* ── Pied de page ─────────────────────────────────────────────────────── */}
      <m.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="border-t border-gray-100 dark:border-white/[0.06] py-8 px-6"
      >
        <div className="mx-auto max-w-6xl flex items-center justify-center text-xs text-gray-400 dark:text-white/25">
          <span>{LANDING_FOOTER.copyright}</span>
        </div>
      </m.footer>

    </div>
    </LazyMotion>
  );
}
