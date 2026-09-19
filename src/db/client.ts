import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DB_NAME = 'tripare.db';

/**
 * Driver-agnostic handle used by the repository and sync code, so the same
 * code runs against expo-sqlite in the app and better-sqlite3 in Node tests.
 */
export type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export const sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });
