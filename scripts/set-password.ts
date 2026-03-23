/**
 * Définit le mot de passe d'un utilisateur en base.
 * Usage : npx tsx --env-file=.env.local scripts/set-password.ts <email> <password>
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const [,, email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/set-password.ts <email> <password>');
  process.exit(1);
}

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { email },
    data:  { passwordHash: hash },
    select: { id: true, email: true },
  });
  console.log(`✅ Mot de passe défini pour ${user.email} (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
