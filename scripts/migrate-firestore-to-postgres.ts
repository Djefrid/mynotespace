/**
 * ============================================================================
 * MIGRATION FIRESTORE → POSTGRESQL
 * ============================================================================
 *
 * Migre les données de l'utilisateur djefridbyli@gmail.com depuis Firestore
 * vers PostgreSQL de façon idempotente.
 *
 * Stratégie d'idempotence :
 *   Les IDs Firestore (strings) sont utilisés directement comme clés primaires
 *   PG. Un re-run complet ne crée pas de doublons (upsert sur l'id).
 *
 * Utilisation :
 *   npx tsx scripts/migrate-firestore-to-postgres.ts [options]
 *
 * Options :
 *   --dry-run     Affiche ce qui serait migré sans toucher PG
 *   --limit N     Limite à N notes (test sur un sous-ensemble)
 *   --verbose     Log chaque enregistrement individuel
 *
 * Exemples :
 *   npx tsx scripts/migrate-firestore-to-postgres.ts --dry-run
 *   npx tsx scripts/migrate-firestore-to-postgres.ts --limit 5 --verbose
 *   npx tsx scripts/migrate-firestore-to-postgres.ts
 *
 * Variables d'environnement requises dans .env.local :
 *   DATABASE_URL                   — connexion PostgreSQL
 *   MIGRATION_FIREBASE_SA_PATH     — chemin vers le JSON service account Firebase
 *                                    ex: ./service-account.json
 *   MIGRATION_USER_EMAIL           — email de l'utilisateur (défaut: djefridbyli@gmail.com)
 *
 * Comment obtenir le service account :
 *   Firebase Console → Project Settings → Service accounts
 *   → Generate new private key → Sauvegarder en dehors de git
 *   ⚠️  Ajouter service-account.json à .gitignore
 *
 * Collections Firestore lues (lecture seule — aucune modification) :
 *   adminFolders  → PG Folder  (isSmart=true ignorés — loggés)
 *   adminTags     → PG Tag
 *   adminNotes    → PG Note + NoteContent + NoteTag
 * ============================================================================
 */

import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';

// ── Parse des arguments CLI ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX !== -1 ? parseInt(args[LIMIT_IDX + 1], 10) : Infinity;
const USER_EMAIL = process.env.MIGRATION_USER_EMAIL ?? 'djefridbyli@gmail.com';

// ── Logger ───────────────────────────────────────────────────────────────────

