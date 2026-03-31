# Maya OS — Feature Specification

## Overview
A daily task and habit tracking system with light gamification. Philosophy: reduce cognitive overhead, reward consistency, make it feel like a personal command center rather than a sterile productivity tool.

---

## Data Models

### Task
```ts
{
  id: string             // random uid
  name: string
  pts: 0 | 0.5 | 1 | 2 | 3  // point value; default 2
  timeEstimate: string | null  // e.g. "2h", "45m", "2h+", "∞", null
  isFrog: boolean        // high-priority task to tackle first
  priority: 'idea' | null  // null = normal task; 'idea' = idea (not schedulable)
  mayaPts: number        // star rating 1–5 (default 1)
  scheduledDate: string | null  // YYYY-MM-DD or null (= backlog)
  createdAt: string      // ISO timestamp
  project: string | null // project name or null
  // Idea-only fields (only present when priority === 'idea'):
  done?: boolean         // unified completion state (single flag; not dayRecord-derived)
  topic?: string | null  // topic name (ideas only)
}
```

### Daily
```ts
{
  id: string
  name: string
  type: 'general' | 'exercise' | 'health' | 'focus' | 'admin'
}
```

### DayRecord (keyed by YYYY-MM-DD in S.days)
```ts
{
  cIds: string[]        // completed task IDs
  dIds: string[]        // completed daily IDs
  closed: boolean       // day has been "closed" (scored)
  workout: boolean      // workout logged for this day
  scoreRecord?: {       // stored when day is closed; reversed on reopen
    expDelta: number
    streakIncremented: boolean
    longestBefore: number
    perfectDelta: number
  } | null
}
```

### Profile
```ts
{
  level: number
  exp: number
  streak: number     // current perfect-day streak
  longest: number    // longest streak ever
  perfect: number    // total perfect days
  momentum: 'rising' | 'stable' | 'slipping'
}
```

### Top-level persisted state (localStorage key: `maya_os_v6`)
```ts
{
  tasks: Task[]
  dailies: Daily[]
  days: Record<string, DayRecord>
  profile: Profile
  target: number        // daily point target, default 10
  frogsComplete: Record<string, boolean>  // date → done
  settings: { ... }     // fasting times, frogsEnabled, ideaTopics, etc.
}
```

---

## Views

### Day View (default)
Two-column layout: main column left, sidebar right.

**Main column (top to bottom):**
1. Date navigation — prev/next arrows, date display, "Today" jump button
2. Score block — points progress bar, dailies progress bar, Workout toggle, Carry Forward button (when applicable), Close Day button
3. Frogs section — drop zone for frog tasks; right-click section to mark complete (dims + green ✓); toggleable
4. Spotlight zone — appears only when a task is focused or active; shows full interactive task card with label "◆ Up Next" or "▶ Running"
5. Core Tasks — toolbar (sort buttons: P pts / T duration / G group), quick-add input, task list, hide/show collapse toggle
6. Done section — completed tasks for the day (auto-shown when any exist); has its own hide/show collapse toggle

**Sidebar (tabbed, 4 tabs):** Each tab has its own active accent color — Day=teal, Tasks=gold, Proj=project color, Idea=green.
- **Day tab** (default, teal accent) — list of daily habits; click to toggle completion; hover shows edit/delete buttons; drag to reorder; right-click for context menu; "+ add daily" collapsed button at bottom
- **Tasks tab** (gold accent) — unscheduled normal tasks; quick-add input; assign button per task; sort buttons: P / T / G (star group: 5★→4★→3★→2★→1★)
- **Proj tab** (project color accent) — tasks grouped by project; project management
- **Idea tab** (green accent) — Idea tasks (`priority === 'idea'`) that are not yet done; quick-add (textarea, Enter submits, Shift+Enter = newline); star rating (1–5) per task; topic combobox; sort buttons: T / G; dropping non-idea tasks here is silently rejected

### Week View
7-day grid. Each day shows: weekday, date number, points progress bar, task snippets (up to 4), dailies completion count. Drag tasks to reschedule. Click day to navigate to it in Day view.

