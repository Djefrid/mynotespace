/**
 * ============================================================================
 * BACKFILL PLAINTEXT — scripts/backfill-note-excerpts.ts
 * ============================================================================
 *
 * Remplit le champ `plainText` pour toutes les NoteContent où il est vide.
 *
 * Best practice (source: ProseMirror forum + TipTap GitHub issue #7106) :
 *   - JSON présent  → `Node.textBetween` via `@tiptap/pm/model` (0 DOM, Node.js safe)
 *   - HTML seulement → stripHtml regex (generateJSON/@tiptap/html ne fonctionne pas
 *     en Node.js sans DOM virtuel — comportement documenté, voir issue #7106)
 *
 * Usage :
 *   npx tsx scripts/backfill-note-excerpts.ts
 * ============================================================================
 */

import path from 'path';
import { config as dotenv } from 'dotenv';
dotenv({ path: path.join(process.cwd(), '.env.local') });

import { PrismaClient }    from '@prisma/client';
import { PrismaPg }        from '@prisma/adapter-pg';
import { Pool }            from 'pg';
import { Node, Schema }    from '@tiptap/pm/model';
import { schema as basic } from '@tiptap/pm/schema-basic';
import { addListNodes }    from '@tiptap/pm/schema-list';

// ── Prisma ────────────────────────────────────────────────────────────────────

const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── Schéma ProseMirror minimal (covers StarterKit content + tables) ───────────

const pmSchema = new Schema({
  nodes: addListNodes(
    basic.spec.nodes,
    'paragraph block*',
    'block'
  ),
  marks: basic.spec.marks,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extrait le texte brut depuis un JSON ProseMirror via prosemirror-model.
 *  Méthode recommandée côté Node.js (pas de DOM, pas de window). */
function textFromJson(json: Record<string, unknown>): string {
  try {
    const doc = Node.fromJSON(pmSchema, json);
    return doc.textBetween(0, doc.content.size, '\n', ' ').trim();
  } catch {
    // JSON non conforme au schéma minimal → fallback text walk
    return textWalk(json);
  }
}

/** Walk récursif manuel — fallback si le schéma ne reconnaît pas tous les noeuds. */
type PmNode = { type?: string; text?: string; content?: PmNode[] };
function textWalk(node: PmNode): string {
  if (!node) return '';
  if (node.type === 'text' && node.text) return node.text;
  return (node.content ?? []).map(textWalk).filter(Boolean).join(' ');
}

/** Strip HTML → texte brut (fallback pour les notes sans JSON). */
function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol|td|th|tr|blockquote)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/\s+/g,    ' ')
    .trim();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const contents = await prisma.noteContent.findMany({
    where:  { plainText: '' },
    select: { noteId: true, html: true, json: true },
  });

  console.log(`[backfill-excerpts] ${contents.length} notes à traiter`);

  let done   = 0;
  let errors = 0;

  for (const { noteId, html, json } of contents) {
    try {
      let plainText = '';

      if (json) {
        plainText = textFromJson(json as Record<string, unknown>);
      }

      if (!plainText && html) {
        plainText = stripHtml(html);
      }

      if (!plainText.trim()) continue;   // note réellement vide

      await prisma.noteContent.update({
        where: { noteId },
        data: {
          plainText,
          wordCount:      plainText.split(/\s+/).filter(Boolean).length,
          characterCount: plainText.length,
        },
      });

      done++;
    } catch (err) {
      console.error(`[backfill-excerpts] Erreur note ${noteId}:`, (err as Error).message);
      errors++;
    }
  }

  console.log(`[backfill-excerpts] Terminé — ${done} notes mises à jour, ${errors} erreurs`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
