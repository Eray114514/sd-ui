import { createClient } from '@libsql/client';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^file:/, '')
  : path.join(__dirname, '..', 'prisma', 'dev.db');

const databaseUrl = `file:${dbPath}`;

async function main() {
  const client = createClient({
    url: databaseUrl,
  });

  try {
    const taskTableResult = await client.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='Task';
    `);
    const taskExists = taskTableResult.rows.length > 0;

    if (!taskExists) {
      console.log('[Auto-Resolve] Task table does not exist. Skipping 0_init resolve.');
      return;
    }

    const migrationsTableResult = await client.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations';
    `);
    const migrationsTableExists = migrationsTableResult.rows.length > 0;

    let initApplied = false;

    if (migrationsTableExists) {
      const initResult = await client.execute(`
        SELECT migration_name FROM _prisma_migrations WHERE migration_name='0_init';
      `);
      initApplied = initResult.rows.length > 0;
    }

    if (!initApplied) {
      console.log('[Auto-Resolve] Existing database detected but 0_init not applied. Resolving...');
      execSync('npx prisma migrate resolve --applied 0_init', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('[Auto-Resolve] Successfully marked 0_init as applied.');
    } else {
      console.log('[Auto-Resolve] 0_init already applied. No action needed.');
    }
  } catch (error) {
    console.error('[Auto-Resolve] Error checking/resolving migrations:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
