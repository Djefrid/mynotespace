// @vitest-environment node
/**
 * Tests d'intégration — GET & POST /api/notes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeGet, makePost } from '../helpers/request';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireWorkspaceId = vi.fn();

vi.mock('@/src/backend/auth/session', () => ({
  requireWorkspaceId: () => mockRequireWorkspaceId(),
}));

vi.mock('@/src/backend/services/notes-pg.service', () => ({
  getNotesForWorkspace: vi.fn().mockResolvedValue({ notes: [], nextCursor: null }),
  createNote:           vi.fn().mockResolvedValue({ id: 'note-123', title: 'Test', content: '' }),
}));

vi.mock('@/src/backend/integrations/inngest/client', () => ({
  inngest:     { send: vi.fn().mockResolvedValue(undefined) },
  noteWritten: { create: vi.fn().mockReturnValue({ name: 'note/written', data: {} }) },
}));

vi.mock('@/src/backend/lib/rate-limit', () => ({
  checkRateLimit:    vi.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: vi.fn(),
}));

/* Le route POST fait un import() dynamique de auth pour récupérer userId */
vi.mock('@/src/backend/auth/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-123' } }),
}));

import { GET, POST } from '@/app/api/notes/route';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — non authentifié', async () => {
    mockRequireWorkspaceId.mockRejectedValue(new Error('Unauthorized'));

    const res = await GET(makeGet('http://localhost/api/notes'));

    expect(res.status).toBe(401);
  });

  it('200 — retourne la liste des notes', async () => {
    mockRequireWorkspaceId.mockResolvedValue('ws-123');

    const res = await GET(makeGet('http://localhost/api/notes'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveProperty('notes');
  });
});

describe('POST /api/notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — non authentifié', async () => {
    mockRequireWorkspaceId.mockRejectedValue(new Error('Unauthorized'));

    const res = await POST(makePost('http://localhost/api/notes', { title: 'Ma note' }));

    expect(res.status).toBe(401);
  });

  it('201 — crée une note avec titre valide', async () => {
    mockRequireWorkspaceId.mockResolvedValue('ws-123');

    const res = await POST(makePost('http://localhost/api/notes', { title: 'Ma nouvelle note' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data).toHaveProperty('id');
  });
});
