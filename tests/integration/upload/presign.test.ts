// @vitest-environment node
/**
 * Tests d'intégration — POST /api/upload/presign
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makePost } from '../helpers/request';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireWorkspaceId = vi.fn();
const mockRequireRole        = vi.fn();

vi.mock('@/src/backend/auth/session', () => ({
  requireWorkspaceId: () => mockRequireWorkspaceId(),
  requireRole:        () => mockRequireRole(),
}));

vi.mock('@/src/backend/db/prisma', () => ({
  prisma: {
    note: { findFirst: vi.fn() },
  },
}));

vi.mock('@/src/backend/integrations/r2/client', () => ({
  r2:           {},
  R2_BUCKET:    'mynotespace',
  R2_PUBLIC_URL: 'https://assets.djefrid.ca',
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://r2.example.com/presigned-upload-url'),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PutObjectCommand: class { constructor(public input: any) {} },
}));

vi.mock('@/src/backend/lib/rate-limit', () => ({
  checkRateLimit:    vi.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: vi.fn().mockImplementation(() =>
    new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429 })
  ),
}));

import { prisma } from '@/src/backend/db/prisma';
import { checkRateLimit } from '@/src/backend/lib/rate-limit';
import { POST } from '@/app/api/upload/presign/route';

const mockPrisma = prisma as { note: { findFirst: ReturnType<typeof vi.fn> } };
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

const VALID_BODY = {
  noteId:   'note-abc',
  filename: 'image.png',
  mimeType: 'image/png',
  size:     512_000,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/upload/presign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWorkspaceId.mockResolvedValue('ws-123');
    mockRequireRole.mockResolvedValue({ userId: 'user-123', workspaceId: 'ws-123', role: 'OWNER' });
    mockPrisma.note.findFirst.mockResolvedValue({ id: 'note-abc' });
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it('401 — non authentifié', async () => {
    mockRequireRole.mockRejectedValue(new Error('Unauthorized'));

    const res = await POST(makePost('http://localhost/api/upload/presign', VALID_BODY));

    expect(res.status).toBe(401);
  });

  it('429 — rate limit dépassé', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const res = await POST(makePost('http://localhost/api/upload/presign', VALID_BODY));

    expect(res.status).toBe(429);
  });

  it('400 — noteId manquant', async () => {
    const res = await POST(makePost('http://localhost/api/upload/presign', {
      filename: 'image.png',
      mimeType: 'image/png',
      size:     512_000,
    }));

    expect(res.status).toBe(400);
  });

  it('400 — type MIME non autorisé', async () => {
    const res = await POST(makePost('http://localhost/api/upload/presign', {
      ...VALID_BODY,
      mimeType: 'application/x-executable',
    }));

    expect(res.status).toBe(400);
  });

  it('400 — fichier trop lourd', async () => {
    const res = await POST(makePost('http://localhost/api/upload/presign', {
      ...VALID_BODY,
      size: 999_999_999,
    }));

    expect(res.status).toBe(400);
  });

  it('404 — note introuvable dans ce workspace', async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);

    const res = await POST(makePost('http://localhost/api/upload/presign', VALID_BODY));

    expect(res.status).toBe(404);
  });

  it('200 — retourne uploadUrl et publicUrl', async () => {
    const res  = await POST(makePost('http://localhost/api/upload/presign', VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveProperty('uploadUrl');
    expect(json.data).toHaveProperty('publicUrl');
    expect(json.data).toHaveProperty('key');
    expect(json.data.publicUrl).toMatch(/^https:\/\/assets\.djefrid\.ca\//);
  });

  it('200 — la clé R2 contient le workspaceId et le noteId', async () => {
    const res  = await POST(makePost('http://localhost/api/upload/presign', VALID_BODY));
    const json = await res.json();

    expect(json.data.key).toContain('ws-123');
    expect(json.data.key).toContain('note-abc');
  });
});
