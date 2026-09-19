# Accessibility

What was done, how it was tested, what works, and what does not. Tested 2026-09-19.

## How it was tested

**Android, TalkBack, Pixel 7 API 35 emulator (Expo Go 57.0.9).** Two complementary
methods, because TalkBack does not log what it speaks and its speech cannot be captured from
a script:

1. **Accessibility node tree.** `adb shell uiautomator dump` exports the exact tree an
   accessibility service receives: content descriptions, roles (widget class), selected and
   checked state, traversal order, and on-screen bounds. Every screen was dumped and read
   node by node, before and after the changes below. This is the strongest evidence here:
   TalkBack composes its speech from precisely these fields.
2. **TalkBack running.** TalkBack was enabled on the emulator (touch exploration on), and
   its focus ring was observed moving through elements with the swipe-right "next item"
   gesture. This confirms the elements are focusable in the expected order; it does not
   let me transcribe the spoken output.

**Tap targets** were audited from the same dumps: every clickable node's bounds were checked
against 48 dp (126 px at 420 dpi). Reported below.

**iOS, VoiceOver, iPhone 16 Pro (Expo Go).** Walked through by ear on the device, swiping
element by element: sync banner, search field, size chip (including the "selected" state
after activation), section header, breed row, the three detail tabs, the trait gauges and
the gallery photo with its attribution link. Everything was read correctly and in visual
order, with no element split into fragments and no score spoken twice. This covers the
iOS-specific pieces (`accessibilityRole="tab"`, the banner's
`AccessibilityInfo.announceForAccessibility`, `accessibilityElementsHidden` on decorative
icons) that the Android node tree cannot exercise.

## What a screen reader gets, per element

| Element | Announced as (from the node tree) | Role / state |
|---|---|---|
| List row | "Affenpinscher. Small size. Toy Group. lives 14 to 16 years. Energy 3 of 5, Good with children 3 of 5, Shedding 2 of 5. hypoallergenic" + hint "Opens breed details" | button; trait badges and chevron hidden, so one stop per breed |
| Section header | "Toy Group, 2 breeds" | header |
| Result count | "283 breeds in 9 groups" | text, polite live region (re-announces on filter change) |
| Search input | "Search breeds" + hint "Filters the list by breed name as you type"; clear button "Clear search" | edit text |
| Sync banner | "Last synced 5 min ago. Tap to sync now" / "Offline — showing cached data (synced …)" / "Syncing breeds…" | button; live region on Android, explicit announcement on iOS, keyed on status so the clock tick does not re-announce |
| Filter button | "Filters, 2 active" + hint "Opens group, size, coat and trait filters" | button |
| Size chips (bar and sheet) | "Small size", selected/not, hint "Filters the list by size" | button + selected |
| Group / coat / trait chips | "Toy Group", "Long coat", "Energy trait" (+ hint stating what it does, e.g. "Only show breeds scoring at least 4 out of 5") | button + selected |
| Minimum-score chips | "Minimum score 5" + hint "Applies to every selected trait" | button + selected |
| Hypoallergenic | "Hypoallergenic only" | switch + checked |
| Sheet header buttons | "Clear all filters" (disabled state when none), "Close filters" | button |
| Sheet section titles | "GROUP", "SIZE", … | header |
| Bottom tab bar | "Breeds", "Settings" (was ", Breeds": the icon glyph leaked into the label) | tab + selected |
| Detail tab bar | "Overview, tab 1 of 3" / "Traits, tab 2 of 3" / "Gallery, tab 3 of 3", hint "Shows the traits tab" | tablist › tab + selected |
| Detail hero | "Photo of Affenpinscher" | image |
| Overview facts | "Group: Toy Group", "Life span: 12–15 years", … | one grouped element per row (was two separate stops) |
| Trait gauge | "Energy, 4 out of 5, from calm to very active"; "Daily exercise, 30 minutes per day"; "Energy, no data, …" when missing | progressbar |
| Temperament | each tag as its own chip | button-less chip (static) |
| Gallery page | "Photo by Kobikleekai, opens full screen" | image button |
| Gallery attribution | "© Kobikleekai · CC BY-SA 4.0 · wikimedia commons. Opens the source page" | link |
| Gallery position | "Showing photo 1 of 9" | text, polite live region; the visual "1 / 9" counter is hidden to avoid a duplicate |
| Full-screen viewer | "Breed photo by Kobikleekai"; "Close" | image; button |
| Settings | each fact "Breeds: 283"; "Sync now" (disabled + busy states); "Clear image cache" | buttons |

