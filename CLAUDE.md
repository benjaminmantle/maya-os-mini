# Maya OS — Claude Code Instructions

## Project layout
```
maya-os-mini/        ← git root, Claude CWD — everything lives here
├── CLAUDE.md
├── HANDOFF.md
├── ARCHITECTURE.md
├── SPEC.md
├── TODO.md
├── package.json
└── src/
```
Docs and source are all at the same level. Source files are at `src/...`.

## What this project is
A personal productivity OS. Single-user, local-first, browser-based. No backend yet — all data in localStorage. Dark gamer/cyberpunk UI, gamified task system, minimal cognitive load.

## Tech stack
- Vite + React 18 (no Next.js)
- Plain CSS modules — custom design system, not Tailwind
- All data via centralized store (no direct localStorage in components)

---

## Working Process

- **Plan first.** Before any major feature or multi-part task, write a plan listing affected files and required changes. Wait for approval before touching anything.
- **Break it down.** Small, scoped steps. One at a time unless told to parallelize.
- **Subagents.** List which files each agent will touch before starting. No overlapping file ownership. Serialize any tasks that share files.
- **Stay in scope.** Never silently change behavior outside the current task. Flag adjacent issues — don't fix them.
- **Surface blockers.** Architectural decisions not covered here or in ARCHITECTURE.md require approval before proceeding.
- **Surgical edits.** Targeted changes over broad rewrites unless a rewrite is explicitly requested.
- **TODO.md is user-managed.** Never add, remove, reorder, or act on items in TODO.md unless explicitly directed. When told to work on a TODO item, mark it [x] when done — do not delete it.

---

## Documentation Maintenance

After any major feature or architectural change:
- Update **ARCHITECTURE.md** — file structure, new patterns
- Update **SPEC.md** — if behavior changed
- Update **CLAUDE.md** — if new conventions were established

**SPEC.md may be outdated.** Treat as reference only. Actual implemented behavior takes precedence.

---

## Critical Rules

**Store discipline** — ALL data access goes through `src/store/store.js`. No direct localStorage calls in components. This is the single seam for future DB migration.

**Aesthetic** — CSS variables in `src/styles/tokens.css` are the source of truth. No Tailwind, no hardcoded hex values. New colors get a token.

**No confirm() dialogs** — blocked in sandboxed iframes and bad UX. Destructive actions execute immediately. Prefer undo/reopen patterns.

**No placeholder text** — do not add placeholder attributes to task quick-add inputs.

**Preserve existing features** — read SPEC.md before modifying any feature. Don't silently remove behavior.

**Schema versioning** — localStorage key is `maya_os_v5`. Breaking schema changes must increment the version and add a migration in `src/store/migrations.js`.

---

## Known Gotchas & Traps

### renderCard as a map callback — CRITICAL
Never pass `renderCard` directly as a `.map()` callback — map passes `(item, index, array)` and index corrupts the `showAssign` param:
```jsx
// ❌ WRONG
{frogs.map(renderCard)}

// ✅ CORRECT
{frogs.map(t => renderCard(t))}
{active.map(t => renderCard(t, true))}
```

### getDayRecord side effect during render
`getDayRecord(date)` initializes missing day records by mutating `S.days[date]`. Intentionally does NOT call `save()`. Don't add `save()` — causes infinite render loops.

### today() uses local time — do not revert
`today()` in `dates.js` uses `getFullYear/getMonth/getDate` (local time), not `.toISOString().slice(0,10)` (UTC). User is in ET — UTC breaks after 8pm. Do not simplify.

### StatsView scoreDay pattern
`StatsView.jsx` calls `scoreDay(date, fakeState)` directly with `fakeState = { days, tasks, dailies, target }` assembled inline. Intentional — do not extract into a hook.

### scoreRecord — do not strip
`days[date].scoreRecord` stores the XP/streak delta from Close Day. `reopenDay()` reads it to reverse changes. Never strip or ignore this field.

### HMR stability (dev only)
`S` and `listeners` are stored on `window.__mayaS` and `window.__mayaListeners` so Vite HMR module re-evaluation doesn't wipe them. If UI still stops responding after many saves, hard reload fixes it. No effect in production.

### Drag-and-drop group integrity
Same-priority tasks must stay contiguous. The snap-to-boundary algorithm in `DayView.jsx` (`makeDrop('day')`) and `BacklogPanel.jsx` must not be removed.

### exportTasks / importTasks — IDs are always replaced on import
`importTasks(json)` assigns a fresh `uid()` and `createdAt` to every incoming task regardless of what's in the file. This prevents ID collisions when merging across instances. Do not attempt to preserve original IDs on import.

### Tasks-only import is additive, not replacing
`importTasks` merges into `S.tasks` — it never wipes existing tasks. `importData` (full backup) does a full replace. Keep these behaviors distinct.

### Maya task done state — single source of truth
`task.done` (boolean on the task object itself) is the completion flag for maya tasks — NOT `dayRecord.cIds`. Use `isDone(t)` in DayView: `t.priority === 'maya' ? (t.done ?? false) : dayRecord.cIds.includes(t.id)`. Never derive maya completion from cIds alone.

### markMayaDone — auto-schedules for scoring
`markMayaDone(taskId, done)` auto-assigns `scheduledDate = today()` + `_autoScheduled = true` when checking an unscheduled maya task, so it appears in the correct day's cIds for Close Day scoring. Reverses cleanly on uncheck. Do not call `updateTask` directly for maya completion.

### Maya tasks in DayView — unschedule, don't delete
In DayView, the delete action for maya tasks calls `updateTask(id, { scheduledDate: null })`, not `deleteTask`. The context menu label is "📅 Remove from day". Priority hi/md/lo items are hidden for maya tasks. The sandwich recolor guard must skip maya tasks (`prevPri !== 'maya' && draggedPri !== 'maya'`).

### Maya drag to DayView — linked copy, skip doMove
When a maya task is dragged into the DayView day zone, `makeDrop('day')` ONLY calls `updateTask({ scheduledDate: focusDate, isFrog: false })` — it does NOT call `doMove`. This is intentional: `doMove` would relocate the task in `S.tasks` between non-maya day tasks, breaking its position in the Maya panel. MayaPanel filters by `priority === 'maya' && !done` (no scheduledDate condition) so the task naturally appears in both views. Do not add `doMove` back for maya tasks in this path.

---

## Commands
```bash
npm run dev      # localhost:5173
npm run build
npm run preview
```
Run from the project root.

## Key files
- `src/App.jsx` — view routing, timer/focus state
- `src/store/store.js` — ALL data access
- `src/styles/tokens.css` — ALL design tokens
- `src/components/day/DayView.jsx` — main view (intentionally monolithic)
- `src/components/NavTabs.jsx` — navigation
- `src/hooks/useStore.js` — store subscription
- `src/utils/parsing.js` — quick-add syntax parser
- `src/utils/scoring.js` — XP, leveling, day tier logic

See ARCHITECTURE.md for full file tree, store API, patterns, and reference material.