### Stats View (Backend tab)
- **Progression** cards: level, title, current streak, longest streak, perfect days, days tracked, frogs done, avg pts/day
- **XP progress bar** — shows current XP toward next level with level name preview; "★ max level" at level 100
- **Workout** stats: total workouts, current workout streak
- **Activity heatmap** — 13-week GitHub-style grid (Mon–Sun columns); cells colored by day tier for any day with recorded data; future cells hidden; tier legend below
- **Adaptive points bar chart** — window starts from first tracked day (up to 30-day max); grows as history builds. Title shows "Points — Last N Days". Bars colored by tier; dotted target line at top; no stub bars on empty days
- **Balance — Last 30 Days** — two charts side by side:
  - *Radar chart* (character-stats style): 5 axes — TASKS, DAILIES, WORKOUT, FROGS, DISCIPLINE; single filled gold polygon (no concentric rings); colored dot at each axis tip; axis labels outside; legend below. No "web" look.
  - *Weekly Rhythm*: 7 bars (Mon–Sun), height = avg day-score fraction for that weekday across all history; tier-colored; day label below each bar
- **Adaptive trend line chart** — 60-day adaptive window (same start logic as bar chart); SVG polylines for TASKS, DAILIES, FROGS, XP metrics; isolated single-point days render as dots; legend below
- **Daily Consistency** — per-daily completion rate bar (red/gold/green) + current streak + total completions count
- Point target setting
- **Export / Import data** — two pairs of buttons:
  - *Full backup*: exports complete state as JSON; import is a full replace
  - *Tasks only (unfinished)*: exports unfinished tasks as `{ version: 'maya_os_tasks_v1', tasks: [...] }`; import merges/appends with fresh IDs (no replace, no history carried over)
- Danger zone: Reset Today, Clear All Data (Clear All re-seeds DEFAULT_DAILIES, no dummy tasks)

---

## Task Interactions

### Quick add (inline syntax parser)
All tokens are optional and order-independent. Unrecognized text becomes the task name.

| Token | Meaning | Examples |
|-------|---------|---------|
| `!1` through `!5` | Star rating (1–5) | `!3`, `!5` |
| `@N` | Points (0, 0.5, 1, 2, 3) | `@2`, `@0.5` |
| `Nh` / `Nm` | Duration | `2h`, `45m`, `1hr`, `30min` |
| `Nh+` / `Nm+` | Open-ended duration | `2h+`, `45m+` |
| `frog` | Frog flag | anywhere in string |

Defaults: pts=0.5, time=null, mayaPts=1, isFrog=false.

**Em dash**: Typing `--` followed by any non-hyphen character (space, letter, etc.) automatically converts to `—`. Applies in all task name inputs, daily name inputs, and edit modals. Handled by `applyEmDash()` in `parsing.js`.

### Task card anatomy
- Checkbox — toggles completion; idea tasks call `markSpecialDone()` which uses `task.done` as the single source of truth
- Task name
- Star rating — 5 clickable stars (☆); stored as `task.mayaPts` (1–5); shown on ALL card types
- Points badge (0 / 0.5 / 1 / 2 / 3) — click to cycle; colors: dim(0) / silver(0.5) / yellow(1) / orange(2) / red(3); hidden on idea cards
- Duration badge — click to cycle through presets; blue when set, grey when blank; hidden on idea cards
  - Presets: null → 15m → 30m → 45m → 1h → 1.5h → 2h → 3h → 4h → ∞ → null
- `+` toggle badge — appears when duration is set (not ∞); toggles open-ended mode (appends `+` to duration string)
- Project chip — shown on non-idea cards; displays project name in project's color
- Topic chip — shown on idea cards; displays topic name in topic's color
- Assign (📅) button — on core task list only; opens date picker popup
- Delete ✕ button
- Edit ✎ button (opens modal)

**Card coloring:** Normal tasks = teal tint. Project tasks = project's color tint. Idea tasks = green tint. Overridden by frog (green), focused (gold), active (green).

### Timer behavior (when task is Started)
- Fixed (`2h`) — countdown, turns red when over
- Open-ended (`2h+`) — countdown to target, then flips to green `✓ +mm:ss`
- Infinite (`∞`) — pure countup, neutral gold
- No duration — pure countup

