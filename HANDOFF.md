# Maya OS — Handoff

## Status
**Maya OS: Phase 6 complete.** Fully functional. All docs current.
**Portal Shell: Complete.** Bubble + launcher working. Maya and Vault switch cleanly.
**Vault: Step 7 + UI polish + 5 major features + DB improvements + Showcase overhaul + Timeline/Era system complete.** Full interactive skeleton with local/mock mode. 8 characters with rich data. Awaiting Supabase setup to persist data.

---

## Orientation — read these in order before anything else

1. **CLAUDE.md** — working rules, critical gotchas, app isolation rules, commands. Follow exactly.
2. **ARCHITECTURE.md** — Maya file structure, store API, patterns.
3. **VAULT_ARCHITECTURE.md** — Vault file structure, store API, patterns.
4. **SPEC.md** — Maya feature behavior reference.
5. **VAULT_SPEC.md** — Vault feature behavior reference.
6. **PORTAL_SPEC.md** — Shell/bubble spec.
7. **TODO.md** — user-managed. Do not touch without explicit direction.

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
- **Day View** — date nav, score block (points/dailies bars, workout toggle, carry-forward, close/reopen day), frogs section, spotlight/focus zone, core tasks (priority paint, P/T/G sort, quick-add, bump buttons, hide/show, ↩ backlog button), done section
- **Sidebar** — Dailies tab (color-coded dots, drag reorder), Backlog tab, Maya tab (star rating, quick-add)
- **Maya task system** — `priority: 'maya'` tasks; star rating (1–3 stars); completion via `task.done`; drag to DayView = scheduled; grouped by star level with hi/md/lo tasks in DayView
- **Carry-forward** — `↺ N` button; moves past non-done tasks (including maya tasks) to today; preserves isFrog status
- **Drag and drop** — all zones; group integrity enforced; sandwich recolor; day-tab drag
- **Timer** — countdown / open-ended / countup; focus vs start distinction
- **Week View** — 7-day grid, drag to reschedule, click to navigate
- **Stats View** — progression cards, XP bar, heatmap, bar chart, radar, weekly rhythm, trend line, daily consistency, export/import
- **Scoring** — 6 tiers, XP awards, streak multiplier, idempotent close/reopen, momentum
- **Leveling** — 100 levels, 100 titles
- **Quick-add syntax** — `!hi/!md/!lo`, `@N`, `Nh/Nm`, `frog`
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

---

## Recent session changes

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

### GitHub-style contributions heatmap (2026-03-24)
Added a GitHub-green contributions heatmap showing day quality over time. Shared `ContribHeatmap` component (`src/components/shared/ContribHeatmap.jsx`) with configurable props (weeks, cellSize, gap, showDayLabels, showMonthLabels, showLegend).

**Green logic** (fraction-based from `scoreDay().frac`):
- 100% → `#006d32` (darkest green)
- 80%+ → `#26a641` (medium green)
- 60%+ → `#7bc96f` (lightest green — floor for any green)
- Below 60% → gray (`var(--s2)`)
- no data/future → gray or invisible

**DayView placement**: Full version (20 weeks, 10px cells, day labels, month labels, legend) between score block and frogs section.
**StatsView placement**: Full version (20 weeks, 10px cells, day labels, month labels, legend) side-by-side with the existing colorful Activity tier heatmap. Both heatmaps kept.

No outlines on cells (unlike GitHub). Flat colors, no glow/box-shadow.

Files: `ContribHeatmap.jsx`, `ContribHeatmap.module.css`, edits to `DayView.jsx`, `DayView.module.css`, `StatsView.jsx`.

### Vault DB improvements + Showcase overhaul (2026-03-25)

**DB-like table improvements:**
- **Column resize drag handles** — drag column header borders to resize. Uses `resizeColumn()` store API. Min width 60px. Gold line on hover.
- **Row detail modal in grid view** — double-click any row to open a frosted overlay with all fields editable. Extracted `RowDetailModal` into shared component (`src/vault/components/table/RowDetailModal.jsx`), used by both TableGrid and TableGallery.
- **Relation picker UI** — CellRenderer shows linked row names as TagChips; CellEditor has a dropdown to toggle relations on/off. New store helpers: `getRowName(rowId)`, `getRowsForSection(sectionId)`. Props `rowId`/`sectionId` threaded through TableGrid → CellRenderer/CellEditor.

**Richer seed data:**
- **Characters table** — 4 new text columns (Personality Traits, Combat Abilities, World Info, Work Notes) with 2-3 sentences per character. All 6 showcase tabs now have content.
- **Places table** — expanded from 3 to 7 columns (added Climate, Danger Level, Population, Faction) and from 2 to 6 rows.
- **Items table** — new section on pg-items with 8 columns (Name, Rarity, Type, Power, Value, Owner, Description, Special Effect) and 6 items (Starbreaker, Oathbreaker, Veil Shard, Whisperwood, Luminari Vestments, Soul Compass).

