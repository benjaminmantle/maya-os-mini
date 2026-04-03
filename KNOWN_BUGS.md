# Known Bugs — Deferred

## Pre-Supabase (fix before connecting real backend)

### _allPages never populated in Supabase mode
- **File:** `src/vault/store/vaultStore.js` — `loadPages()`
- **Problem:** In Supabase mode, `loadPages()` sets `C.pages[spaceId] = data` but never touches `C._allPages`. Breaks breadcrumbs, auto-select first page, and any code reading `_allPages`.
- **Fix:** After `C.pages[spaceId] = data`, add: `C._allPages = Object.values(C.pages).flat();`

### getRelations() returns inconsistent types
- **File:** `src/vault/store/vaultStore.js`
- **Problem:** Local mode returns `Array` (sync), Supabase mode returns `Promise<Array>`. Callers treating return as plain array will break on Supabase.
- **Fix:** Make both branches async, or enforce `getRelationsSync()` everywhere.

## Acceptable Limitations

### frogsCompleted stat undercounts after task deletion
- **File:** `src/components/stats/StatsView.jsx`
- **Problem:** If a completed frog task is later deleted, `tasks.find()` returns undefined and the completion isn't counted. Stat silently shrinks.
- **Note:** No clean fix without schema change (would need to snapshot frog status into a separate ledger).

## Nice-to-Have

### No error boundary in main.jsx
- Uncaught render error = white screen. A React error boundary would show fallback UI.

### scoreDay() not memoized in StatsView
- Called many times per render (heatmap, bar chart, radar, trends, rhythm). Lightweight but could be memoized if StatsView grows.

### searchIndex never auto-built
- `buildSearchIndex()` exists in vaultStore but is never called from `initVault()`. CommandPalette builds its own search from `C.pages` directly. The cached index is unused.

### Inline style objects in DayView render body
- `iStyle`, `lStyle`, `btnBase` are object literals recreated every render. Could be constants or CSS module classes. No functional impact.
