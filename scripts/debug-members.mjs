import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load env
const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0 && !line.startsWith('#')) {
    process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}

const { Pool } = require('./node_modules/pg/lib/index.js');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const res = await pool.query('SELECT "userId", "workspaceId", "role" FROM "WorkspaceMember" LIMIT 10');
console.log(JSON.stringify(res.rows, null, 2));

const ws = await pool.query('SELECT id, "ownerUserId", name FROM "Workspace" LIMIT 5');
console.log('Workspaces:', JSON.stringify(ws.rows, null, 2));

await pool.end();
