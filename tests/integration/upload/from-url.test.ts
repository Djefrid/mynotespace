// @vitest-environment node
/**
 * Tests d'intégration — POST /api/upload/from-url
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makePost } from '../helpers/request';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireWorkspaceId = vi.fn();
const mockRequireRole        = vi.fn();

vi.mock('@/src/backend/auth/session', () => ({
  requireWorkspaceId: () => mockRequireWorkspaceId(),
  requireRole:        () => mockRequireRole(),
}));

// Mock file-type pour éviter la détection de magic bytes sur des buffers de test
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn().mockResolvedValue({ mime: 'image/png', ext: 'png' }),
}));

vi.mock('@/src/backend/db/prisma', () => ({
  prisma: {
    note: { findFirst: vi.fn() },
  },
}));

vi.mock('@/src/backend/integrations/r2/client', () => ({
  r2:            { send: vi.fn().mockResolvedValue({}) },
  R2_BUCKET:     'mynotespace',
  R2_PUBLIC_URL: 'https://assets.djefrid.ca',
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
import { fileTypeFromBuffer } from 'file-type';
import { POST } from '@/app/api/upload/from-url/route';

const mockPrisma             = prisma as { note: { findFirst: ReturnType<typeof vi.fn> } };
const mockCheckRateLimit     = checkRateLimit as ReturnType<typeof vi.fn>;
const mockFileTypeFromBuffer = fileTypeFromBuffer as ReturnType<typeof vi.fn>;

/** Crée une fausse réponse fetch d'image. */
function makeFakeImageFetch(opts: {
  ok?:           boolean;
  status?:       number;
  contentType?:  string;
  contentLength?: string;
  body?:         ArrayBuffer;
} = {}) {
  const {
    ok           = true,
    status       = 200,
    contentType  = 'image/png',
    contentLength = '1024',
    body         = new ArrayBuffer(1024),
  } = opts;

  return vi.fn().mockResolvedValue({
    ok,
    status,
    headers: {
      get: (key: string) => {
        if (key === 'content-type')   return contentType;
        if (key === 'content-length') return contentLength;
        return null;
      },
    },
    arrayBuffer: () => Promise.resolve(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/upload/from-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWorkspaceId.mockResolvedValue('ws-123');
    mockRequireRole.mockResolvedValue({ userId: 'user-123', workspaceId: 'ws-123', role: 'OWNER' });
    mockPrisma.note.findFirst.mockResolvedValue({ id: 'note-abc' });
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });
    vi.stubGlobal('fetch', makeFakeImageFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('401 — non authentifié', async () => {
    mockRequireRole.mockRejectedValue(new Error('Unauthorized'));

    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/image.png',
    }));

    expect(res.status).toBe(401);
  });

  it('429 — rate limit dépassé', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/image.png',
    }));

    expect(res.status).toBe(429);
  });

  it('400 — URL invalide', async () => {
    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'pas-une-url',
    }));

    expect(res.status).toBe(400);
  });

  it('400 — URL localhost bloquée (SSRF)', async () => {
    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'http://localhost/admin',
    }));

    expect(res.status).toBe(400);
  });

  it('400 — IP privée 10.x bloquée (SSRF)', async () => {
    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'http://10.0.0.1/secret',
    }));

    expect(res.status).toBe(400);
  });

  it('400 — IP privée 192.168.x bloquée (SSRF)', async () => {
    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'http://192.168.1.1/secret',
    }));

    expect(res.status).toBe(400);
  });

  it('404 — note introuvable dans ce workspace', async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);

    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-inconnue',
      url:    'https://example.com/image.png',
    }));

    expect(res.status).toBe(404);
  });

  it('422 — source inaccessible (fetch retourne 404)', async () => {
    vi.stubGlobal('fetch', makeFakeImageFetch({ ok: false, status: 404 }));

    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/image.png',
    }));

    expect(res.status).toBe(422);
  });

  it('422 — fetch échoue (timeout / réseau)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/image.png',
    }));

    expect(res.status).toBe(422);
  });

  it('415 — type MIME non autorisé', async () => {
    vi.stubGlobal('fetch', makeFakeImageFetch({ contentType: 'application/pdf' }));
    // Magic bytes détectent aussi un type non autorisé
    mockFileTypeFromBuffer.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });

    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/document.pdf',
    }));

    expect(res.status).toBe(415);
  });

  it('413 — image trop grande (Content-Length)', async () => {
    vi.stubGlobal('fetch', makeFakeImageFetch({ contentLength: String(20 * 1024 * 1024) }));

    const res = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/large.png',
    }));

    expect(res.status).toBe(413);
  });

  it('200 — re-upload réussi, retourne publicUrl R2', async () => {
    const res  = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/image.png',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveProperty('publicUrl');
    expect(json.data.publicUrl).toMatch(/^https:\/\/assets\.djefrid\.ca\//);
  });

  it('200 — la clé R2 contient workspaceId et noteId', async () => {
    const res  = await POST(makePost('http://localhost/api/upload/from-url', {
      noteId: 'note-abc',
      url:    'https://example.com/image.png',
    }));
    const json = await res.json();

    expect(json.data.publicUrl).toContain('ws-123');
    expect(json.data.publicUrl).toContain('note-abc');
  });
});
