# Known Bugs — Deferred

Bugs identified during audit (2026-03-18) that are not being fixed now.

## Pre-Supabase (fix before connecting real backend)

### _allPages never populated in Supabase mode
- **File:** `src/vault/store/vaultStore.js` — `loadPages()` lines 154-165
- **Problem:** In Supabase mode, `loadPages()` sets `C.pages[spaceId] = data` but never touches `C._allPages`. It stays empty forever. Breaks breadcrumbs (`getAllPages()`), auto-select first page in VaultApp, and any code reading `_allPages`.
- **Fix:** After `C.pages[spaceId] = data`, add: `C._allPages = Object.values(C.pages).flat();`

### getRelations() returns inconsistent types
- **File:** `src/vault/store/vaultStore.js` lines 615-627
- **Problem:** Local mode returns `Array` (sync), Supabase mode returns `Promise<Array>`. Any caller treating the return as a plain array will break when Supabase is connected.
- **Fix:** Make both branches async (`return Promise.resolve(array)` in local mode), or enforce `getRelationsSync()` everywhere and rename the async version.

## Acceptable Limitations (no clean fix)

### frogsCompleted stat undercounts after task deletion
- **File:** `src/components/stats/StatsView.jsx` lines 54-58
- **Problem:** `cIds` accumulates all-time completed task IDs. If a completed frog task is later deleted, `tasks.find()` returns undefined and the completion isn't counted. Stat silently shrinks over time.
- **Note:** No clean fix without a schema change (would need to snapshot frog status into cIds or a separate ledger).

## Nice-to-Have (not bugs, improvements)

### No error boundary in main.jsx
- Any uncaught render error = full white screen. A React error boundary would show a fallback UI.

### scoreDay() not memoized in StatsView
- Called many times per render (heatmap, bar chart, radar, trends, weekly rhythm). All lightweight but could be memoized if StatsView grows.

### searchIndex never auto-built
- `buildSearchIndex()` exists in vaultStore but is never called from `initVault()`. CommandPalette builds its own search from `C.pages` directly, so it works. The cached index is unused.

### setCellValue has no type validation
- A number column can accept "not-a-number" without complaint. Relies on CellEditor UI being correct. Low risk since CellEditor is the only caller.

### Duplicated drag indicator logic
- `BacklogPanel.jsx` and `MayaPanel.jsx` have ~60 lines each of near-identical drag indicator code. Could be extracted to a shared `useDragIndicator()` hook.

### Inline style objects in DayView render body
- `iStyle`, `lStyle`, `btnBase` (lines 420-422) are object literals recreated every render. Could be constants or CSS module classes. No functional impact.
