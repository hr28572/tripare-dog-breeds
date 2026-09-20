import { and, asc, eq, getTableColumns, gte, inArray, like, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { AppDb } from './client';
import {
  breedImages,
  breeds,
  groups,
  syncMeta,
  type Breed,
  type BreedImage,
  type BreedImageInsert,
  type BreedInsert,
  type Group,
  type GroupInsert,
  type SyncMeta,
} from './schema';

import type { CoatFilter, CoatLength, ImageVariant, SizeBand, TraitKey } from '@/types/breed';

export const SYNC_KEY = 'breeds';

/** Keep well under SQLite's bound-parameter limit (breeds have 38 columns). */
const BREED_CHUNK = 50;
const IMAGE_CHUNK = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** `SET col = excluded.col` for every column except the listed ones. */
function excludedSet(table: SQLiteTable, except: string[]): Record<string, SQL> {
  const set: Record<string, SQL> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (except.includes(key)) continue;
    set[key] = sql.raw(`excluded."${column.name}"`);
  }
  return set;
}

// ---------------------------------------------------------------------------
// groups
// ---------------------------------------------------------------------------

export function upsertGroups(db: AppDb, rows: GroupInsert[]): void {
  if (rows.length === 0) return;
  db.insert(groups)
    .values(rows)
    .onConflictDoUpdate({ target: groups.id, set: excludedSet(groups, ['id']) })
    .run();
}

/** Insert placeholder rows for group ids referenced by breeds but not yet known. */
function ensureGroupsExist(db: AppDb, ids: string[]): void {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  db.insert(groups)
    .values(unique.map((id) => ({ id, name: 'Unknown group' })))
    .onConflictDoNothing()
    .run();
}

export function listGroups(db: AppDb): Group[] {
  return db.select().from(groups).orderBy(asc(groups.name)).all();
}

// ---------------------------------------------------------------------------
// breeds + images
// ---------------------------------------------------------------------------

export interface UpsertBreedsResult {
  breedCount: number;
  imageCount: number;
  /** local files for image rows that were removed and should be deleted from disk */
  orphanedLocalUris: string[];
}

export interface UpsertBreedsOptions {
  /**
   * When true (only after a COMPLETE fetch), breeds absent from `rows` are
   * deleted. Never set this on a partial fetch or cached breeds would vanish.
   */
  pruneMissing?: boolean;
  /**
   * Ids to keep when pruning; defaults to the ids in `rows`. A sync that already wrote
   * most pages incrementally passes the full id set here with only the leftover rows.
   */
  keepIds?: string[];
}

/**
 * Upsert breeds and their image rows in one transaction. Existing rows are
 * updated in place, so a partial fetch only touches the breeds it contains.
 * Cache bookkeeping columns on images (cached_locally, local_uri, ...) are
 * preserved across upserts.
 */
export function upsertBreeds(
  db: AppDb,
  rows: BreedInsert[],
  images: BreedImageInsert[],
  options: UpsertBreedsOptions = {},
): UpsertBreedsResult {
  const orphanedLocalUris: string[] = [];

  db.transaction((tx) => {
    ensureGroupsExist(
      tx,
      rows.map((r) => r.groupId).filter((id): id is string => typeof id === 'string'),
    );

    for (const part of chunk(rows, BREED_CHUNK)) {
      tx.insert(breeds)
        .values(part)
        .onConflictDoUpdate({ target: breeds.id, set: excludedSet(breeds, ['id']) })
        .run();
    }

    for (const part of chunk(images, IMAGE_CHUNK)) {
      tx.insert(breedImages)
        .values(part)
        .onConflictDoUpdate({
          target: breedImages.id,
          set: excludedSet(breedImages, ['id', 'cachedLocally', 'localUri', 'byteSize', 'lastAccessedAt']),
        })
        .run();
    }

    // Remove image rows that no longer exist for the breeds we just wrote.
    const imageIdsByBreed = new Map<string, string[]>();
    for (const img of images) {
      const list = imageIdsByBreed.get(img.breedId) ?? [];
      list.push(img.id);
      imageIdsByBreed.set(img.breedId, list);
    }
    for (const breed of rows) {
      const keep = imageIdsByBreed.get(breed.id) ?? [];
      const where =
        keep.length > 0
          ? and(eq(breedImages.breedId, breed.id), notInArray(breedImages.id, keep))
          : eq(breedImages.breedId, breed.id);
      const stale = tx.select({ localUri: breedImages.localUri }).from(breedImages).where(where).all();
      if (stale.length === 0) continue;
      for (const s of stale) if (s.localUri) orphanedLocalUris.push(s.localUri);
      tx.delete(breedImages).where(where).run();
    }

    const ids = options.keepIds ?? rows.map((r) => r.id);
    if (options.pruneMissing && ids.length > 0) {
      const gone = tx
        .select({ localUri: breedImages.localUri })
        .from(breedImages)
        .where(notInArray(breedImages.breedId, ids))
        .all();
      for (const g of gone) if (g.localUri) orphanedLocalUris.push(g.localUri);
      tx.delete(breedImages).where(notInArray(breedImages.breedId, ids)).run();
      tx.delete(breeds).where(notInArray(breeds.id, ids)).run();
    }
  });

  return {
    breedCount: countBreeds(db),
    imageCount: countImages(db),
    orphanedLocalUris,
  };
}

