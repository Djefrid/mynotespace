// @vitest-environment node
/**
 * Tests d'intégration — POST /api/auth/change-password
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makePost } from '../helpers/request';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireSession = vi.fn();

vi.mock('@/src/backend/auth/session', () => ({
  requireSession: () => mockRequireSession(),
}));

vi.mock('@/src/backend/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  },
}));

vi.mock('@/src/backend/lib/rate-limit', () => ({
  checkRateLimit:    vi.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: vi.fn(),
}));

import { prisma } from '@/src/backend/db/prisma';
import { POST } from '@/app/api/auth/change-password/route';
import bcrypt from 'bcryptjs';

const mockPrisma = prisma as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update:     ReturnType<typeof vi.fn>;
  };
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.update.mockResolvedValue({});
  });

  it('401 — non authentifié', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'));

    const req = makePost('http://localhost/api/auth/change-password', {
      currentPassword: 'ancien123',
      newPassword:     'nouveau456',
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('400 — mot de passe actuel incorrect', async () => {
    mockRequireSession.mockResolvedValue({ userId: 'user-123' });

    const hash = await bcrypt.hash('bon-mot-de-passe', 10);
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: hash });

    const req = makePost('http://localhost/api/auth/change-password', {
      currentPassword: 'mauvais-mot-de-passe',
      newPassword:     'nouveau456nouveau',
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('incorrect');
  });

  it('400 — compte OAuth (pas de mot de passe)', async () => {
    mockRequireSession.mockResolvedValue({ userId: 'user-google' });
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: null });

    const req = makePost('http://localhost/api/auth/change-password', {
      currentPassword: 'nimporte',
      newPassword:     'nouveau456nouveau',
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('200 — changement de mot de passe réussi', async () => {
    mockRequireSession.mockResolvedValue({ userId: 'user-123' });

    const hash = await bcrypt.hash('ancien-correct', 10);
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: hash });

    const req = makePost('http://localhost/api/auth/change-password', {
      currentPassword: 'ancien-correct',
      newPassword:     'nouveau-super-secure',
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledOnce();
  });
});
