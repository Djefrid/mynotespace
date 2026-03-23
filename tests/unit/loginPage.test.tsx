/**
 * Tests de la page de connexion (Auth.js).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mocks Next.js / Auth.js ──────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signIn:  vi.fn(),
  signOut: vi.fn(),
}));

import LoginPage from '@/app/login/page';

/** Session non connectée par défaut */
const notAuthenticated = { data: null, status: 'unauthenticated' as const };

describe('LoginPage — page de connexion', () => {
  it('affiche le titre "MyNoteSpace"', () => {
    mockUseSession.mockReturnValue(notAuthenticated);
    render(<LoginPage />);
    expect(screen.getByText('MyNoteSpace')).toBeInTheDocument();
  });

  it('affiche les champs email et mot de passe', () => {
    mockUseSession.mockReturnValue(notAuthenticated);
    render(<LoginPage />);
    expect(screen.getByLabelText('Adresse courriel')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
  });

  it('affiche le bouton "Se connecter" (email/mdp)', () => {
    mockUseSession.mockReturnValue(notAuthenticated);
    render(<LoginPage />);
    const btn = screen.getByRole('button', { name: 'Se connecter' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'submit');
  });

  it('le bouton Google a un aria-label accessible', () => {
    mockUseSession.mockReturnValue(notAuthenticated);
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Se connecter avec Google' })).toBeInTheDocument();
  });

  it('affiche un spinner quand status="loading"', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' as const });
    const { container } = render(<LoginPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('le champ email a autocomplete="email"', () => {
    mockUseSession.mockReturnValue(notAuthenticated);
    render(<LoginPage />);
    const emailInput = screen.getByLabelText('Adresse courriel');
    expect(emailInput).toHaveAttribute('autocomplete', 'email');
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('le champ password a autocomplete="current-password"', () => {
    mockUseSession.mockReturnValue(notAuthenticated);
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText('Mot de passe');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('ne plante pas si déjà authentifié', () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'djefridbyli@gmail.com' } }, status: 'authenticated' as const });
    expect(() => render(<LoginPage />)).not.toThrow();
  });
});
