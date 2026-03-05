# Maya OS — Architecture

## File Structure

```
maya-os/
├── CLAUDE.md                  ← Claude Code instructions (read first)
├── SPEC.md                    ← Full feature specification
├── ARCHITECTURE.md            ← This file
├── HANDOFF.md                 ← Current status, deviations, known issues
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx               ← React root mount, ToastProvider wrapper
    ├── App.jsx                ← View router, top-level layout, timer/focus state
    │
    ├── store/
    │   ├── store.js           ← ALL localStorage access, state management
    │   ├── migrations.js      ← Schema version migrations
    │   └── defaults.js        ← Default dailies, seed tasks
    │
    ├── styles/
    │   ├── tokens.css         ← CSS custom properties (colors, fonts, spacing)
    │   ├── global.css         ← Reset, body, scrollbar, shared utilities
    │   └── components/        ← Per-component CSS modules
    │       ├── TaskCard.module.css
    │       ├── DayView.module.css
    │       ├── Sidebar.module.css
    │       ├── WeekView.module.css
    │       ├── StatsView.module.css
    │       ├── Modals.module.css
    │       └── Topbar.module.css
    │
    ├── components/
    │   ├── Topbar.jsx             ← Level, streak, momentum chip
    │   ├── NavTabs.jsx            ← DAY / Mon–Sun day tabs / WEEK / SETTINGS
    │   │
    │   ├── day/
    │   │   └── DayView.jsx        ← Monolithic: date nav, score block, frogs,
    │   │                            spotlight, core tasks, done section
    │   │
    │   ├── sidebar/
    │   │   ├── Sidebar.jsx        ← Tab container (Dailies / Backlog)
    │   │   ├── DailiesPanel.jsx   ← Daily list, drag reorder, add form
    │   │   ├── DailyItem.jsx      ← Single daily row with actions
    │   │   └── BacklogPanel.jsx   ← Backlog task list, quick-add
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
    │   │                            adaptive bar chart (first-tracked-day window),
    │   │                            Balance section (radar + weekly rhythm bars),
    │   │                            60-day trend line chart, daily consistency,
    │   │                            tasks-only export/import, danger zone
    │   │
    │   └── shared/
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
        ├── parsing.js         ← parseInput() inline syntax parser
        ├── duration.js        ← parseDurMs(), fmtMs(), isOpenEnded(), DURATIONS
        └── colors.js          ← todColor() daily dot color interpolation
```

---

## State Ownership

| State | Lives in | Why |
|---|---|---|
| All persisted data (tasks, dailies, profile, days) | `store.js` | Single seam for future DB migration |
| Active timer (`activeTaskId`, `activeStart`) | `App.jsx` local state | Not persisted — resets on reload |
| Focused task (`focusedTaskId`) | `App.jsx` local state | Ephemeral UI state |
| Current view (`view`) | `App.jsx` local state | Navigation state |
| Week nav date (`weekNavDate`) | `App.jsx` local state | Passes `initialDate` to DayView on week→day nav |
| Day focus date (`focusDate`) | `DayView.jsx` local state | Which day is being viewed |
| Quick-add input, modals, context menus | `DayView.jsx` / `BacklogPanel.jsx` | Local UI state |
| Toast notifications | `Toast.jsx` context | Global but ephemeral |

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
export function moveTask(draggedId, targetId, before)
export function sortTasksForView(date, field, dir)

// ── Daily mutators ────────────────────────────────────────
export function saveDailies(dailies)    // full replacement (for reorder)
export function saveDaily(daily)        // upsert
export function deleteDaily(id)
export function markDailyComplete(dailyId, date, done)

// ── Day mutators ──────────────────────────────────────────
export function closeDay(date)          // scores day, awards XP, stores scoreRecord delta
export function reopenDay(date)         // reverses XP/streak delta via scoreRecord
export function setFrogsComplete(date, done)
export function toggleWorkout(date)
export function resetToday()

// ── Settings ──────────────────────────────────────────────
export function setTarget(n)
export function exportData()            // full state → JSON string
export function importData(json)        // full replace
export function exportTasks()           // unfinished tasks only → maya_os_tasks_v1 JSON string
export function importTasks(json)       // merge/append with fresh IDs; returns count or false
export function clearAll()              // wipes state; re-seeds DEFAULT_DAILIES, empty tasks

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

---

## Quick-Add Syntax

Parser lives in `utils/parsing.js`. Shared by Day view and Backlog. All tokens optional, order-independent:

| Token | Field | Example |
|-------|-------|---------|
| `!hi`/`!h`/`!1` | priority: 'hi' | `!1` |
| `!md`/`!m`/`!2` | priority: 'md' | `!2` |
| `!lo`/`!l`/`!3` | priority: 'lo' | `!3` |
| `@N` | pts (0/0.5/1/2/3) | `@2`, `@0.5` |
| `Nh`/`Nm` | timeEstimate | `2h`, `45m` |
| `Nh+`/`Nm+` | open-ended duration | `3h+` |
| `frog` | isFrog: true | |
| remaining text | name | |

Defaults: pts=2, time=null, priority=null, isFrog=false.

---

## Priority System

`priority: 'hi' | 'md' | 'lo' | null` — gives task card a colored left border and tinted background.

Override order: frog (green) > active (green) > focused (gold) > priority color.

Set via: quick-add syntax, right-click context menu, or priority paint tool in Core Tasks toolbar.

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
`expForLevel(n) = round(200 × 1.4^(n-1))` — XP to reach level n from n-1.
- Level 2: 280 XP, Level 5: ~1,075 XP, Level 10: ~5,900 XP
- 20 levels total. The while-loop in `closeDayScoring` handles multi-level-ups in one close.

### Idempotent day scoring
`closeDay(date)` stores a `scoreRecord` delta (expDelta, streakIncremented, longestBefore, perfectDelta) on the DayRecord. `reopenDay(date)` reads and precisely reverses it. Prevents inflation from close → reopen → re-close cycles.

### StatsView pattern
`StatsView.jsx` calls `scoreDay(date, fakeState)` inline with `fakeState = { days, tasks, dailies, target }`. No separate hook. Used for heatmap, bar chart, radar axes, weekly rhythm bars, and trend lines. All chart data computed inline — no extraction into hooks.

---

## CSS Strategy

CSS Modules for component-scoped styles. Global tokens in `tokens.css` imported once in `main.jsx`. No Tailwind — custom aesthetic (glows, gradients, grid texture) fights utility classes.

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
