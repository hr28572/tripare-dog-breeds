# Performance

All numbers below are measured, not estimated. Two environments were used, both on
2026-09-19:

- **Release build** (`expo prebuild` + `gradlew assembleRelease`, Hermes bytecode, no dev
  tooling) installed on a Pixel 7 API 35 Android emulator with software GL. Used for the
  process-level memory and startup numbers, because those are only meaningful for a
  standalone app.
- **Expo Go** on an iPhone 16 Pro (development bundle) with Expo's performance monitor and
  the app's built-in perf marks (Settings → Performance in dev builds). Used for frame rates
  and interaction timings.

## Targets vs measured

| Target | Measured | Status |
|---|---|---|
| Initial load to interactive with cached data < 3 s | Release build, warm start: activity displayed in **574 ms**, list with rows on screen by **~1 s** (`am start -W` + screenshots at 0.5 s intervals). Expo Go: **266–284 ms** JS start → first row | ✅ |
| 60 fps scroll through all 283 breeds | UI **60 fps**, JS **56–60 fps** (Expo Go, iPhone) | ✅ |
| Memory < 150 MB under normal use | Release build PSS: **134–141 MB** at rest, **138–160 MB (median ~150)** while flinging through the whole list; **184–226 MB** only during the one-time first-launch sync + thumbnail prefetch (see note) | ✅ at rest and browsing; marginal during continuous fast scrolling; exceeded only during the initial sync |
| Search / filter interaction stays smooth | UI/JS **60 fps** during typing and chip toggles; list re-query 18–55 ms | ✅ |

**Memory note.** `dumpsys meminfo` on the release build breaks the ~134 MB resting PSS down
as ~12 MB Java heap, ~50 MB native heap (Hermes + SQLite + decoded thumbnails), ~47 MB code
(the JS bundle and native libraries mapped in) and ~22 MB private other. While flinging
through the list the native heap grows to ~70–105 MB as expo-image's memory cache fills
with decoded thumbnails, taking PSS to a 160 MB peak, then settles back to ~140 MB. The
first launch is the exception: while the 6 API pages are parsed, 7,062 rows are inserted
and 283 thumbnails are downloaded and decoded concurrently, PSS reaches 184 MB idle and
226 MB if the user scrolls at the same time; this is a one-time event and drops once the
sync finishes. Two caveats cut both ways: the emulator uses software OpenGL, so image
surfaces that a real GPU would hold in graphics memory are counted in the native heap here;
and an emulator has no memory pressure from other apps, so expo-image never trims its cache.
The scroll peak is therefore an upper bound. Screenshot: `screenshots/08-memory-scroll.png`.
In Expo Go the Hermes heap alone was 31–39 MB; the Expo Go process figure (322–478 MB)
includes the Go shell and dev tooling and is not representative.

## Native build time

RNRepo prebuilt artifacts (see DECISIONS.md §9) cut the Android release build from
**6 min 11 s to 2 min 25 s** on this machine (warm caches, clean `android/`, app-scoped task),
by downloading prebuilt `.aar`s for screens, reanimated, worklets, gesture-handler,
safe-area-context, netinfo and masked-view instead of compiling them.

## Bundle size

`npx expo export --platform ios --platform android` (production, Hermes bytecode):

| Output | Size |
|---|---|
| iOS JS bundle (`.hbc`) | **3.52 MB** |
| Android JS bundle (`.hbc`) | **3.80 MB** |
| Assets (53 files) | 5.0 MB |
| Export total | 12 MB |
| Android release APK, universal (all 4 ABIs, no ABI splits, no resource shrinking) | 108 MB |

The universal APK is dominated by native libraries × 4 ABIs (Hermes, React Native, SQLite,
Reanimated, expo-image, Skia-free). A per-ABI split or an AAB delivered through Play would
ship roughly a quarter of that per device; that packaging is deliberately out of scope
("production deployment setup" is listed as not expected).

The assets are dominated by `@expo/vector-icons` font files (every font family ships with
the package even though only Ionicons is used; MaterialIcons alone is 357 KB) and the
template's icon/splash images. Trimming the unused icon fonts is the obvious next cut if
download size matters; the JS bundle itself is small for an app with Drizzle, React Query,
FlashList and expo-image.

## Startup

**Release build, warm start with cached data** (`adb shell am start -W`): the activity is
displayed after **574 ms**; screenshots taken every 0.5 s show the splash at 0.5 s and the
full grouped list with thumbnails at 1.0 s. First-ever launch (empty cache) displayed the
activity in 3.1 s and completed the 283-breed sync in the background behind the banner.

`startup.firstRow` (in-app mark) measures from JS start to the first render that contains
breed rows, with 283 breeds already cached, in Expo Go:

| Run | ms |
|---|---|
| Cold reload 1 | 266 |
| Cold reload 2 | 284 |

That includes running Drizzle migrations, hydrating the sync store from `sync_meta`, the
first `listBreedRows` query, section building and the first FlashList layout.

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
- **Render-ahead distance.** `drawDistance` is 800 dp instead of FlashList's default 250.
  The recycler mounts rows on the JS thread as scroll events arrive, so with under three
  rows of buffer a fast fling (especially reversing direction after scrolling to the
  bottom) outran rendering and showed white space under the pinned header until it caught
  up. 800 dp keeps roughly 12 rows mounted ahead of the scroll and 5 behind, about 18
  extra rows of cheap views, which removed the gap in emulator fling tests.
- **Memoized rows, stable callbacks, small row content.** A row is a thumb, two text lines, a
  size badge and three trait badges; `BreedRow` is `memo`ized with a stable `onPress`.
- **Filtering in SQLite.** Search (name and other names), group, size band, coat length,
  hypoallergenic and trait thresholds are `WHERE` clauses on indexed columns.
- **Images.** `expo-image` with `cachePolicy="memory-disk"` and `recyclingKey`; thumbs are on
  disk after the first sync so the list renders from local files offline. Medium/large are
  fetched only when a gallery opens, under a 100 MB LRU cap.
- **Sync off the render path.** Six pages fetched in parallel after page 1; upserts in one
  transaction in chunks of 50 breeds / 200 image rows.
