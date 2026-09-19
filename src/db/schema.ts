import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { CoatLength, ImageVariant, SizeBand, SyncStatus } from '@/types/breed';

// ---------------------------------------------------------------------------
// groups — from /api/v2/groups (9 rows)
// ---------------------------------------------------------------------------
export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

// ---------------------------------------------------------------------------
// breeds — everything the Overview and Traits tabs need, one row per breed
// ---------------------------------------------------------------------------
export const breeds = sqliteTable(
  'breeds',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    otherNames: text('other_names', { mode: 'json' }).$type<string[]>().notNull().default([]),
    description: text('description'),

    lifeMin: integer('life_min'),
    lifeMax: integer('life_max'),

    // kg
    maleWeightMin: real('male_weight_min'),
    maleWeightMax: real('male_weight_max'),
    femaleWeightMin: real('female_weight_min'),
    femaleWeightMax: real('female_weight_max'),
    // cm
    maleHeightMin: real('male_height_min'),
    maleHeightMax: real('male_height_max'),
    femaleHeightMin: real('female_height_min'),
    femaleHeightMax: real('female_height_max'),

    originEra: text('origin_era'),
    originRegion: text('origin_region'),
    originCountry: text('origin_country'),

    hypoallergenic: integer('hypoallergenic', { mode: 'boolean' }).notNull().default(false),
    coatLength: text('coat_length').$type<CoatLength>(),
    coatType: text('coat_type'),
    coatColors: text('coat_colors', { mode: 'json' }).$type<string[]>().notNull().default([]),

    // Derived — see src/utils/sizeBand.ts. Null only if the API gave no weight or height.
    sizeBand: text('size_band').$type<SizeBand>(),

    // The 11 numeric trait scores (1–5, except exercise_minutes = minutes/day).
    // Nullable: one breed in the dataset ships with no traits at all.
    energy: integer('energy'),
    barking: integer('barking'),
    drooling: integer('drooling'),
    grooming: integer('grooming'),
    shedding: integer('shedding'),
    trainability: integer('trainability'),
    goodWithDogs: integer('good_with_dogs'),
    goodWithChildren: integer('good_with_children'),
    goodWithStrangers: integer('good_with_strangers'),
    apartmentFriendly: integer('apartment_friendly'),
    exerciseMinutes: integer('exercise_minutes'),

    temperament: text('temperament', { mode: 'json' }).$type<string[]>().notNull().default([]),
    recognizedBy: text('recognized_by', { mode: 'json' }).$type<string[]>().notNull().default([]),
    sources: text('sources', { mode: 'json' })
      .$type<{ url: string; title: string }[]>()
      .notNull()
      .default([]),

    groupId: text('group_id').references(() => groups.id, { onDelete: 'set null' }),

    // ms since epoch, when this row was last written from the API
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('breeds_name_idx').on(t.name),
    index('breeds_size_band_idx').on(t.sizeBand),
    index('breeds_group_id_idx').on(t.groupId),
  ],
);

// ---------------------------------------------------------------------------
// breed_images — one row per (API image × variant). The API exposes thumb,
// medium and large URLs for every image; storing a row per variant lets the
// cache track each file independently (thumb eager, medium/large lazy).
// ---------------------------------------------------------------------------
export const breedImages = sqliteTable(
  'breed_images',
  {
    /** `${imageId}:${variant}` */
    id: text('id').primaryKey(),
    imageId: text('image_id').notNull(),
    breedId: text('breed_id')
      .notNull()
      .references(() => breeds.id, { onDelete: 'cascade' }),
    variant: text('variant').$type<ImageVariant>().notNull(),
    /** order within the breed's gallery; 0 = primary image */
    position: integer('position').notNull().default(0),
    url: text('url').notNull(),

    author: text('author'),
    license: text('license'),
    licenseUrl: text('license_url'),
    source: text('source'),
    sourceUrl: text('source_url'),

    cachedLocally: integer('cached_locally', { mode: 'boolean' }).notNull().default(false),
    localUri: text('local_uri'),
    byteSize: integer('byte_size'),
    /** ms since epoch; drives LRU eviction */
    lastAccessedAt: integer('last_accessed_at'),
  },
  (t) => [
    index('breed_images_breed_id_idx').on(t.breedId),
    index('breed_images_breed_variant_idx').on(t.breedId, t.variant, t.position),
    index('breed_images_cache_idx').on(t.cachedLocally, t.lastAccessedAt),
  ],
);

// ---------------------------------------------------------------------------
// sync_meta — keyed; the breeds sync uses key = 'breeds'
// ---------------------------------------------------------------------------
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  /** last attempt of any outcome */
  lastAttemptAt: integer('last_attempt_at'),
  /** last time data was written (success or partial) */
  lastSyncedAt: integer('last_synced_at'),
  lastSyncStatus: text('last_sync_status').$type<SyncStatus>(),
  lastError: text('last_error'),
  breedCount: integer('breed_count').notNull().default(0),
  imageCount: integer('image_count').notNull().default(0),
  parseFailureCount: integer('parse_failure_count').notNull().default(0),
});

export type Group = typeof groups.$inferSelect;
export type GroupInsert = typeof groups.$inferInsert;
export type Breed = typeof breeds.$inferSelect;
export type BreedInsert = typeof breeds.$inferInsert;
export type BreedImage = typeof breedImages.$inferSelect;
export type BreedImageInsert = typeof breedImages.$inferInsert;
export type SyncMeta = typeof syncMeta.$inferSelect;
