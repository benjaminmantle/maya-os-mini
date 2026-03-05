# Maya OS — Handoff Document

## Current status
**Phase 3 complete.** Stats view significantly enhanced with new charts and visualizations. Tasks-only export/import added. Drag/frog/focus interaction bugs fixed. Seed data cleaned up. All changes committed to git.

## Before you do anything
Read the **Working Process** section in CLAUDE.md. Plan before executing, stay in scope, surface blockers before touching files.

## How to run
```bash
cd maya-os
npm run dev    # starts at localhost:5173
```
Or use `preview_start` with the `dev` config in `.claude/launch.json` (uses full node.exe path to bypass PATH issues on Windows).

---

## What was built

### Phase 1 — React migration
Full port of `../maya-os-mini-reference.html`. Key decisions:
- **DayView is intentionally monolithic** — all day-view sub-sections live in `DayView.jsx`. Matches reference HTML structure, avoids over-engineering.
- **Timer state in App.jsx** — `activeTaskId` and `activeStart` are local state, NOT in localStorage. Timer resets on page reload by design.
- **Toast via React Context** — `ToastProvider` wraps the app in `main.jsx`; components use `useToast()`.
- **Drag-and-drop** — native HTML5 drag events inline per component (no shared hook).
- **`Modals.module.css`** — catch-all for modal styles used across multiple components.

### Phase 2 — Post-migration additions
Features added beyond the reference implementation:

**Quick-add inline syntax** (`src/utils/parsing.js`) — order-independent token parsing on both Day and Backlog inputs:
- `!hi`/`!h`/`!1`, `!md`/`!m`/`!2`, `!lo`/`!l`/`!3` — priority
- `@N` — points (0, 0.5, 1, 2, 3)
- `Nh`/`Nm` — duration; `Nh+`/`Nm+` — open-ended
- `frog` — frog flag

**Priority system** — `priority: 'hi' | 'md' | 'lo' | null` on tasks. Colored left border + tinted background. Paint tool in Core Tasks toolbar. Right-click menu. Quick-add syntax.

**Idempotent day scoring** — Close → Reopen → Close no longer double-scores. `scoreRecord` delta stored on DayRecord; `reopenDay()` reverses it exactly.

**Stats view infographics (initial):**
- XP progress bar (current XP / XP to next level, with next title preview)
- Activity heatmap — 13-week GitHub-style grid, cells colored by day tier
- 30-day points bar chart — bars colored by tier, target line at 100%

**Leveling formula adjusted** — `expForLevel(n) = round(200 × 1.4^(n-1))`. Level 2 requires ~280 XP (~3 perfect days). Previous formula was too easy (base 100).

### Phase 2.5 — Drag / frog / focus fixes
- Fixed spotlight zone overlap with frog drop area
- Focused/active tasks now correctly unfocus when completed or moved out of the spotlight area
- Dragging a focused task from spotlight to the frog zone no longer swaps tasks — it unfocuses and moves cleanly to frogs
- Dragging a task to a day tab while another is focused/active no longer corrupts spotlight state

### Phase 3 — Stats charts, tasks export/import, seed cleanup

**Adaptive chart windows:**
- Both the bar chart and trend chart now start from the first day the user has tracked data (up to 30/60-day max), instead of always spanning a fixed trailing window
- Prevents the "data pushed to the right, empty space on left" problem for new users
- Chart titles dynamically show "Points — Last N Days" / "Trends — Last N Days"

**Radar chart ("Balance — Last 30 Days"):**
- 5 axes: TASKS, DAILIES, WORKOUT, FROGS, DISCIPLINE — each normalized 0–1
- Character-stats style: single filled gold polygon, **no concentric rings** (no web/spider look)
- Colored dot at each axis tip; labels positioned outside the polygon; legend row below
- Sits left of Weekly Rhythm bars in a flex row

**Weekly Rhythm bars:**
- 7 bars (Mon–Sun), height = avg day-score fraction for that weekday across all tracked history
- Tier-colored; day label below; count shown via `title` tooltip

**60-day trend line chart:**
- Multi-metric SVG polylines: TASKS %, DAILIES %, FROGS %, XP (normalized)
- Adaptive window (same first-tracked-day logic as bar chart)
- Consecutive data segments rendered as polylines; isolated single-point days as circles
- Legend below

