# Maya OS — Handoff

## Status
**Maya OS: Phase 6 complete.** Fully functional. All docs current.
**Portal Shell: Complete.** Bubble + launcher working. Maya and Vault switch cleanly.
**Vault: Step 7 + UI polish + 5 major features + DB improvements + Showcase overhaul (4 rounds) + Timeline/Era system complete.** 8 characters with 47 columns of data. Full interactive skeleton with local/mock mode. Awaiting Supabase setup to persist data.
**CosmiCanvas: Phases 1–4 + Phase 5 complete.** Infinite canvas whiteboard with 3 render styles (sketch/clean/neon), 7 drawing tools, alignment guides, touch/pointer support, performance-optimized rendering, select/move/resize, undo/redo, context menu, color picker, groups, z-ordering, copy/paste, PNG/SVG/JSON export, keyboard help. See WHITEBOARD_SPEC.md for spec.

---

## Orientation — read these in order before anything else

1. **CLAUDE.md** — working rules, critical gotchas, app isolation rules, commands. Follow exactly.
2. **ARCHITECTURE.md** — Maya file structure, store API, patterns.
3. **VAULT_ARCHITECTURE.md** — Vault file structure, store API, patterns.
4. **WHITEBOARD_SPEC.md** — CosmiCanvas file structure, element model, render architecture, phases.
5. **SPEC.md** — Maya feature behavior reference.
6. **VAULT_SPEC.md** — Vault feature behavior reference.
7. **PORTAL_SPEC.md** — Shell/bubble spec.
8. **TODO.md** — user-managed. Do not touch without explicit direction.

**Do not start coding until the user asks you to.** Orient, then wait.

---

## How to run
```bash
cd maya-os-mini
npm run dev    # localhost:5174 (preview server uses 5174; user's own terminal uses 5173)
```
User runs this in their own terminal. Preview tools (preview_start, preview_screenshot, preview_eval) DO work on this machine — use them for visual verification and DOM measurement. Preview server configured for port 5174 in `.claude/launch.json`.

---

## What's implemented

### Maya OS (complete)
- **Day View** — date nav, score block (points/dailies bars, workout toggle, carry-forward, close/reopen day), fasting widget (auto-timer, break button), frogs section (toggleable), spotlight/focus zone, core tasks (P/T/G sort, quick-add, bump buttons, hide/show, ↩ backlog button), done section
- **Sidebar** — Day tab (dailies, food log), Tasks tab (all backlog), Proj tab (project-tagged tasks), Idea tab (notes with stars + topics)
- **Unified star system** — ALL tasks use 1–5 star rating (`mayaPts`). Single teal color for normal tasks. Project tasks get project color. Quick-add: `!1`–`!5`.
- **Projects system** — `task.project` field; project combobox in Proj tab; colors per project; Backend management. `ProjPanel.jsx`.
- **Idea system** — `priority: 'idea'` notes (not tasks); stars for subjective importance; topic categorization (combobox with create/edit/delete); textarea input; never scheduled to days; `noDrag`; dark green (`--pri-idea: #30bb70`); `IdeaPanel.jsx`
- **Carry-forward** — `↺ N` button; moves past non-done tasks (including maya+ai+idea tasks) to today; preserves isFrog status
- **Drag and drop** — all zones; group integrity enforced; sandwich recolor; day-tab drag
- **Timer** — countdown / open-ended / countup; focus vs start distinction
- **Week View** — 7-day grid, drag to reschedule, click to navigate
- **Stats View (Backend tab)** — progression cards, XP bar, workout stats, fasting stats (streak, ring chart), heatmap, bar chart, radar (6-axis hexagon), weekly rhythm, trend line, daily consistency, fasting config (eating window), export/import
- **Scoring** — 9 tiers (percentage-based), XP awards, streak multiplier, +8 XP habit bonuses (workout + fasting), idempotent close/reopen, momentum
- **Leveling** — 100 levels, 100 titles
- **Quick-add syntax** — `!1`–`!5` (stars), `@N` (pts), `Nh/Nm` (duration), `frog`
- **Export/import** — full backup + tasks-only; always additive with fresh IDs
- **6 themes** — Dark (default), Soft-Dark, Kraft, Vanilla, Lav-Light, Light

### Portal Shell (complete)
- [x] `src/Shell.jsx` — bubble + launcher, app registry, outside-click close, localStorage persist
- [x] `src/styles/components/Shell.module.css`
- [x] `src/main.jsx` updated to render `<Shell />` instead of `<App />`
- [x] Per-app wrapping: Maya gets `max-width: 1200px` centering; Vault gets full viewport

### Vault (steps 1–7 complete)
- [~] Supabase env vars in `.env.local` — placeholders; user needs to create Supabase project and fill in real values
- [ ] Supabase schema migrated (SQL from VAULT_ARCHITECTURE.md)
- [x] Full store with local/mock mode + seed data
- [x] Full layout: sidebar (resizable), page view, all section types, gallery, command palette, sort, filter
- [x] Letter grade column type, CSV import, character showcase, relationship graph
- [ ] Focus Mode
- [ ] Remaining column types (image upload, relation picker UI)