export function countBreeds(db: AppDb): number {
  return db.select({ n: sql<number>`count(*)` }).from(breeds).get()?.n ?? 0;
}

export function countImages(db: AppDb): number {
  return db.select({ n: sql<number>`count(*)` }).from(breedImages).get()?.n ?? 0;
}

export interface TraitThresholdFilter {
  trait: TraitKey;
  /** inclusive minimum score */
  min: number;
}

export interface ListBreedsFilter {
  /** matches name or other_names, case-insensitive */
  search?: string;
  groupIds?: string[];
  sizeBands?: SizeBand[];
  /** coat lengths, plus 'wire' which matches coat_type = 'wire' */
  coatLengths?: CoatFilter[];
  hypoallergenic?: boolean;
  /** every threshold must hold (AND) */
  traitThresholds?: TraitThresholdFilter[];
}

function breedConditions(filter: ListBreedsFilter): SQL | undefined {
  const conditions: SQL[] = [];
  const search = filter.search?.trim();
  if (search) {
    // SQLite LIKE is case-insensitive for ASCII; other_names is a JSON array stored as text.
    const pattern = `%${search.replace(/[%_]/g, '')}%`;
    conditions.push(or(like(breeds.name, pattern), like(breeds.otherNames, pattern))!);
  }
  if (filter.groupIds && filter.groupIds.length > 0) conditions.push(inArray(breeds.groupId, filter.groupIds));
  if (filter.sizeBands && filter.sizeBands.length > 0) conditions.push(inArray(breeds.sizeBand, filter.sizeBands));
  if (filter.coatLengths && filter.coatLengths.length > 0) {
    const lengths = filter.coatLengths.filter((c): c is CoatLength => c !== 'wire');
    const parts: SQL[] = [];
    if (lengths.length > 0) parts.push(inArray(breeds.coatLength, lengths));
    if (filter.coatLengths.includes('wire')) parts.push(eq(breeds.coatType, 'wire'));
    conditions.push(or(...parts)!);
  }
  if (filter.hypoallergenic !== undefined) conditions.push(eq(breeds.hypoallergenic, filter.hypoallergenic));
  for (const t of filter.traitThresholds ?? []) conditions.push(gte(breeds[t.trait], t.min));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function listBreeds(db: AppDb, filter: ListBreedsFilter = {}): Breed[] {
  return db.select().from(breeds).where(breedConditions(filter)).orderBy(asc(breeds.name)).all();
}

export interface BreedListRow extends Breed {
  groupName: string | null;
  thumbId: string | null;
  thumbUrl: string | null;
  thumbLocalUri: string | null;
  thumbCached: boolean | null;
}

/**
 * One query for the list screen: breed + group name + primary thumb (local uri
 * if cached). Ordered by group name then breed name so the screen can build
 * section headers in a single pass; breeds without a group sort last.
 */
export function listBreedRows(db: AppDb, filter: ListBreedsFilter = {}): BreedListRow[] {
  return db
    .select({
      ...getTableColumns(breeds),
      groupName: groups.name,
      thumbId: breedImages.id,
      thumbUrl: breedImages.url,
      thumbLocalUri: breedImages.localUri,
      thumbCached: breedImages.cachedLocally,
    })
    .from(breeds)
    .leftJoin(groups, eq(groups.id, breeds.groupId))
    .leftJoin(
      breedImages,
      and(eq(breedImages.breedId, breeds.id), eq(breedImages.variant, 'thumb'), eq(breedImages.position, 0)),
    )
    .where(breedConditions(filter))
    .orderBy(sql`${groups.name} IS NULL`, asc(groups.name), asc(breeds.name))
    .all();
}

export interface BreedDetail {
  breed: Breed;
  groupName: string | null;
  images: BreedImage[];
}

export function getBreedDetail(db: AppDb, id: string): BreedDetail | undefined {
  const row = db
    .select({ breed: breeds, groupName: groups.name })
    .from(breeds)
    .leftJoin(groups, eq(groups.id, breeds.groupId))
    .where(eq(breeds.id, id))
    .get();
  if (!row) return undefined;
  return { breed: row.breed, groupName: row.groupName, images: listBreedImages(db, id) };
}

export function getBreedById(db: AppDb, id: string): Breed | undefined {
  return db.select().from(breeds).where(eq(breeds.id, id)).get();
}

export function listBreedImages(db: AppDb, breedId: string, variant?: ImageVariant): BreedImage[] {
  const where = variant
    ? and(eq(breedImages.breedId, breedId), eq(breedImages.variant, variant))
    : eq(breedImages.breedId, breedId);
  return db.select().from(breedImages).where(where).orderBy(asc(breedImages.position)).all();
}

/** The position-0 thumb for every breed — what the list screen renders and what sync caches eagerly. */
export function listPrimaryThumbs(db: AppDb): BreedImage[] {
  return db
    .select()
    .from(breedImages)
    .where(and(eq(breedImages.variant, 'thumb'), eq(breedImages.position, 0)))
    .all();
}

// ---------------------------------------------------------------------------
// image cache bookkeeping (used by src/utils/imageCache.ts through an adapter)
// ---------------------------------------------------------------------------

export function getImageRow(db: AppDb, id: string): BreedImage | undefined {
  return db.select().from(breedImages).where(eq(breedImages.id, id)).get();
}

export function listCachedImages(db: AppDb): BreedImage[] {
  return db.select().from(breedImages).where(eq(breedImages.cachedLocally, true)).all();
}

export function markImageCached(db: AppDb, id: string, localUri: string, byteSize: number, now: number): void {
  db.update(breedImages)
    .set({ cachedLocally: true, localUri, byteSize, lastAccessedAt: now })
    .where(eq(breedImages.id, id))
    .run();
}

export function markImagesEvicted(db: AppDb, ids: string[]): void {
  if (ids.length === 0) return;
  for (const part of chunk(ids, 500)) {
    db.update(breedImages)
      .set({ cachedLocally: false, localUri: null, byteSize: null, lastAccessedAt: null })
      .where(inArray(breedImages.id, part))
      .run();
  }
}

export function touchImage(db: AppDb, id: string, now: number): void {
  db.update(breedImages).set({ lastAccessedAt: now }).where(eq(breedImages.id, id)).run();
}

// ---------------------------------------------------------------------------
// sync_meta
// ---------------------------------------------------------------------------

export function getSyncMeta(db: AppDb, key = SYNC_KEY): SyncMeta | undefined {
  return db.select().from(syncMeta).where(eq(syncMeta.key, key)).get();
}

export function writeSyncMeta(db: AppDb, patch: Partial<Omit<SyncMeta, 'key'>>, key = SYNC_KEY): SyncMeta {
  db.insert(syncMeta)
    .values({ key, ...patch })
    .onConflictDoUpdate({ target: syncMeta.key, set: patch })
    .run();
  return getSyncMeta(db, key)!;
}
