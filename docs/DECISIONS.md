# Decisions

Each entry records a choice, the alternatives considered, and why this one was taken.

## 1. Zustand for UI state, React Query for server state

**The split.** Two different kinds of state live in this app. *Server state* is data that
exists elsewhere and can go stale: the breed catalogue. *UI state* is what the user is doing
right now: the search text, which filters are on, whether a sync is running. They change for
different reasons, at different rates, and need different guarantees.

React Query owns the server side because it already solves the hard parts of talking to an
API: request de-duplication, cancellation via `AbortSignal`, and an explicit retry/back-off
policy (3 retries, 1 s → 2 s → 4 s, no retry on 4xx). What it does **not** do here is act as
the source of truth for rendering. Every successful fetch is written to SQLite before the UI
sees it, so React Query's memory cache can be empty (cold start, offline) and the app still
works. This is the difference between "React Query with `networkMode: offlineFirst`" and a
real offline-first app: the former still renders from a volatile cache.

Zustand owns the UI side because it is tiny, synchronous, and readable outside React.
`searchQuery` and `activeFilters` live in one store so the list, the badge count, "clear all"
and the filter sheet all derive from the same value, and the selection survives navigating to
a detail screen and back. The sync store mirrors `sync_meta` plus `isOnline`/`isSyncing`, so
the banner and Settings never query the database on every render. Alternatives considered:
React context (re-renders every consumer on any change), Redux Toolkit (more ceremony than
five fields warrant), and keeping filters in React Query (wrong tool: nothing is fetched).

## 2. Drizzle + expo-sqlite for persistence, and the schema shape

AsyncStorage/MMKV would have stored the JSON blob and forced every search and filter to run
in JavaScript over 283 nested objects. SQLite gives indexed queries, one transaction per sync,
and relational integrity between breeds, groups and images. expo-sqlite is the maintained
Expo binding; Drizzle adds a typed query builder and generated, checked-in migrations without
a runtime schema cost. WatermelonDB was rejected as too heavy for a single-user read-mostly
cache; raw SQL strings were rejected because the schema is 60+ columns and types matter.

**Schema.** `groups(id, name)` is the API's group list. `breeds` is one wide row per breed
holding everything the Overview and Traits tabs need (ranges as min/max columns, the 11 trait
scores as integer columns, list-shaped fields such as temperament and kennel clubs as JSON
text) plus the derived `size_band` and a `group_id` foreign key; indexed on name, size band and
group. `breed_images` is one row per *image × variant* (`thumb`/`medium`/`large`), keyed
`imageId:variant`, carrying the attribution and the cache bookkeeping columns
(`cached_locally`, `local_uri`, `byte_size`, `last_accessed_at`). Splitting variants into rows
lets the cache track each file independently. `sync_meta` is a keyed table (one row for the
breeds sync) recording last attempt, last successful write, status, error and counts.

## 3. Offline sync strategy

- **Upsert, never replace.** `runSync` writes breeds, groups and images with
  `INSERT … ON CONFLICT DO UPDATE` in a single transaction. Breeds absent from the response
  are deleted only when *every* page arrived; a partial fetch writes what came back and marks
  the run `partial`. A total failure touches nothing. Cache bookkeeping columns on images
  survive upserts. The integration tests cover all three cases against a real database.
- **NetInfo-triggered resync.** `useOfflineSync` subscribes to NetInfo. On the first reading
  it syncs if the cache is older than an hour; on an offline→online transition it syncs again
  in the background. React Query's `onlineManager` is also wired to NetInfo so paused queries
  resume. A module-level in-flight promise de-duplicates concurrent triggers (launch,
  reconnect, pull-to-refresh, "Sync now").
- **`sync_meta` tracking.** Every attempt writes `last_attempt_at`; only success/partial
  writes advance `last_synced_at`, so "last synced X ago" always points at real data. The
  Zustand sync store is hydrated from this row on launch and updated after each run; the
  banner derives its five states (syncing, offline with data, offline without data, failed,
  partial) from it.

## 4. Size-band thresholds