### Focus vs Start
- **Double-click** or right-click → Focus: moves task to spotlight zone, gold highlight, no timer
- **Right-click → Start**: moves to spotlight, starts timer, green highlight
- Only one task can be focused or active at a time. Starting clears focus. Focusing stops active timer.
- Completing (checking) a focused/active task removes it from spotlight and moves it to Done.

### Right-click context menu (tasks)
**Normal tasks:**
- ▶ Start / ⏹ Stop
- ◆ Focus / ◇ Unfocus
- 🐸 Frog toggle
- ✎ Edit
- *(separator)*
- 5 clickable stars row (set `mayaPts`)
- *(separator)*
- ✕ Delete

**Idea tasks:**
- 5 clickable stars row
- 📅 Remove from day (unschedules only)

### Drag and drop
- Drag tasks between: frog zone, core tasks zone, backlog zone, day-of-week tabs in nav
- Dropping into frogs sets isFrog=true and scheduledDate=focusDate
- Dropping into core tasks sets isFrog=false, scheduledDate=focusDate
- Dropping into backlog sets scheduledDate=null, isFrog=false
- Dropping onto a day tab sets scheduledDate=that date
- Idea tasks (`priority === 'idea'`) cannot be dragged out of the Idea tab; DayView drop handlers reject them
- Week view: drag task to day column to reschedule
- **Group integrity**: same-star tasks stay as contiguous groups; dragging into the middle of a group snaps to the nearest group boundary
- **Frog zone styling**: dragging into frogs always shows green styling regardless of card color

### Edit modal
**Normal tasks:** Star rating (5 clickable stars), Name, Points, Time, Project dropdown, Schedule (Backlog + next 7 days), Frog toggle.
**Idea tasks:** Name + Stars only.

---

## Navigation

### Nav tabs
`DAY | Mo2 | Tu3 | We4 | Th5 | Fr6 | Sa7 | Su8 | WEEK | BACKEND`

- Day-of-week tabs (Mon–Sun of current ISO week) between DAY and WEEK
- Today's tab highlighted in gold
- Clicking a day tab switches to Day view showing that date
- Dragging a task onto a day tab sets its scheduledDate to that date

---

## Dailies

- Ordered list (user-defined order via drag)
- Dot colors interpolate across 8-color ramp (green → purple) based on position in list
- Click dot or name to toggle completion for current day
- Hover → edit ✎ / delete ✕ buttons
- Right-click → context menu (Edit / Delete)
- Edit modal: name + type
- "+ add daily" collapsed button at bottom of list expands inline form
- **Order and edits are permanent** — saved to localStorage immediately

---

## Gamification

### Scoring
Day score computed from: points earned vs target, dailies completed vs total.

Tiers: perfect / good / decent / half / poor / fail

| Tier | Condition |
|------|-----------|
| perfect | pts ≥ target AND all dailies done |
| good | missed ≤1 pt OR ≤1 daily |
| decent | ≥70% combined |
| half | ≥50% |
| poor | ≥25% |
| fail | <25% |

### XP & Leveling
- Each tier awards XP on Close Day: perfect=100, good=78, decent=32, half=-5, poor=-18, fail=-30
- Perfect day streak multiplier: up to 1.5× for 10+ day streaks
- Level thresholds: `Math.round(19 * (n + 24) ** 1.15)` XP to reach level n from n-1
  - Level 2: ~800 XP (~5 days at perfect), Level 10: ~8 weeks total, Level 50: ~1.5 years, Level 100: ~5 years
- 100 levels; 100 titles: 'Adrift' → 'Someone Who Never Stopped'
- Level capped at 100 — XP continues accumulating but level stops incrementing
- Completing a task writes to `dayRecord.cIds` so it counts toward Close Day scoring; no direct XP award — all XP flows through `closeDay` only
- Level up triggers fullscreen overlay

### Close Day / Reopen Day
- Scores the day, awards XP, updates streak/perfect count
- Stores a `scoreRecord` delta on the DayRecord
- **Reopen** fully reverses the XP and streak delta — profile is restored to pre-close state
- Re-closing after reopen computes a fresh score from current state; no double-counting
- Button shows "Close Day" / "Reopen Day" accordingly

