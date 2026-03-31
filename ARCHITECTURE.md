# Maya OS — Architecture

## File Structure

```
maya-os-mini/               ← repo root (.git lives here)
├── CLAUDE.md                  ← Claude Code instructions (read first)
├── SPEC.md                    ← Maya feature specification
├── ARCHITECTURE.md            ← This file (Maya + Shell)
├── VAULT_SPEC.md              ← Vault feature specification
├── VAULT_ARCHITECTURE.md      ← Vault file tree, store API, patterns
├── PORTAL_SPEC.md             ← Shell/bubble spec
├── HANDOFF.md                 ← Current status, verification checklist
├── TODO.md                    ← User-managed task list
├── README.md
├── .gitignore
├── .env.local                 ← Supabase keys (never committed)
├── package.json
├── vite.config.js
├── index.html
└── src/
        ├── main.jsx               ← React root mount, ToastProvider, renders Shell
        ├── Shell.jsx              ← Portal bubble + app launcher (wraps all apps)
        ├── App.jsx                ← Maya: view router, top-level layout, timer/focus state
        │
        ├── vault/                 ← Vault app (see VAULT_ARCHITECTURE.md for full tree)
        │   └── VaultApp.jsx       ← Vault root component
        │
        ├── store/
        │   ├── store.js           ← ALL localStorage access, state management
        │   ├── migrations.js      ← Schema version migrations
        │   └── defaults.js        ← Empty-state defaults (fresh install starts blank)
        │
        ├── styles/
        │   ├── tokens.css         ← CSS custom properties (colors, fonts, spacing)
        │   ├── global.css         ← Reset, body, scrollbar, shared utilities
        │   └── components/        ← Per-component CSS modules
        │       ├── TaskCard.module.css
        │       ├── DayView.module.css
        │       ├── Sidebar.module.css
        │       ├── ProjPanel.module.css
        │       ├── WeekView.module.css
        │       ├── StatsView.module.css
        │       ├── Modals.module.css
        │       ├── ContribHeatmap.module.css
        │       ├── Topbar.module.css
        │       └── Shell.module.css
        │
        ├── components/
        │   ├── Topbar.jsx             ← Level, streak, momentum chip; SKIN theme picker dropdown
        │   ├── NavTabs.jsx            ← DAY / Mon-Sun day tabs / WEEK / BACKEND
        │   │
        │   ├── day/
        │   │   └── DayView.jsx        ← Monolithic: date nav, score block, frogs,
        │   │                            spotlight, core tasks, done section
        │   │
        │   ├── sidebar/
        │   │   ├── Sidebar.jsx        ← Tab container (Day / Tasks / Proj / Idea)
        │   │   ├── DailiesPanel.jsx   ← Daily list, drag reorder, add form
        │   │   ├── DailyItem.jsx      ← Single daily row with actions
        │   │   ├── BacklogPanel.jsx   ← Backlog task list, quick-add (excludes proj+idea)
        │   │   ├── ProjPanel.jsx       ← Project task backlog, quick-add, star rating
        │   │   ├── IdeaPanel.jsx      ← Idea task backlog, quick-add, star rating (dark green)
        │   │   └── FoodItem.jsx       ← Food log item card (inline edit, delete)
        │   │
        │   ├── task/
        │   │   ├── TaskCard.jsx       ← Full task card (all contexts)
        │   │   ├── TaskEditModal.jsx  ← Edit modal (name, pts, time, schedule, frog)
        │   │   └── AssignPopup.jsx    ← Date assignment popup (📅 button)
        │   │
        │   ├── week/
        │   │   └── WeekView.jsx       ← 7-day grid with drag-to-reschedule
        │   │
        │   ├── stats/
        │   │   └── StatsView.jsx      ← Progression cards, XP bar, activity heatmap,
        │   │                            GitHub-green contributions heatmap,
        │   │                            adaptive bar chart (first-tracked-day window),
        │   │                            Balance section (radar + weekly rhythm bars),
        │   │                            60-day trend line chart, daily consistency,
        │   │                            tasks-only export/import, danger zone
        │   │
        │   └── shared/
        │       ├── ContribHeatmap.jsx ← GitHub-style green contributions heatmap (reusable)
        │       ├── ContextMenu.jsx    ← Generic positioned context menu
        │       ├── Modal.jsx          ← Generic modal overlay wrapper
        │       ├── Toast.jsx          ← Bottom toast notifications (ToastProvider + useToast)
        │       └── LevelUpOverlay.jsx ← Fullscreen level up celebration
        │
        ├── hooks/
        │   ├── useStore.js        ← React hook wrapping store, triggers re-renders
        │   ├── useTimer.js        ← Active task timer (setInterval, cleanup)
        │   └── useContextMenu.js  ← Context menu positioning and state
        │
        └── utils/
            ├── dates.js           ← today(), addDays(), dayLabel(), getWeekDays(), uid()
            ├── scoring.js         ← scoreDay(), closeDayScoring(), calcMomentum(), expForLevel(), TITLES
            ├── parsing.js         ← parseInput() inline syntax parser; applyEmDash() for -- → — conversion
            ├── duration.js        ← parseDurMs(), fmtMs(), isOpenEnded(), DURATIONS
            └── colors.js          ← todColor(i, n, theme?) daily dot color interpolation;
                                       TOD_COLORS (neon, default) + TOD_COLORS_KRAFT (ink-on-parchment)
```

