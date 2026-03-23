// @vitest-environment node
/**
 * Tests d'intégration — DELETE /api/auth/account
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeDelete } from '../helpers/request';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireSession = vi.fn();

vi.mock('@/src/backend/auth/session', () => ({
  requireSession: () => mockRequireSession(),
}));

vi.mock('@/src/backend/db/prisma', () => ({
  prisma: {
    workspace: { deleteMany: vi.fn() },
    user:      { delete:     vi.fn() },
  },
}));

vi.mock('@/src/backend/lib/rate-limit', () => ({
  checkRateLimit:    vi.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: vi.fn().mockImplementation(() =>
    new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429 })
  ),
}));

import { prisma } from '@/src/backend/db/prisma';
import { checkRateLimit } from '@/src/backend/lib/rate-limit';
import { DELETE } from '@/app/api/auth/account/route';

const mockPrisma = prisma as {
  workspace: { deleteMany: ReturnType<typeof vi.fn> };
  user:      { delete:     ReturnType<typeof vi.fn> };
};
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DELETE /api/auth/account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ userId: 'user-123', workspaceId: 'ws-123' });
    mockPrisma.workspace.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.delete.mockResolvedValue({ id: 'user-123' });
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it('401 — non authentifié', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'));

    const res = await DELETE();

    expect(res.status).toBe(401);
  });

  it('429 — rate limit dépassé', async () => {
    mockRequireSession.mockResolvedValue({ userId: 'user-123', workspaceId: 'ws-123' });
    mockCheckRateLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const res = await DELETE();

    expect(res.status).toBe(429);
  });

  it('200 — suppression réussie', async () => {
    const res  = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.success).toBe(true);
  });

  it('supprime les workspaces avant le user (ordre cascade)', async () => {
    const callOrder: string[] = [];
    mockPrisma.workspace.deleteMany.mockImplementation(() => {
      callOrder.push('workspace');
      return Promise.resolve({ count: 1 });
    });
    mockPrisma.user.delete.mockImplementation(() => {
      callOrder.push('user');
      return Promise.resolve({ id: 'user-123' });
    });

    await DELETE();

    expect(callOrder).toEqual(['workspace', 'user']);
  });

  it('supprime uniquement les workspaces de cet utilisateur', async () => {
    await DELETE();

    expect(mockPrisma.workspace.deleteMany).toHaveBeenCalledWith({
      where: { ownerUserId: 'user-123' },
    });
  });
});