### CosmiCanvas (Phases 1–5 partial)
- [x] WHITEBOARD_SPEC.md — full spec with file structure, element model, render architecture, 5 phases
- [x] CLAUDE.md updated — app isolation rules, critical rules, gotchas, key files
- [x] Phase 1 — Canvas + camera + IndexedDB storage + board picker
- [x] Phase 2 — Drawing primitives + select tool + roughjs + undo/redo
- [x] Phase 3 — Arrows + context menu + groups + color picker + copy/paste + z-ordering
- [x] Phase 4 — Image paste, PNG/SVG/JSON export, minimap, dot grid, snap-to-grid, keyboard help, board rename
- [x] Phase 5 — Alignment guides, neon render style, pointer/touch events, performance optimizations, multi-board tabs

---

## Recent session changes

### Code review, refactoring, CosmiCanvas Phase 5 (2026-04-01)

**Maya OS code review & cleanup:**
- Fixed `TIER_LEGEND` in StatsView — was showing old 6-tier names (good/decent/half/poor), now shows 9-tier percentages (90%/80%/.../fail) matching `TIER_CLR`
- Renamed duplicate heatmap title from "Activity" to "Completion" for clarity
- Fixed `toggleWorkout()` to use `getDayRecord()` instead of duplicating init logic
- Removed unused `useCallback` import from DailiesPanel
- Removed 5 unused store getter exports (getTasks, getTasksForDate, getDailies, getProfile, getTarget, getFrogsComplete)
- Removed ~90 lines of dead CSS: priority paint tool classes (priBtn, priDot, toolSep), old spotlight classes (spotlightCard/Zone/Focused/Active/FrogFocused + all theme overrides), old workout button classes (workoutBtn/BtnOn), unused .draggable class
- Added `overflow-x: auto` to nav bar for horizontal scrolling on mobile/small screens (WEEK/BACKEND tabs now reachable at all widths)

**CosmiCanvas Phase 5 features:**
- **Alignment guides** — When dragging elements, dashed blue guide lines appear when edges/centers align with other elements. Snaps to alignment (overrides grid snap). Pure function in `snap.js`, integrated via selectTool drag handler, rendered in world space by renderer.
- **Neon render style** — Cyberpunk glow renderer using Canvas 2D `shadowBlur`. Double-pass (glow + crisp). Handles all 7 element types. Hover intensifies glow. Registered as 3rd style in StyleSwitcher.
- **Pointer events / touch support** — Replaced `onMouse*` with `onPointer*` for unified mouse/touch/pen input. Two-finger pan + pinch-to-zoom via gesture state tracking. `touch-action: none` on canvas. `setPointerCapture` for reliable tracking.

**Files changed (Maya):** `StatsView.jsx`, `DailiesPanel.jsx`, `store.js`, `DayView.module.css`, `TaskCard.module.css`, `Topbar.module.css`
**Files changed (CosmiCanvas):** `snap.js`, `selectTool.js`, `renderer.js`, `canvas.js`, `WhiteboardApp.jsx`, `WhiteboardApp.module.css`, `StyleSwitcher.jsx`, NEW `neonStyle.js`

### CosmiCanvas Performance (2026-03-31)

**Problem:** Spatial index was rebuilt every dirty frame; React re-rendered on every drag mousemove (wasted CPU on large boards).

**Fixes:**
- `whiteboardStore.js` — Added `_structVersion` counter (increments on add/delete/openBoard, NOT on position moves). Exported `getStructVersion()`, `updateElementsSilent(patches)` (mutates without notify), `syncNotify()`.
- `canvas.js` — Added `_getStructVersion` getter slot. Spatial index now only rebuilds when struct version changes (skips rebuild during drag). Board switches always rebuild (openBoard bumps version).
- `selectTool.js` — Drag mousemove now calls `ctx.updateElementsSilent()` instead of `ctx.updateElements()` — prevents React re-render on every pointer move. `onMouseUp` calls `ctx.syncNotify()` to sync React state after drag. Hover detection uses `ctx.spatialIdx.queryPoint()` (O(log n)) instead of O(n) linear scan over all elements.
- `WhiteboardApp.jsx` — Imports + forwards `updateElementsSilent`, `syncNotify`, `getStructVersion`, `spatialIdx` to tool context. Wires `structVersion` getter into canvas engine.

**Result:** During a drag of N elements on a board with M total elements: spatial index rebuild goes from M per frame → 0 per frame; React renders during drag go from M per mousemove → 0 during drag (one sync on mouseup); hover hit-test goes from O(M) → O(log M).

**Files changed:** `whiteboardStore.js`, `canvas.js`, `selectTool.js`, `WhiteboardApp.jsx`

### CosmiCanvas Multi-Board Tabs (2026-04-01)

**Feature:** Open multiple boards simultaneously as tabs. Tab bar appears at the top of the canvas.

**Store additions** (`whiteboardStore.js`):
- `S.openTabs` — array of `{ id, name }` for open board tabs
- `openBoardTab(id)` — opens board as tab (or switches to existing tab)
- `switchTab(id)` — switches active board (flushes save, loads from IDB)
- `closeBoardTab(id)` — closes tab, switches to adjacent; last tab → board picker
- `getOpenTabs()` — returns tab list
- `closeBoard()` now clears `openTabs`. `renameBoard` syncs tab name. `deleteBoardById` removes from tabs.