const log = {
  info:    (...a: unknown[]) => console.log('[INFO]  ', ...a),
  ok:      (...a: unknown[]) => console.log('[OK]    ', ...a),
  skip:    (...a: unknown[]) => console.log('[SKIP]  ', ...a),
  warn:    (...a: unknown[]) => console.log('[WARN]  ', ...a),
  error:   (...a: unknown[]) => console.error('[ERROR] ', ...a),
  verbose: (...a: unknown[]) => { if (VERBOSE) console.log('[DEBUG] ', ...a); },
  section: (title: string) => console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`),
};

if (DRY_RUN) {
  log.warn('Mode DRY-RUN activé — aucune écriture en base PostgreSQL');
}
if (LIMIT !== Infinity) {
  log.warn(`Limite notes : ${LIMIT} (mode test)`);
}

// ── Initialisation Firebase Admin ────────────────────────────────────────────

const SA_PATH = process.env.MIGRATION_FIREBASE_SA_PATH;
if (!SA_PATH) {
  log.error('MIGRATION_FIREBASE_SA_PATH manquant dans .env.local');
  log.error('Ajoutez : MIGRATION_FIREBASE_SA_PATH=./service-account.json');
  process.exit(1);
}

const saAbsPath = path.resolve(SA_PATH);
if (!fs.existsSync(saAbsPath)) {
  log.error(`Service account introuvable : ${saAbsPath}`);
  log.error('Téléchargez-le depuis Firebase Console → Project Settings → Service accounts');
  process.exit(1);
}

import admin from 'firebase-admin';
const serviceAccount = JSON.parse(fs.readFileSync(saAbsPath, 'utf-8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const firestore = admin.firestore();

// ── Initialisation Prisma (Prisma 7 requiert l'adapter explicite) ─────────────

import { PrismaClient, NoteStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
const _adapter = new PrismaPg(_pool);
const prisma = new PrismaClient({ adapter: _adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convertit un Firestore Timestamp ou Date en Date JS. */
function toDate(val: admin.firestore.Timestamp | Date | null | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  return val.toDate();
}

// ── Compteurs ─────────────────────────────────────────────────────────────────

const counts = {
  user:        { upserted: 0 },
  workspace:   { upserted: 0 },
  folders:     { migrated: 0, skipped_smart: 0, already_exists: 0 },
  tags:        { migrated: 0, already_exists: 0 },
  notes:       { migrated: 0, already_exists: 0, skipped_limit: 0 },
  note_tags:   { migrated: 0 },
};

// ── Étape 1 : User + Workspace ────────────────────────────────────────────────

async function migrateUserAndWorkspace(): Promise<{ userId: string; workspaceId: string }> {
  log.section('Étape 1 — User & Workspace');

  let userId: string;
  let workspaceId: string;

  if (DRY_RUN) {
    log.info(`[DRY-RUN] Upsert User : email=${USER_EMAIL}`);
    log.info('[DRY-RUN] Upsert Workspace personnel');
    return { userId: 'dry-run-user-id', workspaceId: 'dry-run-workspace-id' };
  }

  // Upsert User
  const user = await prisma.user.upsert({
    where:  { email: USER_EMAIL },
    create: { email: USER_EMAIL, name: USER_EMAIL.split('@')[0] },
    update: {},
  });
  userId = user.id;
  counts.user.upserted++;
  log.ok(`User : id=${userId}  email=${user.email}`);

  // Upsert Workspace (cherche un workspace owned par cet user)
  let workspace = await prisma.workspace.findFirst({
    where: { ownerUserId: userId },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name:        'Mon espace',
        ownerUserId: userId,
      },
    });
    log.ok(`Workspace créé : id=${workspace.id}`);
  } else {
    log.ok(`Workspace existant : id=${workspace.id}`);
  }
  workspaceId = workspace.id;
  counts.workspace.upserted++;

  return { userId, workspaceId };
}

// ── Étape 2 : Folders ─────────────────────────────────────────────────────────

/**
 * Retourne la map { firestoreId → pgId } des dossiers migrés.
 * Nécessaire pour résoudre folderId sur les notes.
 */
async function migrateFolders(workspaceId: string): Promise<Map<string, string>> {
  log.section('Étape 2 — Dossiers (adminFolders)');

  const snapshot = await firestore.collection('adminFolders').get();
  log.info(`${snapshot.size} dossier(s) trouvé(s) dans Firestore`);

  // Map firestoreId → pgId (pour résoudre parentId + note.folderId)
  const idMap = new Map<string, string>();

  // Trier par parentId null en premier pour gérer la hiérarchie (parent avant enfant)
  const docs = snapshot.docs.sort((a, b) => {
    const aParent = a.data().parentId ?? '';
    const bParent = b.data().parentId ?? '';
    if (!aParent && bParent) return -1;
    if (aParent && !bParent) return 1;
    return 0;
  });

  for (const doc of docs) {
    const data = doc.data();
    const fsId  = doc.id;

    // Ignorer les dossiers intelligents
    if (data.isSmart) {
      log.skip(`Dossier intelligent ignoré : "${data.name}" (${fsId})`);
      counts.folders.skipped_smart++;
      continue;
    }

    // Résoudre le parentId PG
    const pgParentId = data.parentId ? idMap.get(data.parentId) ?? null : null;
    if (data.parentId && !pgParentId) {
      log.warn(`parentId Firestore "${data.parentId}" non résolu pour "${data.name}" — rattaché à la racine`);
    }

    if (DRY_RUN) {
      log.info(`[DRY-RUN] Folder "${data.name}" (fsId=${fsId}, parent=${pgParentId ?? 'null'})`);
      idMap.set(fsId, fsId); // Map identitaire en dry-run
      continue;
    }

    const folder = await prisma.folder.upsert({
      where:  { id: fsId },
      create: {
        id:          fsId,
        workspaceId,
        parentId:    pgParentId,
        name:        data.name ?? 'Sans nom',
        createdAt:   toDate(data.createdAt),
        updatedAt:   toDate(data.updatedAt),
      },
      update: {
        name:     data.name ?? 'Sans nom',
        parentId: pgParentId,
      },
    });

    idMap.set(fsId, folder.id);
    log.verbose(`Folder : id=${folder.id}  name="${folder.name}"`);
    counts.folders.migrated++;
  }

  log.ok(`Dossiers migrés : ${counts.folders.migrated}  |  Smart ignorés : ${counts.folders.skipped_smart}`);
  return idMap;
}

// ── Étape 3 : Tags ────────────────────────────────────────────────────────────

/**
 * Retourne la map { tagName → pgId } des tags migrés.
 */
async function migrateTags(workspaceId: string): Promise<Map<string, string>> {
  log.section('Étape 3 — Tags (adminTags)');

  const snapshot = await firestore.collection('adminTags').get();
  log.info(`${snapshot.size} tag(s) trouvé(s) dans Firestore`);

  const nameMap = new Map<string, string>();

  for (const doc of snapshot.docs) {
    const tagName = doc.id; // Le doc ID = le nom du tag

    if (DRY_RUN) {
      log.info(`[DRY-RUN] Tag "${tagName}"`);
      nameMap.set(tagName, tagName);
      continue;
    }

    const tag = await prisma.tag.upsert({
      where:  { workspaceId_name: { workspaceId, name: tagName } },
      create: {
        workspaceId,
        name:      tagName,
        createdAt: toDate(doc.data().createdAt),
      },
      update: {},
    });

    nameMap.set(tagName, tag.id);
    log.verbose(`Tag : id=${tag.id}  name="${tag.name}"`);
    counts.tags.migrated++;
  }

  log.ok(`Tags migrés : ${counts.tags.migrated}`);
  return nameMap;
}

// ── Étape 4 : Notes ───────────────────────────────────────────────────────────

async function migrateNotes(
  workspaceId: string,
  userId: string,
  folderMap: Map<string, string>,
  tagMap: Map<string, string>,
): Promise<void> {
  log.section('Étape 4 — Notes (adminNotes)');

  const snapshot = await firestore.collection('adminNotes').get();
  log.info(`${snapshot.size} note(s) trouvée(s) dans Firestore`);

  let processed = 0;

  for (const doc of snapshot.docs) {
    if (processed >= LIMIT) {
      counts.notes.skipped_limit++;
      continue;
    }

    const data   = doc.data();
    const fsId   = doc.id;
    const title  = (data.title as string | undefined) ?? '';
    const html   = (data.content as string | undefined) ?? '';
    const pinned = Boolean(data.pinned);
    const tags   = (data.tags as string[] | undefined) ?? [];
    const deletedAt = data.deletedAt ? toDate(data.deletedAt as admin.firestore.Timestamp) : null;
    const status: NoteStatus = deletedAt ? NoteStatus.TRASHED : NoteStatus.ACTIVE;

    // Résoudre le folderId
    const fsFolderId = (data.folderId as string | null) ?? null;
    const pgFolderId = fsFolderId ? (folderMap.get(fsFolderId) ?? null) : null;
    if (fsFolderId && !pgFolderId) {
      log.warn(`folderId Firestore "${fsFolderId}" non résolu pour note "${title}" — assigné à l'Inbox`);
    }

    if (DRY_RUN) {
      log.info(`[DRY-RUN] Note "${title}" (fsId=${fsId}, status=${status}, tags=${tags.join(',')})`);
      processed++;
      continue;
    }

    // Upsert Note (utilise l'ID Firestore comme PG id — idempotent)
    await prisma.note.upsert({
      where:  { id: fsId },
      create: {
        id:              fsId,
        workspaceId,
        folderId:        pgFolderId,
        title,
        status,
        isPinned:        pinned,
        updatedByUserId: userId,
        trashedAt:       deletedAt,
        createdAt:       toDate(data.createdAt as admin.firestore.Timestamp),
        updatedAt:       toDate(data.updatedAt as admin.firestore.Timestamp),
      },
      update: {
        title,
        status,
        isPinned:        pinned,
        folderId:        pgFolderId,
        updatedByUserId: userId,
        trashedAt:       deletedAt,
      },
    });

    // Upsert NoteContent
    await prisma.noteContent.upsert({
      where:  { noteId: fsId },
      create: { noteId: fsId, html },
      update: { html },
    });

    // Upsert NoteTags
    for (const tagName of tags) {
      // Crée le tag au besoin (cas où il n'était pas dans adminTags)
      let pgTagId = tagMap.get(tagName);
      if (!pgTagId) {
        const tag = await prisma.tag.upsert({
          where:  { workspaceId_name: { workspaceId, name: tagName } },
          create: { workspaceId, name: tagName },
          update: {},
        });
        pgTagId = tag.id;
        tagMap.set(tagName, pgTagId);
      }

      await prisma.noteTag.upsert({
        where:  { noteId_tagId: { noteId: fsId, tagId: pgTagId } },
        create: { noteId: fsId, tagId: pgTagId },
        update: {},
      });

      counts.note_tags.migrated++;
    }

    log.verbose(`Note migrée : id=${fsId}  title="${title}"  tags=[${tags.join(', ')}]`);
    counts.notes.migrated++;
    processed++;
  }

  log.ok(`Notes migrées : ${counts.notes.migrated}  |  Ignorées (limite) : ${counts.notes.skipped_limit}`);
  log.ok(`NoteTag liens créés : ${counts.note_tags.migrated}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION FIRESTORE → POSTGRESQL');
  console.log(`  Utilisateur cible : ${USER_EMAIL}`);
  console.log(`  Mode : ${DRY_RUN ? 'DRY-RUN (lecture seule)' : 'ÉCRITURE RÉELLE'}`);
  if (LIMIT !== Infinity) console.log(`  Limite notes : ${LIMIT}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    const { userId, workspaceId } = await migrateUserAndWorkspace();
    const folderMap = await migrateFolders(workspaceId);
    const tagMap    = await migrateTags(workspaceId);
    await migrateNotes(workspaceId, userId, folderMap, tagMap);

    log.section('Résumé final');
    console.log(`  User upserted       : ${counts.user.upserted}`);
    console.log(`  Workspace upserted  : ${counts.workspace.upserted}`);
    console.log(`  Folders migrés      : ${counts.folders.migrated}  (smart ignorés : ${counts.folders.skipped_smart})`);
    console.log(`  Tags migrés         : ${counts.tags.migrated}`);
    console.log(`  Notes migrées       : ${counts.notes.migrated}  (ignorées limite : ${counts.notes.skipped_limit})`);
    console.log(`  NoteTag liens       : ${counts.note_tags.migrated}`);
    if (DRY_RUN) {
      console.log('\n  ⚠️  DRY-RUN — rien n\'a été écrit en base.');
    } else {
      console.log('\n  ✅  Migration terminée.');
    }
  } catch (err) {
    log.error('Migration interrompue :', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
