# Performance

All numbers below are measured, not estimated. Device figures come from an iPhone 16 Pro
running the app in **Expo Go** (development bundle: unminified JS, dev-mode React, Expo Go's
own overhead), captured 2026-09-19 with Expo's performance monitor and the app's built-in
perf marks (Settings → Performance in dev builds). A release build will be faster and lighter
on every axis.

## Targets vs measured

| Target | Measured | Status |
|---|---|---|
| Initial load to interactive with cached data < 3 s | **284 ms** from JS start to first breed row (`startup.firstRow`) | ✅ |
| 60 fps scroll through all 283 breeds | UI **60 fps**, JS **56–60 fps** | ✅ |
| Memory < 150 MB | Hermes JS heap **31–39 MB**; Expo Go process RSS 322–478 MB (see note) | ✅ for the app's own heap; process figure is Expo Go |
| Search / filter interaction stays smooth | UI/JS **60 fps** during typing and chip toggles; list re-query 18–55 ms | ✅ |

**Memory note.** Expo's monitor reports RAM for the whole Expo Go process, which hosts the
Expo Go shell, its dev tooling, the performance monitor overlay and every native module in
the Go runtime, not just this app. The figure that isolates this app's data and UI is the
Hermes heap: 31–39 MB with all 283 breeds, 7,062 image rows and the list mounted. A
standalone release build was not produced for this submission (no EAS account configured),
so a process-level number for the app alone is not available; it would need a development
or release build to measure.

## Bundle size

`npx expo export --platform ios --platform android` (production, Hermes bytecode):

| Output | Size |
|---|---|
| iOS JS bundle (`.hbc`) | **3.52 MB** |
| Android JS bundle (`.hbc`) | **3.80 MB** |
| Assets (53 files) | 5.0 MB |
| Export total | 12 MB |

The assets are dominated by `@expo/vector-icons` font files (every font family ships with
the package even though only Ionicons is used; MaterialIcons alone is 357 KB) and the
template's icon/splash images. Trimming the unused icon fonts is the obvious next cut if
download size matters; the JS bundle itself is small for an app with Drizzle, React Query,
FlashList and expo-image.

## Startup

`startup.firstRow` measures from JS start (module load of `src/utils/perf.ts`) to the first
render that contains breed rows, with 283 breeds already cached:

| Run | ms |
|---|---|
| Cold reload 1 | 266 |
| Cold reload 2 | 284 |

That includes running Drizzle migrations, hydrating the sync store from `sync_meta`, the
first `listBreedRows` query, section building and the first FlashList layout. In Expo Go the
visible wall-clock start is dominated by downloading the dev bundle from Metro over Wi-Fi
(~3–4 s), which does not exist in a release build.

## Scroll

Expo performance monitor while scrolling continuously through the full grouped list of 283
breeds (with a trait filter active in one run):

| Metric | Observed |
|---|---|
| UI thread | 58–60 fps, steady 60 once scrolling |
| JS thread | 56–60 fps |
| Layout time | 0.0–0.1 ms |
| Hermes heap | 31–39 MB |

![Performance monitor while scrolling the full list](screenshots/07-profiler-scroll.png)

No dropped-frame streaks were visible on either graph across the whole list.

## Search and filter interactions

| Interaction | List re-query (`list.query`) | Frame rate |
|---|---|---|
| Typing "terrier" (debounced 300 ms) | 18–27 ms | UI 60 / JS 60 |
| Toggling one size chip | 20–40 ms | UI 60 / JS 60 |
| Two chips toggled within 250 ms | 55 ms (two queries back to back) | UI 60 / JS 60 |

`list.query` is the full `listBreedRows` call: SQLite query with group and thumb joins, row
mapping, and section building. It runs on the JS thread once per filter change or sync
completion, never per frame, so a 20–55 ms query is a one-off cost per interaction, well
inside what the 300 ms search debounce and a chip tap can absorb without a visible hitch.

## Node benchmark (better-sqlite3, real migrations, 283-breed fixture)

`npm test -- perf.bench` prints these; they bound the data layer independent of device:

| Operation | Median |
|---|---|
| Normalize 283 breeds | 4 ms |
| First full sync write (283 breeds + 7,062 image rows, one transaction) | ~900 ms |
| Re-upsert of the same data | ~375 ms |
| `listBreedRows` all 283 (group + thumb joins) | 2 ms |
| `listBreedRows` search "terrier" | 1 ms |
| `listBreedRows` size + hypoallergenic filter | 1 ms |
| `getBreedDetail` (breed + 27 image rows) | 1 ms |

On device the list query is ~10× the Node number (Hermes + expo-sqlite bridge), which is why
the app queries once per interaction rather than keeping a second in-memory copy in sync.
The full sync on device (`sync.total`, 6 page fetches + write + thumb prefetch) measured
8.9 s over Wi-Fi and runs in the background behind the banner.

## What makes the list fast

- **Payload per row, not row count, is the risk.** Each breed has ~40 fields, JSON arrays and
  up to 27 image rows. The list query selects only the breed columns plus one joined group
  name and one joined thumb; images and sources are never loaded for the list.
- **Fixed, measured item sizes.** Rows are 88 pt (64 pt thumb + padding) and section headers
  36 pt, measured from a rendered row and fixed in the stylesheet. FlashList v2 (SDK 57)
  removed `estimatedItemSize` and measures items itself; deterministic heights are what keep
  its layout stable. `getItemType` keeps headers and rows in separate recycling pools.
- **One flat recycler.** Sections are a flat array with `stickyHeaderIndices`, not a nested
  SectionList. The list remounts on filter change so a new data set never inherits a stale
  layout, and FlashList v2's `maintainVisibleContentPosition` (on by default) is disabled:
  with sticky headers it tried to keep the previous first item in place when the data set
  was replaced, which left a blank gap under the header until the user scrolled.
- **Memoized rows, stable callbacks, small row content.** A row is a thumb, two text lines, a
  size badge and three trait badges; `BreedRow` is `memo`ized with a stable `onPress`.
- **Filtering in SQLite.** Search (name and other names), group, size band, coat length,
  hypoallergenic and trait thresholds are `WHERE` clauses on indexed columns.
- **Images.** `expo-image` with `cachePolicy="memory-disk"` and `recyclingKey`; thumbs are on
  disk after the first sync so the list renders from local files offline. Medium/large are
  fetched only when a gallery opens, under a 100 MB LRU cap.
- **Sync off the render path.** Six pages fetched in parallel after page 1; upserts in one
  transaction in chunks of 50 breeds / 200 image rows.
