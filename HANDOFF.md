# Maya OS — Handoff

## Status
**Phase 5 complete.** App is fully functional. All docs are current.

---

## Orientation — read these before anything else

1. **CLAUDE.md** — working rules, critical gotchas, commands. Follow it exactly.
2. **ARCHITECTURE.md** — file structure, store API, patterns.
3. **SPEC.md** — full feature behavior reference.
4. **TODO.md** — user-managed. Do not touch without explicit direction.

**Do not start coding** until the user asks you to. Orient yourself, then wait.

---

## How to run
```bash
cd maya-os
npm run dev    # localhost:5173
```
User runs this in their own terminal. Do not use `preview_*` tools to verify changes — the embedded preview browser doesn't maintain connection on Windows. Do code review instead.

---

## What's implemented

- **Day View** — date nav, score block (points/dailies bars, workout toggle, carry-forward button, close/reopen day), frogs section, spotlight zone (focus/active task), core tasks (priority paint tool, P/T/G sort, quick-add, bump buttons, hide/show), done section
- **Sidebar** — Dailies tab, Backlog tab, Maya tab (each with quick-add and sort buttons)
- **Maya task system** — `priority: 'maya'` tasks; star rating (1–3); completion via `task.done` (not cIds); drag to DayView = linked copy (scheduledDate only, skips doMove); drag to Backlog = rejected
- **Carry-forward** — `↺ N` button; moves past non-done non-maya scheduled tasks to today; today-only
- **Drag and drop** — between all zones; group integrity enforced; sandwich recolor; day-tab drag
- **Timer** — countdown / open-ended / countup; focus vs start distinction
- **Week View** — 7-day grid, drag to reschedule, click to navigate
- **Stats View** — progression cards, XP bar, activity heatmap, adaptive bar chart, radar chart, weekly rhythm, trend line, daily consistency, export/import
- **Scoring** — 6 tiers, XP awards, streak multiplier, idempotent close/reopen, momentum
- **Leveling** — 100 levels, `19*(n+24)^1.15` formula, 100 titles
- **Quick-add syntax** — `!hi/!md/!lo`, `@N`, `Nh`/`Nm`, `frog`; order-independent
- **Export/import** — full backup and tasks-only (`maya_os_tasks_v1`); import is always additive with fresh IDs
- **HMR stability** — `S` and `listeners` on `window.__mayaS`/`window.__mayaListeners`

---

## Not yet verified
- [ ] Frog section right-click complete/undo
- [ ] Core tasks collapse toggle persists across navigation
- [ ] Level up overlay fires at exact threshold
- [ ] v4→v5 migration
- [ ] AssignPopup positioning on small viewports

---

## Known issues
- `sortTasksForView(null, ...)` matches all unscheduled tasks including unscheduled maya tasks — sorting Backlog can silently reorder the maya array position. Not a visible bug currently.
- `handleGoToDay` and `handleSwitchDay` in App.jsx are identical — minor dead code.
- `onDoubleClick` prop received by BacklogPanel but never called.
- `priRank`, `snapToZone`, `insertAtForPri`, `insertTopOfGroup`, `doMove` are defined identically in both DayView.jsx and BacklogPanel.jsx — candidate for extraction to `src/utils/taskPlacement.js` if a cleanup pass is wanted.

---

## Do not start without direction
- Supabase / any backend
- TypeScript migration
- Mobile layout
- Task history / archive
- Weekly review mode
- Anything in TODO.md
