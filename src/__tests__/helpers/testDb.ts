import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import type { AppDb } from '@/db/client';
import * as schema from '@/db/schema';

/** In-memory SQLite with the real checked-in migrations applied. */
export function createTestDb(): AppDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', '..', 'db', 'migrations') });
  return db as unknown as AppDb;
}
