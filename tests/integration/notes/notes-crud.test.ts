// @vitest-environment node
/**
 * Tests d'intégration — GET & POST /api/notes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeGet, makePost } from '../helpers/request';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireWorkspaceId = vi.fn();
const mockRequireRole        = vi.fn();

vi.mock('@/src/backend/auth/session', () => ({
  requireWorkspaceId: () => mockRequireWorkspaceId(),
  requireRole:        () => mockRequireRole(),
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
  rateLimitResponse: vi.fn().mockImplementation(() =>
    new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429 })
  ),
}));

/* Le route POST fait un import() dynamique de auth pour récupérer userId */
vi.mock('@/src/backend/auth/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-123' } }),
}));

import { GET, POST } from '@/app/api/notes/route';
import { checkRateLimit } from '@/src/backend/lib/rate-limit';
import { createNote, getNotesForWorkspace } from '@/src/backend/services/notes-pg.service';

const mockCheckRateLimit    = checkRateLimit as ReturnType<typeof vi.fn>;
const mockCreateNote        = createNote as ReturnType<typeof vi.fn>;
const mockGetNotes          = getNotesForWorkspace as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWorkspaceId.mockResolvedValue('ws-123');
    mockGetNotes.mockResolvedValue({ notes: [], nextCursor: null });
  });

  it('401 — non authentifié', async () => {
    mockRequireWorkspaceId.mockRejectedValue(new Error('Unauthorized'));

    const res = await GET(makeGet('http://localhost/api/notes'));

    expect(res.status).toBe(401);
  });

  it('200 — retourne la liste des notes', async () => {
    const res  = await GET(makeGet('http://localhost/api/notes'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveProperty('notes');
  });

  it('200 — accepte le paramètre status=TRASHED', async () => {
    const res = await GET(makeGet('http://localhost/api/notes?status=TRASHED'));

    expect(res.status).toBe(200);
    expect(mockGetNotes).toHaveBeenCalledWith('ws-123', expect.objectContaining({ status: 'TRASHED' }));
  });

  it('400 — status invalide rejeté par Zod', async () => {
    const res = await GET(makeGet('http://localhost/api/notes?status=DELETED'));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWorkspaceId.mockResolvedValue('ws-123');
    mockRequireRole.mockResolvedValue({ userId: 'user-123', workspaceId: 'ws-123', role: 'OWNER' });
    mockCreateNote.mockResolvedValue({ id: 'note-123', title: 'Test' });
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it('401 — non authentifié', async () => {
    mockRequireRole.mockRejectedValue(new Error('Unauthorized'));

    const res = await POST(makePost('http://localhost/api/notes', { title: 'Ma note' }));

    expect(res.status).toBe(401);
  });

  it('429 — rate limit dépassé', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const res = await POST(makePost('http://localhost/api/notes', { title: 'Ma note' }));

    expect(res.status).toBe(429);
  });

  it('400 — titre trop long (> 200 caractères)', async () => {
    const res = await POST(makePost('http://localhost/api/notes', {
      title: 'x'.repeat(201),
    }));

    expect(res.status).toBe(400);
  });

  it('201 — crée une note avec titre valide', async () => {
    const res  = await POST(makePost('http://localhost/api/notes', { title: 'Ma nouvelle note' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data).toHaveProperty('id');
  });

  it('201 — crée une note sans titre (titre optionnel)', async () => {
    const res = await POST(makePost('http://localhost/api/notes', {}));

    expect(res.status).toBe(201);
  });
});