**UI** (`TabBar.jsx`, `WhiteboardApp.module.css`):
- Tab bar: 32px strip at top, left-offset 42px (clears portal bubble). Tabs show board name + ✕ close button. Active tab has blue bottom border. "+" button opens board picker to add another tab.
- Board picker: when opened from "+" button, shows "← Back to canvas" cancel button (preserves existing tabs). Opening a board adds it as a new tab.
- `showPicker` React state in WhiteboardApp controls picker visibility without clearing tabs.

**Flow:** Board picker → click board → canvas with tab bar → "+" → picker (tabs preserved) → click another board → 2 tabs → click tab to switch → ✕ to close → last tab close returns to picker.

**Files changed:** `whiteboardStore.js`, `WhiteboardApp.jsx`, `WhiteboardApp.module.css`, NEW `components/TabBar.jsx`

---

### XP scoring overhaul — 9-tier system + retroactive replay (2026-03-31)

**9-tier scoring system** replacing the old 6-tier system. `TIER_EXP` in `scoring.js` now maps:
- `perfect`: 125 XP (was 100) — disproportionate top bonus; `p90`: 88; `p80`: 68; `p70`: 42; `p60`: 12; `p50`: −8; `p40`: −22; `p30`: −40; `fail` (< 30%): −70
- Removed the old "miss by 1 point or daily" (`good`) special case — falls naturally into the 90%+ bucket
- `scoreDay` tier logic now purely percentage-based thresholds (except `perfect` which still checks `ptsMissed===0 && dMissed===0`)
- `calcMomentum` order array updated: `['fail','p30','p40','p50','p60','p70','p80','p90','perfect']`

**Retroactive XP replay** (`store.js`): On first load after update (`S.profile.xpVersion < 2`), `replayProfileFromHistory()` replays all closed days in chronological order using new scoring, preserving habit bonuses. Sets `profile.xpVersion = 2` so it never runs again. Calls `persist()` (no `notify()` — pre-React-mount). Only `profile.{exp, level, streak, longest, perfect}` changes; all task/day/historical data read-only.