---

## State Ownership

| State | Lives in | Why |
|---|---|---|
| All persisted data (tasks, dailies, profile, days, settings) | `store.js` | Single seam for future DB migration |
| Active timer (`activeTaskId`, `activeStart`) | `App.jsx` local state | Not persisted — resets on reload |
| Focused task (`focusedTaskId`) | `App.jsx` local state | Ephemeral UI state |
| Current view (`view`) | `App.jsx` local state | Navigation state |
| Week nav date (`weekNavDate`) | `App.jsx` local state | Passes `initialDate` to DayView on week→day nav |
| Day focus date (`focusDate`) | `DayView.jsx` local state | Which day is being viewed |
| Quick-add input, modals, context menus | `DayView.jsx` / `BacklogPanel.jsx` | Local UI state |
| Toast notifications | `Toast.jsx` context | Global but ephemeral |
| Active shell app (`activeApp`) | `Shell.jsx` local state | Persisted to `localStorage.maya_active_shell_app`; default 'maya' |
| Launcher open state | `Shell.jsx` local state | Ephemeral UI state |

**Rule**: Survives page reload → store. Shared across views → App.jsx. Purely local UI → the component.

---

## Store API

`store.js` is the single source of truth. Holds state in memory, syncs to localStorage. Components never call `localStorage` directly.

```js
// ── Getters ──────────────────────────────────────────────
export function getState()              // full snapshot (shallow copy)
export function getTasks()
export function getTasksForDate(date)
export function getDailies()
export function getDayRecord(date)      // NOTE: side-effects — initializes missing records
export function getProfile()
export function getTarget()
export function getFrogsComplete(date)

// ── Task mutators ─────────────────────────────────────────
export function saveTask(task)          // upsert
export function deleteTask(id)
export function updateTask(id, patch)
export function markTaskComplete(taskId, date, done)
export function markSpecialDone(taskId, done) // unified proj/idea completion: sets task.done,
                                             // writes/removes from dayRecord.cIds,
                                             // auto-assigns scheduledDate=today() if unscheduled
export function moveTask(draggedId, targetId, before)
export function sortTasksForView(date, field, dir, specialPri)
                                // fields: 'pts', 'dur', 'mgrp' (5★→1★ by star rank), 'proj' (by project name), 'topic' (by topic name)
                                // specialPri: 'idea', 'proj', or falsy
export function carryForwardTasks(toDate)
                                // moves all past non-done scheduled tasks (including proj/idea) to toDate;
                                // preserves isFrog; returns count moved

// ── Daily mutators ────────────────────────────────────────
export function saveDailies(dailies)    // full replacement (for reorder)
export function saveDaily(daily)        // upsert
export function deleteDaily(id)
export function markDailyComplete(dailyId, date, done)

// ── Day mutators ──────────────────────────────────────────
export function closeDay(date)          // scores day, awards XP + habit bonuses, stores scoreRecord delta
export function reopenDay(date)         // reverses XP/streak delta via scoreRecord
export function setFrogsComplete(date, done)
export function toggleWorkout(date)
export function toggleFastBroken(date)  // flips fastBroken on day record
export function resetToday()

// ── Fasting ──────────────────────────────────────────────
export function getFastingSettings()           // returns { fastStart, fastEnd }
export function setFastingSettings(start, end) // validates HH:MM, saves to S.settings
export function isFastWindowPassed(date)       // true if eating window has closed for that date

// ── Food log ─────────────────────────────────────────────
export function addFoodItem(date, name, cal)    // pushes to days[date].foodLog
export function updateFoodItem(date, id, patch) // updates name/cal on a food item
export function deleteFoodItem(date, id)        // removes by id
export function toggleFoodDone(date)            // flips days[date].foodDone
export function getCalorieTarget()              // returns S.settings.calorieTarget
export function setCalorieTarget(n)             // sets calorie target in settings

// ── Settings ──────────────────────────────────────────────
export function setTarget(n)
export function exportData()            // full state → JSON string (v6)
export function importData(json)        // full replace
export function exportTasks()           // unfinished tasks only → maya_os_tasks_v1 JSON string
export function importTasks(json)       // merge/append with fresh IDs; returns count or false
export function clearAll()              // wipes state to blank (empty tasks, dailies, days)

// ── Pub/sub ───────────────────────────────────────────────
export function subscribe(fn)
export function unsubscribe(fn)
```

