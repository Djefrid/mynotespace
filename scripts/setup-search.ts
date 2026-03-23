/**
 * Configure la recherche full-text PostgreSQL (tsvector + GIN).
 *
 * À exécuter une seule fois après le déploiement initial :
 *   npx tsx --env-file=.env.local scripts/setup-search.ts
 *
 * Ce script :
 *   1. Active l'extension `unaccent`
 *   2. Crée une fonction wrapper IMMUTABLE (requis pour les index fonctionnels)
 *   3. Crée deux index GIN — un sur Note.title, un sur NoteContent.html
 *
 * Sans ce script, la recherche fonctionne quand même :
 *   - unaccent active mais sans index → scan séquentiel filtré par workspaceId
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔍 Configuration de la recherche full-text PostgreSQL…\n');

    // ── 1. Extension unaccent ─────────────────────────────────────────────────
    console.log('1/3 — Activation de l\'extension unaccent…');
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    console.log('     ✓ unaccent activée\n');

    // ── 2. Wrapper IMMUTABLE ──────────────────────────────────────────────────
    // unaccent() est STABLE par défaut → ne peut pas être utilisé dans un index.
    // Ce wrapper le déclare IMMUTABLE pour débloquer la création des index GIN.
    console.log('2/3 — Création du wrapper unaccent_immutable…');
    await client.query(`
      CREATE OR REPLACE FUNCTION unaccent_immutable(text)
      RETURNS text
      LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
      SET search_path = public AS $$
      BEGIN
        RETURN unaccent($1);
      END;
      $$;
    `);
    console.log('     ✓ unaccent_immutable créée\n');

    // ── 3. Index GIN fonctionnels ─────────────────────────────────────────────
    // Les expressions doivent correspondre EXACTEMENT à celles de searchNotesFts()
    // dans search.service.ts pour que PostgreSQL utilise les index.
    console.log('3/3 — Création des index GIN (peut prendre quelques secondes)…');

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_title_fts
      ON "Note"
      USING GIN (
        to_tsvector('simple', unaccent_immutable(coalesce(title, '')))
      )
    `);
    console.log('     ✓ Index GIN sur Note.title\n');

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_content_fts
      ON "NoteContent"
      USING GIN (
        to_tsvector('simple', unaccent_immutable(
          regexp_replace(coalesce(html, ''), '<[^>]+>', ' ', 'g')
        ))
      )
    `);
    console.log('     ✓ Index GIN sur NoteContent.html\n');

    console.log('✅ Recherche full-text configurée avec succès.');
    console.log('   Les prochaines recherches utiliseront tsvector + ts_rank_cd + unaccent.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Erreur lors de la configuration :', err);
  process.exit(1);
});