**StatsView.jsx**: `TIER_CLR` expanded to 9 entries (smooth spectrum: gold → grn → tel → #3aada0 → slv → #8888aa → #a855a0 → ora → hot). `weekTierColor()` updated to match new thresholds.

**DayView.jsx**: Close-day toast updated — `'good day'` replaced with `'strong day'` (p90/p80) and `'decent day'` (p70/p60).

**Files changed**: `src/utils/scoring.js`, `src/store/store.js`, `src/components/stats/StatsView.jsx`, `src/components/day/DayView.jsx`

---

### Light theme card fixes (2026-03-31)

**Left-side color strip restored** — `priNormal::before` and `priIdea::before` were accidentally set to `background: transparent` on lav/van/wht themes (to avoid neon glow). Fixed: now `background: var(--tel)` and `background: var(--pri-idea)` respectively, with `box-shadow: none`. Both base and `:hover::before` states fixed.

**Card tint opacity bumped** — priNormal and priIdea background percentages raised: `10% → 14%` (normal), `16% → 20%` (hover). Border percentages bumped proportionally. Affects lav/van/wht themes only.

**Kraft heatmap empty cell** — `--heatmap-empty` for kraft changed from `#9e9282` (too grey, clashing) to `#b2a278` (warm golden-tan matching kraft paper palette). Still clearly darker than bg without being olivey.

**Files changed**: `src/styles/components/TaskCard.module.css`, `src/styles/tokens.css`

---

### Comprehensive light theme color overhaul (2026-03-31)

Complete rewrite of color tokens and component overrides for all 4 non-dark themes (Lav-Light, Vanilla, Kraft, White). Dark and Soft-Dark themes untouched.

**tokens.css — full accent palette per theme:**
- `--gold` darkened on all 3 bright themes (was #f0b030, invisible ~2:1 contrast): Lav-Light #9e7400, Vanilla #9a7000, White #9c7400, Kraft unchanged #8c6200
- `--t3` (muted text) darkened to ~4:1 contrast: Lav-Light #6b5a96, Vanilla #7a6840, White #6e6a64, Kraft #5c4420
- 12+ accent colors now overridden per theme (were unchanged from dark neon values): `--hot`, `--blu`, `--ora`, `--yel`, `--slv`, `--pnk`, `--lim`, `--ind`, `--brn`, `--crl`, `--pur`, `--pri-maya`, `--gry`
- Borders (`--b1`, `--b2`) strengthened on all 4 themes
- Tint backgrounds (`--gd2`, `--ht2`, `--gn2`, `--tel2`) rebaselined to use darkened accent colors
- Each theme has distinct personality: Lav-Light = cool/purple, Vanilla = warm/amber, White = neutral, Kraft = rugged earth

**Component overrides added (5 files previously had zero theme overrides):**
- `Topbar.module.css` — removed logo neon text-shadow, active tab glow, momentum dot glow, theme menu shadow lightened
- `Modals.module.css` — overlay opacity (82%→38-45%), modal/ctx/toast shadows (75-90%→12-18%), level-up frosted glass overlay, removed neon gold glow on level-up card, subtler button hover glows, removed toggle box-shadows
- `StatsView.module.css` — removed XP bar glow, radar drop-shadow filter, danger zone text-shadow, subtler button hovers
- `WeekView.module.css` — today column crisp border (was diffuse glow), removed today number text-shadow, done task opacity bumped
- `DayView.module.css` — expanded: section label glows removed for all light themes (secLblActive, secLblFocused), spotlight strip glows removed, fasting widget overrides for lav/van/wht (was kraft only), drop zones use var-based colors, pulse animations use color-mix() for theme adaptability

**Existing overrides modernized:**
- `TaskCard.module.css` — converted hardcoded rgba to `color-mix(in srgb, var(--X) N%, transparent)` so tints/shadows auto-follow each theme's variables
- `Sidebar.module.css` — added food badge/check overrides for lav/van/wht, unified kraft overrides
- `Shell.module.css` — bubble glow and launcher shadow reduced for light themes
- `IdeaPanel.module.css` / `ProjPanel.module.css` — swatch hover uses `var(--text)` instead of white rgba (was invisible on light), dropdown shadows reduced

**Files changed:** `tokens.css`, `TaskCard.module.css`, `Topbar.module.css`, `Modals.module.css`, `StatsView.module.css`, `WeekView.module.css`, `DayView.module.css`, `Sidebar.module.css`, `Shell.module.css`, `IdeaPanel.module.css`, `ProjPanel.module.css`

---

### Theme polish + task card fixes (2026-03-31)

**Color palette reorder** — All 4 color pickers (ProjPanel, IdeaPanel, StatsView, TaskCard topic picker) now use a boustrophedon (snake) 8-column grid with a color-wheel gradient: red upper-left → hot pink → coral → pinks → magenta → purple (row 1) → indigo → blues → teal → greens → lime (row 2, visual R→L) → yellow → gold → orange → brown → grey → silver (row 3). Transitions are smooth at row boundaries.

**Color token additions/adjustments**:
- `--red: #e01828` added (with lighter-theme overrides)
- `--lpnk: #ff80cc` (more vibrant than previous #ff99cc)
- Final row 1 order: `red | hot | crl | pnk | lpnk | mgn | pri-maya | pur`

**Heatmap contrast** — Added `--heatmap-empty` CSS custom property (defaults to `var(--s2)` on dark/dim). Per-theme overrides give the empty cells clear contrast against the background on all light themes. All values are neutral grey (no olive/green tint): kraft `#9e9282`, vanilla `#c2bdb0`, lav-light `#bebcc8`, white `#c8c8c6`. `ContribHeatmap.module.css` and legend now use `var(--heatmap-empty)`.

**Kraft legibility** — Bumped `--s1` from `#d4c296` → `#ddd0a2` (clearer card/bg separation). Increased `--b1`/`--b2` opacity (`.24`→`.32`, `.46`→`.52`).

**Project card left strip** — Project tasks on Kraft were getting the teal `::before` strip instead of their project color. Fix: added `hasProject` CSS class + `--card-strip` inline CSS variable set to the project's color token. The `::before` pseudo-element reads `var(--card-strip)`, so project cards always show their own color. Non-project cards fall back to existing behavior (transparent on dark, teal on kraft).

**Card opacity removed** — Removed base `opacity: 0.82` from `.taskCard`. All cards now render at full opacity. Done and dragging states retain their own opacity rules.

**Border strengthening** — Bumped `--b1`/`--b2` on all three remaining light themes for crisper structural definition:
- lav-light: b1 `.18→.28`, b2 `.32→.48`
- vanilla: b1 `.16→.26`, b2 `.30→.46`
- white: b1 `.14→.22`, b2 `.26→.38`

**What's still "faded" on light themes** — Addressed in the comprehensive light theme color overhaul session (see above). All accent colors, text hierarchy, borders, shadows, and glows now tuned per-theme.

---

### Code review & cleanup — project labels, dead code removal (2026-03-31)

**Project labels fixed** — Regular (non-project) tasks no longer show a project chip or "+ proj" button on TaskCard. Only tasks with `task.project` set show the project label. Condition changed from `!isIdea` to `!isIdea && task.project` in TaskCard.jsx.

**Dead code removed:**
- `taskRank()` wrapper in `taskPlacement.js` removed — was identical to `starRank()`. All DayView call sites updated to use `starRank()` directly.
- Unused `onProjectClick` prop removed from TaskCard.
- Stale `mayaDoneKey` variable renamed to `ideaDoneKey` in DayView.

**Migration cleanup:**
- `sortTasksForView` comment corrected (was "kept for compat but unused" — actually actively used).
- Migration default project colors changed from `'pri-maya'`/`'pri-ai'` to `'pur'`/`'blu'` for new migrations.
- v4→v5 migration settings now includes full defaults (was missing calorieTarget, frogsEnabled, ideaTopics, projects).

**Pre-existing issue noted:** React key warnings from `ContribHeatmap` in DayView (not introduced by this session).

### Task system overhaul — stars, projects, unified model (2026-03-30)

**Priority colors replaced by stars** — The hi/md/lo color priority system is gone. ALL tasks (including normal tasks) now use a 1–5 star rating (`mayaPts`). Single teal color for all normal tasks. Stars determine sort order. Quick-add syntax: `!1`=1star through `!5`=5stars (number = star count). Old `!hi/!md/!lo` aliases removed.

**Maya + AI tabs merged into Proj** — Sidebar now has 4 tabs: Day | Tasks | Proj | Idea. The "Proj" tab shows tasks with a `task.project` field. Project combobox (type to filter/create), project filter chips, color-per-project. Maya/AI tasks migrated to normal tasks with `project: 'Maya OS'` / `project: 'AI'` auto-created as projects.

**Projects system** — `S.settings.projects` array of `{name, color}` objects. Store functions: `getProjects()`, `addProject()`, `editProject()`, `deleteProject()`, `setProjectColor()`. `task.project` field on tasks (nullable string). 22-color palette for projects/topics.

**Project + Topic management in Backend** — Two new sections between Settings and Danger Zone: "Projects" and "Topics (Ideas)". Each has: add input, color dot (swatch picker), edit button, delete button.

**Task card changes** — All cards show 5 stars. Normal tasks = teal stars. Project tasks = project's color on card border + stars. Idea tasks = green stars. Project chip shows on card (like topic chip for ideas). `priHi`/`priMd`/`priLo`/`priMaya`/`priAi` CSS classes removed, replaced with `priNormal`.

**Context menu overhaul** — Normal task right-click: Start, Focus, Frog, Edit, separator, 5 star ratings, separator, Delete. Idea right-click: only 5 star ratings + Remove from day. No more priority color items.

**Priority paint tool removed** — No more color-dot toolbar buttons in DayView or BacklogPanel.

**Maya/AI special behavior removed** — No more `task.done` for maya/ai (only ideas). No more `markSpecialDone` for maya/ai. No more "Remove from day" for non-idea tasks. All tasks use `dayRecord.cIds` for completion. Normal drag/schedule/backlog behavior for all.

**Migration** — On load: `priority:'maya'` → `priority:null` + `project:'Maya OS'`; `priority:'ai'` → `priority:null` + `project:'AI'`; `priority:'hi'` → `mayaPts:5`; `priority:'md'` → `mayaPts:3`; `priority:'lo'` → `mayaPts:1`. Task.done synced to cIds. MAYA prefix stripped.

**New color tokens** — `--mgn` (magenta), `--lpnk` (light pink), `--ora2` (orange-red), `--lgrn` (light green). Theme overrides for all 5 themes.

**Deleted files** — `MayaPanel.jsx`, `AIPanel.jsx`, `MayaPanel.module.css`, `AIPanel.module.css`.

**New files** — `ProjPanel.jsx`, `ProjPanel.module.css`.

**parseInput changes** — Returns `{ name, pts, time, isFrog, stars }` (was `priority`). New `parseIdeaInput(raw)` for idea-only parsing (stars + name only).

**taskPlacement.js** — `starRank(t)` replaces `priRank`. `snapToStarZone`, `insertTopOfStarGroup` exported. 5-tier ranking (5★→rank1 ... 1★→rank5).

**Future TODOs** — Retest all 6 themes. Refactoring + bug hunting pass.

### Topic colors, sticky dropdown, topic sorting (2026-03-30, earlier)

**Per-topic colors** — Topics are now `{ name, color }` objects (was strings). Color is a CSS token name (`'slv'` default). Each dropdown item has a colored dot + inline color swatch picker (12 colors). `setIdeaTopicColor(name, color)` in store. Topic chips on cards use `color-mix()` inline styles for per-topic color. Migration: string topics auto-convert to objects on load.

**Sticky dropdown** — Replaced instant `onMouseLeave` close with 200ms delayed close. Mouse re-enter cancels. Editing/color-picking prevent close.

**Topic sort + filter** — T↓/T↑ button sorts by topic name alphabetically (no-topic at end). Filter chips below toolbar: "All" + each used topic name. Click to toggle filter. `sortTasksForView` supports `'topic'` field.

### Idea tab overhaul, frog toggle reorder, toolbar fix (2026-03-30, earlier)

**Idea tab overhaul** — Ideas are pure notes, not tasks. Cannot be scheduled/dragged to DayView. No points/duration badges. Stars represent subjective importance. Auto-resizing textarea input (Enter submits, Shift+Enter = newline). `noDrag={true}` prop on TaskCard. DayView drop handlers reject `priority === 'idea'`.

**Topic system** — `task.topic` field + `S.settings.ideaTopics`. Combobox above textarea: type to create, dropdown to select. Edit/delete propagate. Store: `getIdeaTopics()`, `addIdeaTopic()`, `editIdeaTopic()`, `deleteIdeaTopic()`.

**Backend toggle reorder** — "Eat the Frog" moved below Fasting/Calorie toggles.

**Toolbar alignment fix** — `min-height: 22px` on `.toolbar`.

### Idea tab, darker AI blue, frogs toggle (2026-03-30, earlier)

**Idea tab initial** — 5th sidebar tab ("Idea", dark green `--pri-idea: #30bb70`). Uses `priority: 'idea'` with star rating, `task.done` completion. New files: `IdeaPanel.jsx`, `IdeaPanel.module.css`.

**Darker AI blue** — `--pri-ai` from `#4488ff` to `#2255cc`. Kraft: `#1a44aa`.

**Tab renames** — "Backlog" → "Tasks". 5 sidebar tabs: Day | Tasks | Maya | AI | Idea.

**Frogs toggle** — `settings.frogsEnabled` (default `true`). "Eat the Frog" ON/OFF in Backend. When OFF: frog section hidden, frog tasks in core list, radar drops FROGS axis.

**btnPrimary fix** — Added missing `.btnPrimary` to `StatsView.module.css`.

**`isSpecialPriority`** covers `'maya'`, `'ai'`, `'idea'`.

### AI sidebar tab + Backend text fixes (2026-03-30, earlier)

**AI task tab** — 4th sidebar tab ("AI", blue `--pri-ai`) for AI/vibe-coding projects. Uses `priority: 'ai'` — same model as maya tasks: star rating (1–3), `task.done` completion, unschedule-not-delete, immune to paint tool, excluded from backlog, carry-forward via `task.done`. New files: `AIPanel.jsx`, `AIPanel.module.css`.

**Tab label change** — "Dailies" tab renamed to "Day" to fit 4 tabs.

**Store rename** — `markMayaDone` → `markSpecialDone` (handles maya, ai, idea tasks). `sortTasksForView` 4th arg changed from boolean `mayaOnly` to string `specialPri` (`'maya'`/`'ai'`/`'idea'`/`false`).

**Backend settings text** — "Point target / day:" → "Points", "Fasting tracking:" → "Fasting Tracking", "Calorie tracking:" → "Calorie Tracking" (removed colons, capitalized T).

### CosmiCanvas Phase 4 Features (2026-03-29)

**JSON export/import**: Save Board as JSON (elements + camera + style), Import from JSON (additive with fresh IDs). Both accessible from right-click context menu.

**SVG export**: Export Board as SVG via right-click context menu. Clean vector output with proper shapes, polylines, text, and arrowheads.

**Dot grid background**: Subtle dot pattern in world space, adaptive spacing by zoom level. Provides spatial reference.

**Minimap**: 160×100 overview in bottom-left corner. Grey element rectangles + blue viewport frame. Click to navigate. Fades to 70% opacity.

**Image paste**: Ctrl+V with clipboard image creates image element at viewport center. Blob stored in IndexedDB. Async bitmap loading with cache. Renders actual image once loaded.

**Snap to grid**: Toggle with G key. Shapes and moved elements snap to 20px grid. SNAP badge in status bar.

**Element count**: Status bar shows element count.

### CosmiCanvas Bug Fixes + Polish (2026-03-29)

**Critical fixes**: Roughjs drawables now render at origin with `ctx.translate` for positioning — cache is position-independent, no more shaking/jittering on any element type. Select tool drag uses `dragSnap` IDs instead of stale React `selection` closure. Resize handler scales points proportionally for lines/arrows/freehand. Export uses fresh roughjs instance (no cache pollution). Selection boxes use `getBounds()` for all element types.

**New features**: Toolbar color picker (stroke + fill, 12-swatch palette). Stroke width slider in toolbar. Clear board button with undo. Board rename (double-click in picker, double-click title in canvas view). Zoom shortcuts (Ctrl++/−, Ctrl+1 reset to 100%, Ctrl+0 fit). Keyboard help overlay (? key). PNG export (right-click → Export Selection/Board, or Ctrl+Shift+E). Canvas background respects dark theme.

**Polish**: Tools stay in drawing mode after creating (no auto-switch to select). Escape clears marquee + ghost. Freehand simplification scales with zoom. Text commit explicitly sets dirty. Canvas background via CSS `var(--bg)`.

### CosmiCanvas Phases 1–3 (2026-03-29)

**Phase 1**: Registered CosmiCanvas in Shell (`id: 'board'`, `wrap: 'full'`). IndexedDB storage (`maya_whiteboard` DB with `boards` + `blobs` stores). Pub/sub store following Maya/Vault pattern (HMR-safe on `window.__boardS`/`window.__boardListeners`). Camera with pan (middle-click/space+drag) and zoom (scroll wheel, cursor-centered). Quadtree spatial index. rAF render loop with dirty flag and DPR scaling. Board picker (create/list/delete). Debounced 200ms persist with flush on beforeunload/Ctrl+S.

**Phase 2**: Full element model (rectangle, ellipse, line, arrow, freehand, text). Select tool (click select, drag move, 8-handle resize, marquee multi-select, Shift+click toggle). Shape tool (Shift=constrain, Alt=center). Line/freehand tool (RDP simplification, Shift=45-degree snap). Text tool (click to place, textarea overlay, blur/Enter commits). Roughjs sketch style with drawable caching. Clean geometric style. Undo/redo command stack. Floating toolbar with keyboard shortcuts. Style switcher.

**Phase 3**: Arrow connection logic (getConnectionPoints, snapToConnection, computeArrowPath). Group/ungroup. Right-click context menu with inline stroke/fill color controls, stroke width slider, arrange (forward/backward/front/back), group/ungroup, duplicate, copy, delete. Empty canvas context menu: paste, select all, zoom to fit. Color picker (12-swatch palette + hex input). Z-ordering (bringForward, sendBackward, bringToFront, sendToBack). Copy/paste/duplicate with offset. Select all (Ctrl+A). Full keyboard shortcuts: `]`/`[` z-order, Ctrl+`]`/`[` to front/back, Ctrl+G group, Ctrl+Shift+G ungroup, Ctrl+C/V/D copy/paste/duplicate, Ctrl+0 zoom to fit.

**New dependency**: roughjs (hand-drawn style rendering).

**Files created** (27 new files):
- `src/whiteboard/core/` — constants.js, camera.js, canvas.js, spatialIndex.js, history.js
- `src/whiteboard/store/` — idb.js, whiteboardStore.js
- `src/whiteboard/hooks/` — useWhiteboardStore.js
- `src/whiteboard/elements/` — types.js, bounds.js, arrows.js, groups.js
- `src/whiteboard/render/` — renderer.js, styles/sketchStyle.js, styles/cleanStyle.js
- `src/whiteboard/tools/` — selectTool.js, shapeTool.js, lineTool.js, textTool.js
- `src/whiteboard/components/` — Toolbar.jsx, StyleSwitcher.jsx, ContextMenu.jsx, ColorPicker.jsx
- `src/whiteboard/styles/` — Toolbar.module.css, ContextMenu.module.css
- `src/whiteboard/` — WhiteboardApp.jsx, WhiteboardApp.module.css

**Files modified**: `src/Shell.jsx` (added board app to APPS array), `package.json` (added roughjs)

---

### Daily dot hit target expanded (2026-03-29)

Clicking the colored dot to mark a daily done/undone was too fiddly after inline name editing was added (clicking the name now opens an edit input). Fixed:
- Dot wrapped in `.dDotBtn` — a larger hit target with `8px` vertical / `6px` horizontal padding (effectively ~28×22px clickable zone vs the original 6×6px dot)
- Negative margin on wrapper compensates so card layout is unchanged
- `pointer-events: none` on the inner dot; clicks register on the wrapper only
- `e.stopPropagation()` on both dot button and name span — the two zones are fully isolated
- Hover feedback: subtle `var(--s2)` bg on dot area; tooltip "Mark complete" / "Mark incomplete"
- `cursor: default` on card row (was `pointer`); only dot and name text have their own cursor hints

**Files changed**: `src/components/sidebar/DailyItem.jsx`, `src/styles/components/Sidebar.module.css`

---

### Food log + inline name editing (2026-03-29)

**Food log in Dailies tab** — below dailies list, separated by divider. Quick-add input parses calorie syntax (`chicken breast 300cal`, `coffee`). Food items show name + teal calorie badge. Click name for inline edit (name + cal inputs). Delete button on hover. Calorie total in header (teal, turns orange when over target). Click total to toggle "done eating" (section fades to 0.35 + checkmark).

**Data model**: `days[date].foodLog = [{ id, name, cal }]`, `days[date].foodDone` boolean. `S.settings.calorieTarget = 2000`. No schema bump — optional fields.

**Backend Nutrition section** — Today's cal / target, 7-day avg, 30-day avg, days under target. 14-day calorie bar chart (green = under target, orange = over, red = way over). Dashed target line. Calorie target setting in Backend settings area.

**Inline name editing** — Click task name text → inline input with gold border. Blur saves, Escape cancels, Enter triggers blur. Priority paint mode and done state disable editing. Drag disabled while editing. DailyItem: same pattern; name click now edits (dot click still toggles completion). Maya tasks: strips/re-adds "MAYA — " prefix during editing.

**New files**: `src/components/sidebar/FoodItem.jsx`, `FUTURE_IDEAS.md`

**Store additions**: `addFoodItem`, `updateFoodItem`, `deleteFoodItem`, `toggleFoodDone`, `getCalorieTarget`, `setCalorieTarget`. `parseFoodInput()` in parsing.js.

---

### Intermittent fasting feature + habit XP bonuses (2026-03-29)

**Schema v5 → v6** — new `S.settings` object (`{ fastStart: '13:00', fastEnd: '21:00' }`), `days[date].fastBroken` flag. Migration in `migrations.js`.

**Fasting widget in Day View** — placed between heatmap and frogs section. States: pre-window (dim, "Opens in Xh Xm"), active (teal pulse, "Closes in Xh Xm" + progress bar), done (fade + ✓), broken (red ✗). Auto-timer updates every 60s on today's date. Break button (✗) visible only during/after eating window. Optimistic model — success assumed unless explicitly broken.

**Habit XP bonuses** — `closeDay()` now adds +8 XP for workout and +8 XP for successful fast (eating window passed + not broken), applied after tier scoring. Included in `scoreRecord.expDelta` for correct reopen reversal. Re-checks leveling after bonus.

**Radar chart 5 → 6 axes** — hexagon. New FASTING axis (orange, `var(--ora)`). Value = active days without `fastBroken` / 30.

**Backend tab** — "Settings" renamed to "Backend" in NavTabs. New Fasting stats section: Fast Streak, Longest Streak, Total Fast Days, 30-day ring chart (orange SVG arc). Eating window config (time pickers) in Settings section.

**Kraft theme overrides** — fasting widget colors adapted for kraft palette.

---

### Maya task grouping overhaul
- **Maya tasks now grouped by star level** in DayView core tasks — 3★ sorts with hi (pink), 2★ with md (gold), 1★ with lo (blue). Previously had a separate top-most Maya section. `taskRank()` helper maps star count to rank 1/2/3; used in `snapToZoneByRank` and drag logic.
- **Maya tasks appear purple** even within their rank group (still use `priority: 'maya'` for color; grouping is by star count only).
- **Maya tasks go to TOP of rank group** when initially scheduled (drag from sidebar or AssignPopup) and when stars change on an already-scheduled task. Previously went to bottom.
- `handleStarChange` uses `snapToZoneByRank(0, zone, newRank)` (top of group).
- `makeDrop('day')` maya branch now calls `doMove` after `updateTask` for initial placement.
- `AssignPopup` has new `onScheduled` callback prop; DayView wires it to reposition maya tasks scheduled onto today.

### Carry-forward fix
- **Maya tasks now carry forward** — `carryForwardTasks` previously excluded `priority === 'maya'` tasks.
- **Frog status preserved** — was incorrectly hardcoding `isFrog: false` on every carried-forward task. Removed.

### ↩ Return-to-backlog button
- Added ↩ button to core task cards in DayView (not in sidebar). Calls `updateTask(id, { scheduledDate: null })`. `onMoveToBacklog` prop on TaskCard; sidebar never receives this prop so no button there.

### Kraft theme
New mid-tone theme — darker than Vanilla, less eye-shock than dark. Key decisions:
- `--gold: #8c6200` (dark amber, contrasts on tan) overrides the global `--gold: #f0b030` for kraft
- `--gd2: rgba(140,98,0,.22)` matching
- Focused task left strip: `#f0c840` (bright warm yellow matching card border) — set on `.focusedTask::before` in TaskCard.module.css
- Daily dots: kraft-specific `TOD_COLORS_KRAFT` palette (moss green → teal → slate → indigo → violet → plum); `todColor()` now accepts `theme` param
- Frog/workout kraft pulse animations; frog pulse stops correctly on done (covers both `frogSecDone` and `frogSecAllDone` classes)
- Dailies card bg: `var(--s2)` instead of `var(--s1)` (less pale)
- `dDot` box-shadow suppressed for kraft (ink dots don't need neon glow)
- All icon button colors overridden for visibility on tan bg

### Skin menu
- **6 themes now**, reordered dark→light: Dark, Soft-Dark, Kraft, Vanilla, Lav-Light, Light
- **Renamed**: Dim → Soft-Dark, Lavender → Lav-Light, White → Light
- **Menu widened** to 150px min-width (prevents label wrapping)
- Theme IDs unchanged (`dim`, `light`, `white`) — only labels changed

---

### Focus task persistence (2026-03-18)
`focusedTaskId` was only stored in React state (`useState(null)`) — lost on every reload/HMR. Now persisted to `localStorage` key `maya_focusedTaskId`. Restored on mount with validation (clears if task no longer exists or is done). Unfocusing clears the key.

### Codebase audit bug fixes (2026-03-18)
Two Sonnet audits + one Opus verification sweep. 8 bugs fixed:
- **CRITICAL**: WeekView maya task completion — was using `cIds` instead of `task.done` for maya tasks (always showed incomplete)
- **MODERATE**: Streak lost on non-perfect day reopen — `reverseScoreRecord` now restores `streakBefore` instead of only decrementing on perfect days
- **Minor**: Variable shadowing in `DayView.makeDrop()` — inner `const zone` renamed to `zoneList2`
- **Minor**: Invalid letter grades stored raw on CSV import — fallback changed from `raw` to `null`
- **Minor**: Unnecessary `persist()` after empty `seedTasks()` — removed
- **Minor**: `parseInt` missing radix in StatsView — added `, 10`
- **Minor**: Unnecessary `(t) => getTimerDisplay(t)` wrapper in App.jsx — simplified to direct reference
- **Minor**: Dead else-branch in `handleStarChange` — removed unreachable MayaPanel reposition code + cleaned up unused `insertAtForStars` import

Deferred bugs documented in `KNOWN_BUGS.md`.

### Daily dot theme-switch bug fix
`DailiesPanel` was reading `document.documentElement.className` directly to get the theme for `todColor()` — DOM reads don't trigger React re-renders, so dots stayed stale on theme switch until a tab toggle forced a re-render. Fixed by threading `theme` as a prop: `App.jsx → DayView → Sidebar → DailiesPanel`.

---

## Not yet verified (Maya)
- [ ] Frog section right-click complete/undo
- [ ] Core tasks collapse toggle persists across navigation
- [ ] v4→v5 migration
- [ ] AssignPopup positioning on small viewports

---

## Known issues
- See `KNOWN_BUGS.md` for deferred bugs (pre-Supabase items, acceptable limitations, nice-to-haves).

---

## Recommended next (CosmiCanvas)
1. **Phase 1**: Canvas + camera + IndexedDB + board picker + Shell registration. See WHITEBOARD_SPEC.md Phase 1 for detailed steps.
2. **Phase 2**: Drawing primitives + select + roughjs + toolbar + undo/redo.

## Recommended next (Vault)
1. Focus Mode
2. Remaining column types (image upload, relation picker UI)

---

## Do not start without direction
- TypeScript migration
- Mobile layout
- Task history / archive
- Weekly review mode (Maya)
- Kanban view (Vault)
- Formula columns (Vault)
- Public sharing (Vault)
- Anything in TODO.md