**Tasks-only export/import** (`store.js`):
- `exportTasks()` — filters `S.tasks` by excluding IDs in any `days[date].cIds`; returns `{ version: 'maya_os_tasks_v1', tasks: [...] }` JSON
- `importTasks(json)` — merges incoming tasks with fresh `uid()` IDs and `createdAt` timestamps; does NOT replace existing data; returns count of imported tasks or `false` on failure
- StatsView Danger Zone has two labeled rows: **Full backup** (existing buttons) and **Tasks only (unfinished)** (new buttons)

**Seed data cleanup:**
- `seedTasks()` now returns `[]` — no hardcoded dummy tasks appear after Clear All
- `DEFAULT_DAILIES` preserved — all 9 default dailies still re-seed on Clear All

---

## Deviations from earlier ARCHITECTURE.md plans
These files were previously planned but do NOT exist (DayView is monolithic instead):
- `ScoreBlock.jsx`, `FrogSection.jsx`, `SpotlightZone.jsx`, `CoreTasks.jsx`, `DoneSection.jsx`, `useDrag.js`

---

## Verification checklist

### Working ✓
- [x] All views render (Day, Week, Stats)
- [x] Quick-add inline syntax (`@N` pts, `!hi/md/lo` priority, `Nh`/`Nm`/`Nh+` duration, `frog`)
- [x] Task complete / undo complete
- [x] Task delete, edit modal
- [x] Duration cycling, points cycling
- [x] Priority paint tool, right-click priority set
- [x] Drag and drop (day view zones, week view, day-of-week tabs)
- [x] Context menu (right-click task)
- [x] Focus task, spotlight zone
- [x] Focused/active task unfocuses when completed or dragged to frogs
- [x] Timer (active, open-ended, countdown, countup)
- [x] Daily toggle, reorder, add/edit/delete
- [x] Score bar updates on task/daily completion
- [x] Close Day / Reopen Day (idempotent — safe to close→reopen→close)
- [x] XP gain and level up overlay
- [x] Week view (7-day grid, navigation)
- [x] Stats — progression cards, XP bar, activity heatmap
- [x] Stats — adaptive points bar chart (first-tracked-day window)
- [x] Stats — Balance section: radar chart (5 axes, no rings, colored dots + labels)
- [x] Stats — Balance section: weekly rhythm bars (Mon–Sun, tier-colored)
- [x] Stats — adaptive 60-day trend line chart (polylines + isolated dots)
- [x] Stats — daily consistency
- [x] Full backup export / import
- [x] Tasks-only export (unfinished tasks, `maya_os_tasks_v1` format)
- [x] Tasks-only import (merge/append, fresh IDs, no replace)
- [x] No hardcoded seed tasks after Clear All
- [x] Default dailies re-seeded after Clear All
- [x] Data persists across page reload

### Not yet verified
- [ ] Frog section right-click complete/undo
- [ ] Core tasks collapse toggle persists across navigation
- [ ] Level up overlay fires correctly on exact level threshold
- [ ] v4→v5 migration (needs old localStorage data)
- [ ] AssignPopup positioning on small viewports

---

## Known issues / quirks
- `npm` and `npx` not in PATH in Claude Code Preview environment. Launch config uses absolute path to `node.exe` — see `.claude/launch.json`.
- `confirm()` intentionally never used — blocked in iframes, bad UX. All destructive actions are immediate.
- Vite HMR can corrupt store listeners after many rapid saves in one session — hard reload fixes it (not a production issue).
- Reference file `../maya-os-mini-reference.html` was deleted from the repo (git shows it as deleted). CLAUDE.md still references `../maya-os-reference.html` (different filename) — both are stale. Use SPEC.md as behavior reference going forward.

---

## What to work on next
Do NOT implement without user direction:
1. Supabase backend (migration path in ARCHITECTURE.md)
2. TypeScript migration
3. Mobile layout
4. Task history / archive
5. Weekly review mode
6. Anything from TODO.md (user-managed — do not touch without direction)

## Source of truth priority
1. **HANDOFF.md** — current status, deviations, known issues
2. **CLAUDE.md** — rules, working process, gotchas
3. **ARCHITECTURE.md** — file structure, patterns, store API, reference material
4. **SPEC.md** — feature behavior intent (may lag behind implementation slightly)
