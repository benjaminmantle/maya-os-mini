# Maya OS — Handoff

## Status
**Maya OS: Phase 6 complete.** Fully functional. All docs current.
**Portal Shell: Complete.** Bubble + launcher working. Maya and Vault switch cleanly.
**Vault: Step 7 + UI polish + 5 major features + DB improvements + Showcase overhaul (4 rounds) + Timeline/Era system complete.** 8 characters with 47 columns of data. Full interactive skeleton with local/mock mode. Awaiting Supabase setup to persist data.
**CosmiCanvas: Spec complete, not yet implemented.** See WHITEBOARD_SPEC.md for full spec. Excalidraw-inspired infinite canvas. Ready for Phase 1.

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
- **Day View** — date nav, score block (points/dailies bars, workout toggle, carry-forward, close/reopen day), fasting widget (auto-timer, break button), frogs section, spotlight/focus zone, core tasks (priority paint, P/T/G sort, quick-add, bump buttons, hide/show, ↩ backlog button), done section
- **Sidebar** — Dailies tab (color-coded dots, drag reorder), Backlog tab, Maya tab (star rating, quick-add)
- **Maya task system** — `priority: 'maya'` tasks; star rating (1–3 stars); completion via `task.done`; drag to DayView = scheduled; grouped by star level with hi/md/lo tasks in DayView
- **Carry-forward** — `↺ N` button; moves past non-done tasks (including maya tasks) to today; preserves isFrog status
- **Drag and drop** — all zones; group integrity enforced; sandwich recolor; day-tab drag
- **Timer** — countdown / open-ended / countup; focus vs start distinction
- **Week View** — 7-day grid, drag to reschedule, click to navigate
- **Stats View (Backend tab)** — progression cards, XP bar, workout stats, fasting stats (streak, ring chart), heatmap, bar chart, radar (6-axis hexagon), weekly rhythm, trend line, daily consistency, fasting config (eating window), export/import
- **Scoring** — 6 tiers, XP awards, streak multiplier, +8 XP habit bonuses (workout + fasting), idempotent close/reopen, momentum
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

### CosmiCanvas (not started)
- [x] WHITEBOARD_SPEC.md — full spec with file structure, element model, render architecture, 5 phases
- [x] CLAUDE.md updated — app isolation rules, critical rules, gotchas, key files
- [ ] Phase 1 — Canvas + camera + IndexedDB storage + board picker
- [ ] Phase 2 — Drawing primitives + select tool + roughjs + undo/redo
- [ ] Phase 3 — Arrows + context menu + groups
- [ ] Phase 4 — Images + export (PNG/SVG/JSON) + minimap
- [ ] Phase 5 — Polish (alignment guides, keyboard help, additional render styles)

---

## Recent session changes

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
