# Maya OS — Claude Code Instructions

## What this project is
A personal productivity OS. Single-user, local-first, browser-based. No backend yet — all data in localStorage. Dark gamer/cyberpunk UI, gamified task system, minimal cognitive load.

## Tech stack
- Vite + React 18 (no Next.js)
- Plain CSS modules — custom design system, not Tailwind
- All data via centralized store (no direct localStorage in components)

## Reference implementation
`../maya-os-reference.html` — read-only. If behavior is ambiguous and SPEC.md doesn't resolve it, match this file exactly.

---

## Working Process

- **Plan first.** Before any major feature or multi-part task, write a plan listing affected files and required changes. Wait for approval before touching anything.
- **Break it down.** Small, scoped steps. One at a time unless told to parallelize.
- **Subagents.** List which files each agent will touch before starting. No overlapping file ownership. Serialize any tasks that share files.
- **Stay in scope.** Never silently change behavior outside the current task. Flag adjacent issues — don't fix them.
- **Surface blockers.** Architectural decisions not covered here or in ARCHITECTURE.md require approval before proceeding.
- **Surgical edits.** Targeted changes over broad rewrites unless a rewrite is explicitly requested.

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

### HMR state corruption (dev only)
After many rapid saves, Vite HMR can partially reset the store's `listeners` Set — clicks stop updating UI with no JS errors. Hard reload fixes it. Not a production issue.

### Drag-and-drop group integrity
Same-priority tasks must stay contiguous. The snap-to-boundary algorithm in `DayView.jsx` (`makeDrop('day')`) and `BacklogPanel.jsx` must not be removed.

---

## Commands
```bash
npm run dev      # localhost:5173
npm run build
npm run preview
```
Run from inside `maya-os/`.

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