**Character Showcase overhaul** — complete rewrite of `CharacterShowcase.jsx` + CSS:
- **Hero banner** — full-width gradient bg, 96px portrait with character-color glow ring, name with gold text-shadow, badges row with stars, power tier label
- **Two-column layout** — left column (identity, radar, D&D), right column (power gauge, stat bars, ability cards)
- **Enhanced radar chart** — 280px, gradient gold→orange fill, glow layer, reference octagon at 50%, color-coded labels, pulse animation
- **Power rating gauge** — circular SVG arc, `computePowerRating()` in vaultStore (weighted average → 0-100 index → E/D/C/B/A/S/S+-CLASS tier). Pulse on S+ tier.
- **Stat power bars** — horizontal bars per stat with fill animation, dot + name + flavor text + grade badge
- **Ability cards** — 2-column grid, each card has accent border, name, grade badge, mini bar, flavor text (Transcendent/Legendary/etc.)
- **D&D stat block** — 3x2 grid of cards with color-coded values (dim→normal→blue→purple→gold→hot), modifier display, top accent line
- **Relations section** — clickable 48px avatar circles for bonded characters, click navigates to that character
- **Tab content** — improved typography, Relations tab renders bond portraits
- **Visual flourishes** — gradient dividers, HUD corner tick marks on identity panel, hover effects on cards

Files: `CharacterShowcase.jsx`, `CharacterShowcase.module.css`, `ShowcaseView.jsx`, `RowDetailModal.jsx`, `RowDetailModal.module.css`, `TableGrid.jsx`, `TableGrid.module.css`, `TableGallery.jsx`, `CellRenderer.jsx`, `CellEditor.jsx`, `vaultStore.js`.

### Showcase Round 2: Edit Mode, Richer Content, Fixes (2026-03-25)

**Portrait fix**: Removed `justify-content: space-between` from `.heroContent` — portrait no longer shifts on resize. Added responsive stacking at 480px.

**13 new character columns**: Title (epithet), Affiliation (select), Class, Signature Move, Weapon, Weakness, Goal, Fear, Theme Song, Voice Claim, Story Arc (3-5 sentence narrative), Key Moments (bullet-style), Relationships Detail (paragraph descriptions of each bond). All 5 characters have full content for every column.

**New showcase sections**:
- **Hero title/epithet** — rendered below character name ("The Frost Prodigy", "Knight of the Broken Oath", etc.)
- **Quick Facts Strip** — horizontal row of compact data chips: Class, Affiliation, Weapon, Signature Move, Weakness, Goal, Fear. Each with thin left border accent.
- **Story Arc Block** — full-width section with gold left border accent and tinted background
- **2 new tabs** — "Story" (maps to Story Arc column) and "Moments" (maps to Key Moments, renders as styled bullet list with gold dot markers)
- **Enhanced Relations tab** — shows both detail text paragraphs AND bond portrait circles

**Edit mode** — toggle via `E` hotkey or pencil button (top-right of hero banner):
- Text fields become `<input>` (short) or `<textarea>` (long)
- Select fields show dropdown pickers
- Letter grades show grade picker
- Ratings become interactive StarRating
- Checkboxes toggle directly
- D&D stats become number inputs
- Tab content becomes textarea
- All saves via `setCellValue()` — immediate persist, no page reload
- Gold top border + shadow visual cue when editing active

**Responsive improvements**: tabs scroll horizontally on narrow viewports, ability cards go 1-column below 480px, D&D grid goes 2-column below 400px, hero stacks portrait below name at 480px.

### Showcase Round 3: Timeline System, Layout Fix, More Characters (2026-03-25)

**Layout fix**: Added `width: 100%` to `.sheet` — content no longer squeezes right. Changed `.abilityCard` overflow from hidden to visible — cards no longer clipped.

**Timeline/Era system**: Characters can have multiple timeline entries representing different points in their story. Stored as JSON in a `Timeline` text column. Eras override any column values — stats, title, class, goals, etc. Sticky era bar between hero banner and quick facts. Click an era to view the character at that point; click again (or "Current") to return to base data. Scroll position preserved on switch. Tsukasa has 3 eras (Childhood/Apprentice/Awakening + Current). Valdora has 2 eras (Knight-Commander/Desertion + Current).

**3 new characters**: Lyra Ashford (Tsukasa's rival, Arcanist-Scholar, high INT/WIS), Commander Draven (Valdora's former superior, Warlord, high STR/TAR), Nyx (mysterious Veil entity, Oracle, GLITCH WIS). All with full data for every column. 2 new affiliation options (Iron Crown, Shattered Veil). Updated relations graph. 2 new items (Null Prism, Soul-Chain Halberd).

### Showcase Round 4: Collapsible Sections, Quote, Media, Images, Gallery (2026-03-25)

**Collapsible sections**: Identity, Stat Profile, Attribute Scores, Power Rating, Abilities, Story Arc, and Bonds sections now have clickable headers with chevron indicators. Click to collapse/expand. Uses local state (not persisted).

**Stat Breakdown removed**: The horizontal power bars section was redundant with Abilities cards. Removed. Right column is now Power Gauge + Abilities only.

**Theme Song + Voice Claim**: Displayed as compact chips (♫ / 🎤) in the hero area below the power tier. Editable in edit mode.

**Character Quote**: Gold-bordered blockquote between hero banner and era bar. Shows featured quote + attribution. All 8 characters have unique quotes.

**Image system**: Profile image (replaces initials circle when URL present), full-body image (optional hero area), Gallery tab (JSON array of image URLs → thumbnail grid → lightbox). All image columns are null for now (falls back to initials). Lightbox has prev/next navigation, z-index 8000.

**4 new columns**: Featured Quote (col-quote), Profile Image (col-profileimg), Full Body Image (col-fullimg), Gallery (col-gallery). Total: 47 columns + Bonds relation.

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

## Recommended next (Vault)
1. Focus Mode
2. Image upload column type (relation picker UI is now done)
3. Connect to Supabase (schema SQL + .env.local)

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
