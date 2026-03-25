/**
 * ============================================================================
 * BACKFILL JSON — scripts/backfill-note-json.ts
 * ============================================================================
 *
 * Convertit le contenu HTML des notes existantes en JSON ProseMirror + plainText.
 *
 * À exécuter une seule fois après la migration vers le stockage JSON.
 * Les notes ayant déjà un json != NULL sont ignorées.
 *
 * Usage :
 *   npx tsx scripts/backfill-note-json.ts
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { generateJSON, generateText } from '@tiptap/html';
import { StarterKit } from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';

const prisma = new PrismaClient();

// Extensions utilisées pour le parsing HTML → JSON
// (sous-ensemble edge-safe des extensions TipTap du projet)
const EXTENSIONS = [
  StarterKit,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  Highlight.configure({ multicolor: true }),
  Link,
  Image,
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem.configure({ nested: true }),
  Superscript,
  Subscript,
];

async function main() {
  // Récupère toutes les NoteContent sans json
  const contents = await prisma.noteContent.findMany({
    where:  { json: null },
    select: { noteId: true, html: true },
  });

  console.log(`[backfill] ${contents.length} notes sans JSON à traiter`);

  let done = 0;
  let errors = 0;

  for (const { noteId, html } of contents) {
    try {
      const json      = generateJSON(html || '<p></p>', EXTENSIONS);
      const plainText = generateText(json, EXTENSIONS);

      // Compte les mots (séparés par espaces)
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;

      await prisma.noteContent.update({
        where: { noteId },
        data:  {
          json:      json as object,
          plainText,
          wordCount,
          characterCount: plainText.length,
        },
      });
      done++;
      if (done % 50 === 0) console.log(`[backfill] ${done}/${contents.length}...`);
    } catch (err) {
      console.error(`[backfill] Erreur note ${noteId}:`, err);
      errors++;
    }
  }

  console.log(`[backfill] Terminé — ${done} notes mises à jour, ${errors} erreurs`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