Reading order matches the visual order on every screen: title → search → banner → filters →
count → sections/rows on the list; back → hero → name → badge → subtitle → tabs → tab content
on the detail.

## Tap targets

After the changes, every clickable node on the list, filter sheet, detail (Overview, Traits,
Gallery) and Settings screens measures at least 48 dp on both axes in the Android tree,
which also satisfies the 44 pt iOS minimum:

- Chips: 48 pt tall (were 32).
- Detail tabs: 48 pt (were 32). Bottom tabs use the platform default.
- Search input: 48 pt; the input now fills its container so its own bounds are 48 pt (the
  field was 22 dp tall inside a 44 pt container).
- Sync banner: 48 pt minimum.
- Sheet "Clear all" / "Close": 48 × 48 pt.
- Gallery attribution link: 48 pt.
- List rows 88 pt; viewer close button 28 pt icon + 12 pt slop = 52 pt.

The audit script flagged trait chips at the bottom of the filter sheet with heights of 75 px
or negative values. Those are the chips clipped by the sheet's scroll edge; the same `Chip`
component measures 48 dp everywhere it is fully on screen.

## Fixed during testing

These were found in the node tree, not by reading code:

- Bottom tab labels contained the icon font glyph (", Breeds"). Fixed with
  `tabBarAccessibilityLabel`.
- Row labels used "·" and an en dash ("Toy Group · 14–16 years"), which screen readers skip
  or read as symbols, and omitted "hypoallergenic". Rebuilt as one sentence per fact with
  "to" for ranges.
- Trait gauges were announced with the score twice on Android ("…4 out of 5, …, 4 out of 5")
  because Android appends `accessibilityValue.text` to the label. The value prop was removed;
  the label carries the score.
- Decorative Ionicons (search, banner status, filter, chevron, trait badges) were exposed as
  private-use-area text nodes. All are now hidden from assistive tech.
- Overview facts were two stops per row (label, then value). Each row is now one element.
- Gallery page and its indicator shared the label "Photo 1 of 9". The indicator now says
  "Showing photo 1 of 9".
- "1 breeds" pluralisation in section headers.
- The banner's iOS announcement effect was initially placed after an early return
  (conditional hook); moved above it.

## Known gaps

- **Sticky section headers appear twice in the tree.** FlashList renders a second copy of
  the current group header to pin it, and both copies are focusable, so a screen reader user
  swiping through the list hears "Foundation Stock Service, 72 breeds" twice at the top of
  each group. Not fixed: FlashList gives no hook to mark the pinned copy as decorative.
- **Header role on Android not verified.** React Native maps `accessibilityRole="header"` to
  Android's heading flag, which `uiautomator dump` does not expose, so heading navigation
  (TalkBack "headings" granularity) is implemented but unconfirmed.
- **Spoken output not transcribed.** TalkBack's actual utterances were not captured (no
  logging hook without changing TalkBack's own developer settings). Verification is of the
  tree TalkBack reads plus its focus behaviour.
- **Live-region timing not verified by ear.** The result count, banner and gallery position
  are polite live regions; that they re-announce at the right moment, and not too often, is
  unverified.
- **Filter sheet modal focus.** The sheet is a React Native `Modal`; on Android it is a
  separate window and TalkBack should confine focus to it, but this was not exercised.
- **Expo Go's floating "Tools" button** sits in the reading order in development builds. It
  is not part of the app and disappears in a standalone build.
- **Dynamic type** was handled earlier (font scaling with a 1.4× cap on fixed-height rows)
  but was not re-checked with a screen reader running.
