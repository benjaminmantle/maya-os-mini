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
  priority: 'hi' | 'md' | 'lo' | 'maya' | null  // priority color; null = no color
  scheduledDate: string | null  // YYYY-MM-DD or null (= backlog / maya backlog)
  createdAt: string      // ISO timestamp
  // Maya-only fields (only present when priority === 'maya'):
  done?: boolean         // unified completion state (single flag; not dayRecord-derived)
  mayaPts?: number       // star rating 1–3 (default 1)
  _autoScheduled?: true  // internal: set when markMayaDone auto-assigns scheduledDate=today()
                         //           cleared on undo so scheduledDate is also cleared
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

### Top-level persisted state (localStorage key: `maya_os_v5`)
```ts
{
  tasks: Task[]
  dailies: Daily[]
  days: Record<string, DayRecord>
  profile: Profile
  target: number        // daily point target, default 10
  frogsComplete: Record<string, boolean>  // date → done
}
```

---

## Views

### Day View (default)
Two-column layout: main column left, sidebar right.

**Main column (top to bottom):**
1. Date navigation — prev/next arrows, date display, "Today" jump button
2. Score block — points progress bar, dailies progress bar, Workout toggle, Close Day button
3. Frogs section — drop zone for frog tasks; right-click section to mark complete (dims + green ✓); toggleable
4. Spotlight zone — appears only when a task is focused or active; shows full interactive task card with label "◆ Up Next" or "▶ Running"
5. Core Tasks — toolbar (priority paint, sort), quick-add input, task list, hide/show collapse toggle
6. Done section — completed tasks for the day (auto-shown when any exist)

**Sidebar (tabbed):**
- **Dailies tab** (default) — list of daily habits; click to toggle completion; hover shows edit/delete buttons; drag to reorder; right-click for context menu; "+ add daily" collapsed button at bottom
- **Backlog tab** — unscheduled non-maya tasks; quick-add input; assign button (📅) per task
- **Maya tab** — Maya tasks (`priority === 'maya'`) that are not yet done; quick-add prefixes `MAYA — `; star rating (1–5) per task; purple accent; assign button (📅) per task; dropping non-maya tasks here is silently rejected

### Week View
7-day grid. Each day shows: weekday, date number, points progress bar, task snippets (up to 4), dailies completion count. Drag tasks to reschedule. Click day to navigate to it in Day view.

### Stats View (Settings tab)
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
| `!hi` / `!h` / `!1` | High priority (regular tasks); 3 stars (maya tasks) | `!1`, `!hi` |
| `!md` / `!m` / `!2` | Med priority (regular tasks); 2 stars (maya tasks) | `!2`, `!md` |
| `!lo` / `!l` / `!3` | Low priority (regular tasks); 1 star (maya tasks) | `!3`, `!lo` |
| `@N` | Points (0, 0.5, 1, 2, 3) | `@2`, `@0.5` |
| `Nh` / `Nm` | Duration | `2h`, `45m`, `1hr`, `30min` |
| `Nh+` / `Nm+` | Open-ended duration | `2h+`, `45m+` |
| `frog` | Frog flag | anywhere in string |

Defaults: pts=0.5, time=null, priority=null, isFrog=false.

**Maya task quick-add note:** In the Maya panel, `!1/!2/!3` (or `!hi/!md/!lo`) set the star rating instead of the priority color (which is always `maya`). `!1`=3 stars, `!2`=2 stars, `!3`=1 star. No token defaults to 1 star.

### Task card anatomy
- Checkbox (scheduled tasks, or any maya task) — toggles completion; maya tasks call `markMayaDone()` which uses `task.done` as the single source of truth
- Task name
- Star rating — maya tasks only; 1–5 stars (☆); stored as `task.mayaPts`
- Points badge (0 / 0.5 / 1 / 2 / 3) — click to cycle; colors: dim(0) / silver(0.5) / yellow(1) / orange(2) / red(3)
- Duration badge — click to cycle through presets; blue when set, grey when blank
  - Presets: null → 15m → 30m → 45m → 1h → 1.5h → 2h → 3h → 4h → ∞ → null