### Carry Forward
- **↺ N button** appears in the score block footer, only when: viewing today AND there is at least one non-idea, non-done task scheduled for a past date
- Clicking calls `carryForwardTasks(today())`: sets `scheduledDate = today()` and `isFrog = false` on all qualifying tasks; shows toast `↺ N brought forward`
- Past frogs become regular core tasks (isFrog cleared); priority, duration, and points are preserved
- Button disappears after use (pastPending becomes 0); not shown on past/future day views

### Workout
- Workout button on score block toggles workout status for the day
- Tracked in DayRecord.workout; shown in stats (total workouts, streak)

### Momentum
Computed from last 5 closed days: rising / stable / slipping. Shown in topbar chip.

---

## Design System

### Themes
Six selectable themes, persisted to `localStorage.maya_theme`:
| ID | Name | Character |
|----|------|-----------|
| `dark` (default) | Dark | Near-black warm, neon accents |
| `dim` | Soft-Dark | Slightly lighter dark, less vignette |
| `kraft` | Kraft | Warm brown paper tones |
| `vanilla` | Vanilla | Warm off-white / cream |
| `light` | Lav-Light | Muted lavender light mode |
| `white` | Light | Neutral near-white |

Active theme class (`theme-dim`, `theme-kraft`, `theme-light`, etc.) is set on `<html>`. Dark has no class (it's the `:root` default). Token overrides in `tokens.css` use `html.theme-*` blocks.

SKIN button in topbar opens a dropdown showing all six themes with color swatches and checkmark on active.

### Colors (CSS vars)
```
--bg:   #0c0a0d   (near-black, warm)   — overridden per theme
--gold: #f0b030   (primary accent)
--hot:  #ff3060   (danger, frogs)
--grn:  #22ee80   (completion, frog section, active)
--pur:  #9955ff   (purple)
--blu:  #4488ff   (duration badges)
--yel:  #ffe040   (1pt tasks)
--ora:  #ff7030   (2pt tasks, progress)
--tel:  #20c8d8   (open-ended timer, teal task tint, Day tab)
--slv:  #9098b8   (silver, metadata)
```

### Fonts
- Orbitron — display, headings, nav labels
- Share Tech Mono — badges, chips, monospace values
- Rajdhani — body text

### Aesthetic rules
- Sharp corners (2-4px radius)
- Neon glows on accents (box-shadow with color)
- Grid texture overlay (CSS background-image)
- Scanline effect on topbar
- Left accent bar on task cards (2px, glows on hover)
- Dark surfaces with warm purple-brown cast

---

## Data Persistence

- localStorage key: `maya_os_v6`
- **Full export**: downloads JSON with all state; **full import** overwrites entire state
- **Tasks-only export**: downloads `{ version: 'maya_os_tasks_v1', tasks: [...] }` — unfinished tasks only (excludes any task ID present in any `days[date].cIds`)
- **Tasks-only import**: merges incoming tasks into existing state with fresh UIDs and `createdAt` timestamps — does not replace tasks, history, dailies, or profile
- Migrations: if schema changes, increment version key and write migration in `src/store/migrations.js`
- **Clear All**: wipes all state; re-seeds `DEFAULT_DAILIES`; `seedTasks()` returns `[]` (no dummy tasks)

---

## Known Behaviors / Edge Cases
- `confirm()` is blocked in sandboxed iframes — all destructive actions are direct (no confirm gates)
- Dailies completion is per-day (dIds in DayRecord), not global
- frogsComplete is per-day, not per-task — it marks the whole frog session as done
- Stats view completion rates include all days ever tracked (not just recent)
- Timer state (activeTask, activeStart) is in-memory only — not persisted across page loads by design
- HMR stability: `S` and `listeners` are stored on `window.__mayaS` / `window.__mayaListeners` to survive Vite module re-evaluation; hard reload still fixes any remaining edge cases
- getDayRecord() has a side effect during render (initializes missing day records) — intentional, does not call save()
- Idea task `done` state is `task.done` (boolean on the task itself), NOT derived from `dayRecord.cIds`. `isDone(t)` in DayView abstracts this: `t.priority === 'idea' ? (t.done ?? false) : dayRecord.cIds.includes(t.id)`
- `markSpecialDone` auto-assigns `scheduledDate = today()` if idea task is unscheduled when checked (tracked via `_autoScheduled`); reverses on uncheck
- Idea tasks checked in Idea tab and checked in DayView affect the same `task.done` flag — no two-place checking
