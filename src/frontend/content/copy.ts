/**
 * ============================================================================
 * FICHIER CENTRAL — Tous les textes visibles par l'utilisateur
 * ============================================================================
 *
 * Pour modifier un texte → trouver le bloc correspondant à la page et changer
 * la valeur. Les composants importent uniquement ce fichier.
 *
 * Règles :
 *   - Jamais de mention de stack technique (JWT, OAuth, PostgreSQL, etc.)
 *   - Toujours vouvoyer l'utilisateur (vous / votre / vos)
 *   - Les icônes SVG restent dans les composants (JSX non sérialisable)
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL — éléments partagés entre plusieurs pages
// ─────────────────────────────────────────────────────────────────────────────

export const GLOBAL = {
  brand:          'MyNoteSpace',
  separator:      'ou',
  googleButton:   'Continuer avec Google',
  googleAriaLogin:    'Se connecter avec Google',
  googleAriaRegister: "S'inscrire avec Google",
  cancel:         'Annuler',
  close:          'Fermer',
  errors: {
    generic:  'Une erreur est survenue. Veuillez réessayer.',
    network:  'Une erreur réseau est survenue. Veuillez réessayer.',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE — app/(public)/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const LANDING_NAV = {
  ariaLabel:     'Navigation principale',
  loginLabel:    'Se connecter',
  registerLabel: 'Créer un compte',
} as const;

export const LANDING_HERO = {
  badge:          'Installable · Hors ligne · Gratuit',
  headline:       'L\u2019espace où\u00a0',
  headlineAccent: 'vos idées prennent forme',
  subheadline:
    'Un éditeur riche aussi puissant que Word, une organisation intelligente par dossiers et tags, une recherche plein\u2011texte instantanée. Vos notes. Votre espace.',
  ctaPrimary:     'Commencer gratuitement',
  ctaSecondary:   'Déjà un compte\u00a0→ Se connecter',
  reassurance:    'Aucune carte de crédit · Compte gratuit · Données hébergées au Canada',
  scrollLabel:    'Découvrir',
} as const;

export const LANDING_FEATURES_SECTION = {
  eyebrow:       'Fonctionnalités',
  headline:      'Tout ce dont vous avez besoin,',
  headlinePart2: 'rien de superflu',
  subheadline:
    'Conçu pour être rapide, privé et agréable à utiliser — du premier mot à la millième note.',
} as const;

export type FeatureKey = 'editor' | 'folders' | 'search' | 'offline' | 'attachments' | 'privacy';

export interface FeatureItem {
  key:         FeatureKey;
  title:       string;
  description: string;
}

export const LANDING_FEATURE_ITEMS: FeatureItem[] = [
  {
    key:         'editor',
    title:       'Éditeur riche et puissant',
    description: "Police, taille, tableaux, listes, équations, blocs de code avec coloration syntaxique. Un vrai outil d'écriture, pas un simple bloc-notes.",
  },
  {
    key:         'folders',
    title:       'Organisation sans effort',
    description: "Dossiers arborescents, dossiers intelligents, tags extraits automatiquement. Vos notes se rangent d'elles-mêmes au fil de l'écriture.",
  },
  {
    key:         'search',
    title:       'Recherche instantanée',
    description: "Recherche plein texte ultra-rapide. Retrouvez n'importe quelle idée en une fraction de seconde, même dans un espace de milliers de notes.",
  },
  {
    key:         'offline',
    title:       'Installable · Hors ligne',
    description: "Application installable sur iOS, Android et desktop. Vos notes restent accessibles même sans connexion — synchronisation automatique au retour en ligne.",
  },
  {
    key:         'attachments',
    title:       'Images & pièces jointes',
    description: "Glissez une image, collez depuis le presse-papier ou importez un fichier. Compression automatique et stockage sécurisé dans le nuage.",
  },
  {
    key:         'privacy',
    title:       'Privé par défaut',
    description: "Vos données vous appartiennent. Authentification sécurisée, chiffrement des mots de passe, protection anti-brute-force. Aucune donnée partagée.",
  },
];

export const LANDING_FINAL_CTA = {
  headline:    'Prêt à ne plus perdre une seule idée\u00a0?',
  subheadline: 'Créez votre espace personnel en quelques secondes. Gratuit, sans engagement.',
  button:      'Créer mon espace gratuitement',
} as const;

export const LANDING_FOOTER = {
  copyright: `© ${new Date().getFullYear()} MyNoteSpace\u00a0— Tous droits réservés`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE CONNEXION — app/(public)/login/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const AUTH_NAV = {
  backToHome:  '← Accueil',
  backToHomeAriaLabel: "Retour à la page d'accueil",
} as const;

export const LOGIN = {
  pageTitle:          'MyNoteSpace',
  pageSubtitle:       'Connexion à votre espace',
  emailLabel:         'Adresse courriel',
  emailPlaceholder:   'vous@exemple.com',
  passwordLabel:      'Mot de passe',
  passwordPlaceholder:'••••••••',
  submitIdle:         'Se connecter',
  submitLoading:      'Connexion\u2026',
  errorCredentials:   'Adresse courriel ou mot de passe incorrect.',
  noAccount:          'Pas encore de compte\u00a0?',
  registerLink:       'Créer un compte',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE INSCRIPTION — app/(public)/register/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTER = {
  pageTitle:              'MyNoteSpace',
  pageSubtitle:           'Créer un compte',
  emailLabel:             'Adresse courriel',
  emailPlaceholder:       'vous@exemple.com',
  passwordLabel:          'Mot de passe',
  passwordHint:           '(min.\u00a08 caractères)',
  passwordPlaceholder:    '••••••••',
  confirmPasswordLabel:   'Confirmer le mot de passe',
  confirmPlaceholder:     '••••••••',
  submitIdle:             'Créer mon compte',
  submitLoading:          'Création\u2026',
  errorPasswordMismatch:  'Les mots de passe ne correspondent pas.',
  alreadyAccount:         'Déjà un compte\u00a0?',
  loginLink:              'Se connecter',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PROFIL — app/(app)/profile/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const PROFILE_NAV = {
  compte:   'Compte',
  securite: 'Sécurité',
  espace:   'Espace',
  donnees:  'Données',
  danger:   'Zone danger',
  backTitle: 'Retour aux notes',
  pageTitle:  'Profil',
} as const;

export const PROFILE_ACCOUNT = {
  sectionTitle:      'Compte',
  editButton:        'Modifier',
  avatarAlt:         'Avatar',
  labelAuthMethod:   'Méthode de connexion',
  labelMemberSince:  'Membre depuis',
  authCredentials:   'Email + mot de passe',
  authGoogle:        'Google',
  nameLabel:         'Nom affiché',
  namePlaceholder:   'Votre nom',
  nameSaveIdle:      'Enregistrer',
  nameSaveLoading:   'Enregistrement\u2026',
  nameSuccess:       'Nom mis à jour.',
  nameErrorEmpty:    'Le nom ne peut pas être vide.',
  errorGeneric:      'Une erreur est survenue.',
  errorNetwork:      'Erreur réseau.',
} as const;

export const PROFILE_SECURITY = {
  sectionTitle:      'Sécurité',
  sessionLabel:      'Session active',
  sessionDetail:     'Ce navigateur',
  sessionBadge:      'Active',
  passwordLabel:     'Mot de passe',
  passwordEditBtn:   'Modifier',
  currentPwdLabel:   'Mot de passe actuel',
  newPwdLabel:       'Nouveau',
  newPwdHint:        '(min.\u00a08 caractères)',
  confirmPwdLabel:   'Confirmer',
  pwdPlaceholder:    '••••••••',
  pwdMismatch:       'Les mots de passe ne correspondent pas.',
  pwdSaveIdle:       'Changer',
  pwdSaveLoading:    'Changement\u2026',
  pwdSuccess:        'Mot de passe modifié avec succès.',
  errorGeneric:      'Une erreur est survenue.',
  errorNetwork:      'Erreur réseau.',
} as const;

export const PROFILE_WORKSPACE = {
  sectionTitle:     'Espace personnel',
  statActiveNotes:  'Notes actives',
  statTrashed:      'Corbeille',
  statFolders:      'Dossiers',
  statTags:         'Tags',
  statFiles:        'Fichiers',
  statStorage:      'Stockage utilisé',
} as const;

export const PROFILE_DATA = {
  sectionTitle:   'Données & confidentialité',
  description:    'Vos notes sont privées et accessibles uniquement par vous. Aucune donnée n\u2019est partagée avec des tiers.',
  exportIdle:     'Exporter mes notes (JSON)',
  exportLoading:  'Export en cours\u2026',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PROFIL — section Apparence
// ─────────────────────────────────────────────────────────────────────────────

export const PROFILE_APPEARANCE = {
  sectionTitle:   'Apparence',
  themeLabel:     'Thème de l\'interface',
  themeLight:     'Clair',
  themeDark:      'Sombre',
  themeSystem:    'Système',
  themeHint:      'Système suit automatiquement la préférence de votre appareil.',
} as const;

export const PROFILE_DANGER = {
  sectionTitle:          'Zone de danger',
  logoutLabel:           'Déconnexion',
  logoutDetail:          'Votre session sur ce navigateur prendra fin',
  logoutButton:          'Déconnexion',
  logoutModalTitle:      'Déconnexion',
  logoutModalMessage:    'Êtes-vous sûr de vouloir vous déconnecter\u00a0?',
  deleteLabel:           'Supprimer mon compte',
  deleteDetail:          'Action irréversible — toutes les données seront perdues',
  deleteButton:          'Supprimer',
  deleteModalTitle:      'Supprimer mon compte',
  deleteModalWarning:    'Cette action est irréversible. Toutes vos notes, dossiers, tags et fichiers seront supprimés définitivement.',
  deleteModalInstruction: 'Saisissez\u00a0',
  deleteModalKeyword:    'SUPPRIMER',
  deleteModalSuffix:     '\u00a0pour confirmer.',
  deleteConfirmIdle:     'Supprimer définitivement',
  deleteConfirmLoading:  'Suppression\u2026',
  deleteErrorRetry:      'Une erreur est survenue. Veuillez réessayer.',
  deleteErrorServer:     'Erreur serveur.',
} as const;
