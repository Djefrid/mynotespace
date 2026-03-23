import path from 'path';
import { defineConfig } from 'prisma/config';
import { config as dotenvConfig } from 'dotenv';

// Charge .env.local (non chargé automatiquement par Prisma CLI)
dotenvConfig({ path: path.join(__dirname, '.env.local') });

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    // URL directe sans pgbouncer pour les commandes CLI (db push, migrate)
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