### Adding a new store function
```js
export function setMyNewField(value) {
  S.myField = value;
  save(); // persists + notifies all subscribers
}
```

### useStore hook
```js
export function useStore() {
  const [state, setState] = useState(getState())
  useEffect(() => {
    const handler = () => setState(getState())
    subscribe(handler)
    return () => unsubscribe(handler)
  }, [])
  return state
}
```
Components that call `useStore()` re-render automatically on any state change.

---

## Common Patterns

### Toast notifications
```jsx
import { useToast } from '../shared/Toast.jsx';

export default function MyComponent() {
  const showToast = useToast();
  // ...
  showToast('Thing done!');
}
```
`ToastProvider` wraps the entire app in `main.jsx`. Never add a second notification system.

### New design token
1. Add CSS variable to `src/styles/tokens.css` under `:root`
2. Use via `var(--my-token)` in CSS modules
3. Never hardcode hex values in component files

### New CSS module
```jsx
import s from './MyComponent.module.css'
// <div className={s.myClass}>
```
All color/spacing values must reference tokens.

---

## DayView Structure

`DayView.jsx` is intentionally monolithic — all day-view sections live in one file. Contains a `renderCard(task, showAssign=false)` helper:

```jsx
// showAssign=true for Core Tasks, false for Frogs/Done
{active.map(t => renderCard(t, true))}
{frogs.map(t => renderCard(t))}
```

Do not split into sub-components.

**Collapse state**: Both Core Tasks (`coreHidden`) and Done (`doneHidden`) have independent hide/show toggles. Both start `false`. Each section renders a `secRow` + `collapseBtn` header when items exist.

---

## Theme System

Six themes ordered dark → light: **Dark** (default), **Soft-Dark**, **Kraft**, **Vanilla**, **Lav-Light**, **Light**.

| Label | ID | Class on `<html>` |
|---|---|---|
| Dark | `dark` | *(none — `:root` default)* |
| Soft-Dark | `dim` | `theme-dim` |
| Kraft | `kraft` | `theme-kraft` |
| Vanilla | `vanilla` | `theme-vanilla` |
| Lav-Light | `light` | `theme-light` |
| Light | `white` | `theme-white` |

- Theme choice persisted to `localStorage.maya_theme`; loaded in `App.jsx` on mount
- `App.jsx` manages the active class on `document.documentElement`, removing all non-dark classes then adding the chosen one:
  ```js
  document.documentElement.classList.remove('theme-dim', 'theme-light', 'theme-vanilla', 'theme-kraft', 'theme-white');
  if (theme !== 'dark') document.documentElement.classList.add(`theme-${theme}`);
  ```
- Token overrides live in `tokens.css` as `html.theme-*` blocks — they override `:root` via higher specificity. No `!important` needed.
- **Kraft theme** — mid-tone parchment/document aesthetic. Key overrides: `--gold: #8c6200` (dark amber replaces neon yellow for contrast on tan), focused task strip `#f0c840`, daily dots use `TOD_COLORS_KRAFT` palette (ink-on-parchment: moss → teal → slate → indigo → violet → plum).
- **Topbar SKIN dropdown**: static chip button opens an absolutely-positioned menu (min-width: 150px). `overflow: hidden` was intentionally removed from `.topbar` to prevent clipping.
- **Multi-theme CSS selectors** — when a component style only applies to light-variant themes, use combined selectors:
  ```css
  :global(html.theme-light) .myClass,
  :global(html.theme-vanilla) .myClass,
  :global(html.theme-kraft) .myClass,
  :global(html.theme-white) .myClass { ... }
  ```
- **qa input opacity** — `.qaInput`, `.qaBtn`, and `.mayaBtn` use `color-mix(in srgb, var(--s2) 78%, transparent)` for background. This makes them slightly recessed/transparent across all themes proportionally, avoiding hardcoded per-theme overrides.
- Dark theme has no class on `<html>` — it is the `:root` default. Light-variant overrides must always be in named `html.theme-*` blocks, never in `:root`.

---

## Quick-Add Syntax

Parser lives in `utils/parsing.js`. Shared by Day view and Backlog. All tokens optional, order-independent:

| Token | Field | Example |
|-------|-------|---------|
| `@N` | pts (0/0.5/1/2/3) | `@2`, `@0.5` |
| `Nh`/`Nm` | timeEstimate | `2h`, `45m` |
| `Nh+`/`Nm+` | open-ended duration | `3h+` |
| `frog` | isFrog: true | |
| `★N` or `*N` | stars (1-5) | `★3`, `*5` |
| remaining text | name | |

