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

vi.mock('@/src/backend/lib/password', () => ({
  verifyPassword: vi.fn(),
  hashPassword:   vi.fn().mockResolvedValue('$argon2id$mock-hash'),
}));

import { prisma } from '@/src/backend/db/prisma';
import { POST } from '@/app/api/auth/change-password/route';
import { verifyPassword, hashPassword } from '@/src/backend/lib/password';

const mockPrisma        = prisma as { user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
const mockVerifyPassword = verifyPassword as ReturnType<typeof vi.fn>;
// hashPassword imported to silence unused-import lint — it's mocked above
void hashPassword;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.update.mockResolvedValue({});
    mockVerifyPassword.mockResolvedValue({ valid: true, needsRehash: false });
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
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$some-hash' });
    mockVerifyPassword.mockResolvedValue({ valid: false, needsRehash: false });

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
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$some-hash' });

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
