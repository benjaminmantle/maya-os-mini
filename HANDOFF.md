# Maya OS — Handoff Document

## Current status
**Migration complete. Post-migration features added.** The single-file HTML app has been fully ported to Vite + React 18. Dev server runs on `localhost:5173`. All core features working, plus several features added beyond the original reference implementation.

## Before you do anything
Read the **Working Process** section in CLAUDE.md. Plan before executing, stay in scope, surface blockers before touching files.

## How to run
```bash
cd maya-os
npm run dev    # starts at localhost:5173
```
Or use `preview_start` with the `dev` config in `.claude/launch.json` (uses full node.exe path to bypass PATH issues on Windows).

## What was built

### Phase 1 — React migration
Full port of `../maya-os-reference.html`. Key decisions:
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

**Stats view infographics:**
- XP progress bar (current XP / XP to next level, with next title preview)
- Activity heatmap — 13-week GitHub-style grid, cells colored by day tier
- 30-day points bar chart — bars colored by tier, target line at 100%

**Leveling formula adjusted** — `expForLevel(n) = round(200 × 1.4^(n-1))`. Level 2 requires ~280 XP (~3 perfect days). Previous formula was too easy (base 100).

## Deviations from earlier ARCHITECTURE.md plans
These files were previously planned but do NOT exist (DayView is monolithic instead):
- `ScoreBlock.jsx`, `FrogSection.jsx`, `SpotlightZone.jsx`, `CoreTasks.jsx`, `DoneSection.jsx`, `useDrag.js`

## Verification checklist

### Working ✓
- [x] All views render (Day, Week, Stats)
- [x] Quick-add inline syntax (`@N` pts, `!hi/md/lo` priority, `Nh`/`Nm`/`Nh+` duration, `frog`)
- [x] Task complete / undo complete
- [x] Task delete, edit modal
- [x] Duration cycling, points cycling
- [x] Priority paint tool, right-click priority set
- [x] Drag and drop (day view zones, week view)
- [x] Context menu (right-click task)
- [x] Focus task, spotlight zone
- [x] Timer (active, open-ended, countdown, countup)
- [x] Daily toggle, reorder, add/edit/delete
- [x] Score bar updates on task/daily completion
- [x] Close Day / Reopen Day (idempotent — safe to close→reopen→close)
- [x] XP gain and level up overlay
- [x] Week view (7-day grid, navigation)
- [x] Stats view — progression cards, XP bar, activity heatmap, 30-day bar chart, daily consistency, danger zone
- [x] Export / Import data
- [x] Data persists across page reload

### Not yet verified
- [ ] Frog section right-click complete/undo
- [ ] Core tasks collapse toggle persists across navigation
- [ ] Level up overlay fires correctly on exact level threshold
- [ ] v4→v5 migration (needs old localStorage data)
- [ ] AssignPopup positioning on small viewports

## Known issues / quirks
- `npm` and `npx` not in PATH in Claude Preview environment. Launch config uses absolute path to `node.exe`.
- `confirm()` intentionally never used — blocked in iframes, bad UX. All destructive actions are immediate.
- Vite HMR can corrupt store listeners after many rapid saves in one session — hard reload fixes it (not a production issue).

## What to work on next
Do NOT implement without user direction:
1. Supabase backend (migration path in ARCHITECTURE.md)
2. TypeScript migration
3. Mobile layout
4. Task history / archive
5. Weekly review mode

## Source of truth priority
1. **HANDOFF.md** — current status, deviations, known issues
2. **CLAUDE.md** — rules, working process, gotchas
3. **ARCHITECTURE.md** — file structure, patterns, store API, reference material
4. **SPEC.md** — feature behavior intent (may be outdated — not ground truth)
5. **`../maya-os-reference.html`** — original implementation (read-only, ultimate behavior reference)