`parseInput(raw)` returns `{ name, pts, time, isFrog, stars }`. Defaults: pts=0.5, time=null, isFrog=false, stars=0.

`parseIdeaInput(raw)` — lightweight parser for Idea panel input. Returns `{ name }` (strips whitespace only, no token extraction).

---

## Star Ranking System

All tasks use star ratings (1-5) instead of priority levels. Stars determine sort order and visual grouping in DayView.

### Ranking functions (`utils/taskPlacement.js`)

- `starRank(t)`: maps star count to sort rank — `5★→1, 4★→2, 3★→3, 2★→4, 1★→5` — used everywhere for consistent ordering
- `isSpecialPriority(p)`: returns true only for `'idea'`

### Positioning helpers

- `snapToStarZone(insertAt, zone, rank)` — finds correct position within a star-rank group
- `insertTopOfStarGroup(zone, rank)` — places task at TOP of its rank group
- `insertAtForStars(zone, stars)` — convenience wrapper combining star-to-rank + insert

### Task rules in DayView
- **Grouped by star level** — 5★ at top, 1★/0★ at bottom. No separate priority sections.
- **New scheduled tasks go to TOP of their star group** — both on drag-to-day and AssignPopup schedule.
- **Star change repositions to TOP of new star group** — `handleStarChange` uses `snapToStarZone`.
- Proj tasks excluded from the Backlog panel; shown only in the Proj sidebar tab and on the day if scheduled.
- Idea tasks never appear in DayView (not schedulable).
- In DayView, "Delete" for proj tasks becomes "Remove from day" (sets `scheduledDate=null`).

Override order: frog (green) > active (green) > focused (gold) > star color.

---

## Scoring & XP

### Day tiers
| Tier | Condition |
|------|-----------|
| perfect | pts ≥ target AND all dailies done |
| good | missed ≤1 pt OR ≤1 daily |
| decent | ≥70% combined |
| half | ≥50% |
| poor | ≥25% |
| fail | <25% |

### XP awards per close
perfect=100, good=78, decent=32, half=-5, poor=-18, fail=-30. Perfect streak multiplier up to 1.5× at 10+ days.

### Level formula
`expForLevel(n) = Math.round(19 * (n + 24) ** 1.15)` — XP to reach level n from n-1.
- Level 2: ~800 XP (~5 days perfect), Level 10: ~1,100 XP/level, Level 50: ~1.5 years total
- 100 levels total; ~5 years at perfect play (150 XP/day) to reach level 100
- 100 TITLES: 'Adrift' → 'Someone Who Never Stopped'
- Level cap enforced at 100: `while (level < 100 && exp >= expForLevel(level + 1))`
- The while-loop in `closeDayScoring` handles multi-level-ups in one close.

### Idempotent day scoring
`closeDay(date)` stores a `scoreRecord` delta (expDelta, streakIncremented, longestBefore, perfectDelta) on the DayRecord. `reopenDay(date)` reads and precisely reverses it. Prevents inflation from close → reopen → re-close cycles.

### StatsView pattern
`StatsView.jsx` calls `scoreDay(date, fakeState)` inline with `fakeState = { days, tasks, dailies, target }`. No separate hook. Used for heatmap, bar chart, radar axes, weekly rhythm bars, and trend lines. All chart data computed inline — no extraction into hooks.

---

## CSS Strategy

CSS Modules for component-scoped styles. Global tokens in `tokens.css` imported once in `main.jsx`. No Tailwind — custom aesthetic (glows, gradients, grid texture) fights utility classes.

**Em dash** — `applyEmDash(str)` in `parsing.js` converts `--` followed by any non-hyphen character to `—`. Applied in `onChange` on every name/title text input across DayView, DailiesPanel, BacklogPanel, ProjPanel, and TaskEditModal. Import and wire to any new name inputs.

---

## Migration Path to Real Backend

1. Replace `store.js` internals with API calls — keep all exported function signatures identical
2. Add optimistic updates where needed
3. `useStore` hook unchanged — components change zero lines
4. Add auth around `App.jsx`

Suggested: Supabase (Postgres + realtime + auth, generous free tier).

---

## Key Decisions

| Decision | Reason |
|----------|--------|
| Vite not Next.js | No SSR needed |
| CSS Modules not Tailwind | Custom aesthetic doesn't fit utility classes |
| Plain pub/sub store not Redux | Simpler, no boilerplate, easy to migrate |
| No TypeScript (initially) | Faster to port from JS prototype |
| Timer state not persisted | Resets on page load by design |
| No confirm() dialogs | Blocked in sandboxed iframes, bad UX |
| getDayRecord side-effect during render | Lazy init, no save() call — acceptable tradeoff |
| DayView monolithic | Matches reference HTML structure, avoids over-engineering |
| S and listeners on window (store.js) | Survives Vite HMR module re-evaluation; no-op in production |
