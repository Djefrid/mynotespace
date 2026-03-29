// @vitest-environment node
/**
 * Tests d'intégration — POST /api/auth/register
 *
 * Prisma et bcryptjs sont mockés : on teste la logique du route handler
 * sans toucher la base de données.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makePost } from '../helpers/request';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/backend/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create:     vi.fn(),
    },
  },
}));

vi.mock('@/src/backend/services/user-bootstrap.service', () => ({
  provisionPersonalWorkspace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/src/backend/lib/rate-limit', () => ({
  checkRateLimit:    vi.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: vi.fn(),
}));

vi.mock('@/src/backend/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$mock-hash'),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

import { prisma } from '@/src/backend/db/prisma';
import { POST } from '@/app/api/auth/register/route';

const mockPrisma = prisma as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create:     ReturnType<typeof vi.fn>;
  };
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'user-123' });
  });

  it('201 — inscription réussie avec données valides', async () => {
    const req = makePost('http://localhost/api/auth/register', {
      email:           'test@exemple.com',
      password:        'motdepasse123',
      confirmPassword: 'motdepasse123',
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.success).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledOnce();
  });

  it('409 — email déjà utilisé', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    const req = makePost('http://localhost/api/auth/register', {
      email:           'existe@exemple.com',
      password:        'motdepasse123',
      confirmPassword: 'motdepasse123',
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('400 — corps de requête invalide (email manquant)', async () => {
    const req = makePost('http://localhost/api/auth/register', {
      password:        'motdepasse123',
      confirmPassword: 'motdepasse123',
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('400 — mot de passe trop court (< 8 caractères)', async () => {
    const req = makePost('http://localhost/api/auth/register', {
      email:           'test@exemple.com',
      password:        '123',
      confirmPassword: '123',
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('400 — mots de passe différents', async () => {
    const req = makePost('http://localhost/api/auth/register', {
      email:           'test@exemple.com',
      password:        'motdepasse123',
      confirmPassword: 'autrechose456',
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