- `+` toggle badge — appears when duration is set (not ∞); toggles open-ended mode (appends `+` to duration string)
- Assign (📅) button — on core task list only; opens date picker popup
- Delete ✕ button — for maya tasks in DayView this becomes "Remove from day" (sets `scheduledDate=null`)
- Edit ✎ button (opens modal)

**Priority coloring:** left accent bar and card background tint. hi=red, md=purple/muted, lo=teal, maya=purple (var(--pri-maya)). Overridden by frog (green), focused (gold), active (green).

**Priority paint tool:** toolbar buttons in Core Tasks section; click button then click cards to paint/unpaint priority.

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
- ▶ Start / ⏹ Stop
- ◆ Focus / ◇ Unfocus
- ✎ Edit
- 🔴 High / 🟡 Med / 🔵 Low priority (toggles) — **hidden for maya tasks**
- ✕ Delete — for maya tasks in DayView: **📅 Remove from day** (unschedules, doesn't delete)

### Drag and drop
- Drag tasks between: frog zone, core tasks zone, backlog zone, day-of-week tabs in nav
- Dropping into frogs sets isFrog=true and scheduledDate=focusDate
- Dropping into core tasks sets isFrog=false, scheduledDate=focusDate
- Dropping into backlog sets scheduledDate=null, isFrog=false
- Dropping onto a day tab sets scheduledDate=that date
- Week view: drag task to day column to reschedule
- **Group integrity**: same-priority tasks stay as contiguous groups; dragging into the middle of a group snaps to the nearest group boundary
- **Frog zone styling**: dragging into frogs always shows green styling regardless of priority color

### Edit modal
Full edit: name, pts selector, time estimate (free text), scheduled day (Backlog + next 7 days), frog toggle.

---

## Navigation

### Nav tabs
`DAY | Mo2 | Tu3 | We4 | Th5 | Fr6 | Sa7 | Su8 | WEEK | SETTINGS`

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
- Completing a maya task (`markMayaDone`) writes to `dayRecord.cIds` so it counts toward Close Day scoring; no direct XP award — all XP flows through `closeDay` only
- Level up triggers fullscreen overlay

### Close Day / Reopen Day
- Scores the day, awards XP, updates streak/perfect count
- Stores a `scoreRecord` delta on the DayRecord
- **Reopen** fully reverses the XP and streak delta — profile is restored to pre-close state
- Re-closing after reopen computes a fresh score from current state; no double-counting
- Button shows "Close Day" / "Reopen Day" accordingly

### Workout
- Workout button on score block toggles workout status for the day
- Tracked in DayRecord.workout; shown in stats (total workouts, streak)

### Momentum
Computed from last 5 closed days: rising / stable / slipping. Shown in topbar chip.

---

## Design System

### Colors (CSS vars)
```
--bg:   #0c0a0d   (near-black, warm)
--gold: #f0b030   (primary accent)
--hot:  #ff3060   (danger, frogs, high priority)
--grn:  #22ee80   (completion, frog section, active)
--pur:  #9955ff   (purple, med priority)
--blu:  #4488ff   (duration badges)
--yel:  #ffe040   (1pt tasks)
--ora:  #ff7030   (2pt tasks, progress)
--tel:  #20c8d8   (open-ended timer, low priority)
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

- localStorage key: `maya_os_v5`
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
- HMR during active development can corrupt store listeners (listeners Set gets reset); hard page reload always fixes it
- getDayRecord() has a side effect during render (initializes missing day records) — intentional, does not call save()
- Maya task `done` state is `task.done` (boolean on the task itself), NOT derived from `dayRecord.cIds`. `isDone(t)` in DayView abstracts this: `t.priority === 'maya' ? (t.done ?? false) : dayRecord.cIds.includes(t.id)`
- `markMayaDone` auto-assigns `scheduledDate = today()` if task is unscheduled when checked (tracked via `_autoScheduled`); reverses on uncheck. This ensures the task appears in the correct day's `cIds` for Close Day scoring without double-counting
- Maya tasks checked in Maya tab and checked in DayView affect the same `task.done` flag — no two-place checking