`deriveSizeBand` uses the heavier of male/female max weight in kg, with max height as a
fallback. Inclusive upper bounds: **small ≤ 10 kg, medium ≤ 25 kg, large ≤ 45 kg, giant above**.
Weight was chosen over height because it is populated for all 283 breeds (four lack height),
and it is what owners plan around. The cuts sit on the dataset's quartiles (p25 = 12, p50 = 25,
p90 = 52 kg) and match common kennel-club style groupings, so every band is usable as a
filter: small 59, medium 92, large 94, giant 38 breeds. Height fallback cuts are 35/50/65 cm.

## 5. Image caching strategy

- **Eager thumbs.** After each sync, the position-0 thumb of every breed is downloaded
  (concurrency 4, best effort, already-cached files skipped). Thumbs are ~25 KB, so the whole
  list costs ~8 MB and works offline from first sync.
- **Lazy medium/large.** Full-size photos are downloaded only when the Gallery tab mounts
  (medium) or a photo is opened full screen (large). The detail header reuses the cached thumb
  so opening a detail never needs the network.
- **Cap and eviction.** One 100 MB cap. Eviction is least-recently-used by `last_accessed_at`,
  evicting medium/large before thumbs so the list stays offline-friendly. The index is the
  `breed_images` table, so eviction is one SQL query rather than a directory scan; a missing
  file (OS cleared the cache directory) is detected on read and the row is corrected. The
  policy is a pure module with injected filesystem and index, and is unit-tested.

## 6. Performance trade-off: payload per row, not row count

283 rows is not a large list; FlashList or even FlatList handles that count easily. The risk
is the *shape* of each breed: ~40 scalar fields, JSON arrays (temperament, colors, clubs,
sources) and up to 27 image rows. If each list row received the whole breed and rendered
several of those fields, the cost per recycled row, not the number of rows, would decide
scroll performance.

Three choices address that specifically:

1. **The row query is narrow.** `listBreedRows` selects the breed columns plus one joined
   group name and one joined thumb row; images and sources are never loaded for the list.
   Filtering (search, group, size, coat, hypoallergenic, trait thresholds) runs in SQLite on
   indexed columns, so JavaScript never scans 283 objects.
2. **Row content is fixed and cheap.** A row is a 64 pt thumb, two text lines, a size badge
   and three trait badges (energy, good with children, shedding). No nested lists, no image
   decoding beyond the thumb, no per-row hooks that query. `BreedRow` is memoized with a stable
   `onPress`, so recycling re-renders only the row being reused.
3. **Item sizing is deterministic.** FlashList v2 (SDK 57's version) removed
   `estimatedItemSize` and measures items itself, so the equivalent lever is giving it items
   that never change height: rows are a fixed 88 pt and section headers 36 pt, measured from a
   rendered row and set in the stylesheet, and `getItemType` separates the two so the recycler
   never reuses a header for a row. Sections are a flat array with `stickyHeaderIndices`, not
   a nested SectionList, so one recycler handles everything.

Measured result on device: 60 fps UI / 56–60 fps JS scrolling the full grouped list in a
development bundle, with a 2 ms list query (see PERFORMANCE.md).

## 7. Smaller decisions

- **Routes in root `app/`, logic in `src/`.** The SDK 57 template puts routes in `src/app/`;
  they were moved to match the required layout and keep route files as thin re-exports.
- **Detail tabs are nested routes.** Overview/Traits/Gallery are `expo-router/ui` headless
  tabs under `app/breed/[id]/`, so `/breed/:id/gallery` deep-links and back navigation follow
  the app's routing model. Gotcha: `TabList` must be a direct child of `Tabs`.
- **Screens read SQLite directly.** Screens call repository functions synchronously and
  re-query when the sync store changes; reads are ~2 ms on device, cheaper than keeping a
  second in-memory copy in sync.
- **Component tests run against the stores.** RNTL tests mock the native DB and sync hook and
  drive screens through Zustand; the SQLite path is covered by better-sqlite3 integration
  tests, which run the checked-in migrations against a captured 283-breed fixture.
- **In-app perf marks.** A 60-line recorder times sync, list queries and time-to-first-row and
  lists them on the Settings screen in dev builds, so on-device numbers can be read without a
  profiler attached.
