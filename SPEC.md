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
  priority: 'hi' | 'md' | 'lo' | null  // priority color; null = no color
  scheduledDate: string | null  // YYYY-MM-DD or null (= backlog)
  createdAt: string      // ISO timestamp
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
- **Backlog tab** — unscheduled tasks; quick-add input; assign button (📅) per task

### Week View
7-day grid. Each day shows: weekday, date number, points progress bar, task snippets (up to 4), dailies completion count. Drag tasks to reschedule. Click day to navigate to it in Day view.

### Stats View (Settings tab)
- **Progression** cards: level, title, current streak, longest streak, perfect days, days tracked, frogs done, avg pts/day
- **XP progress bar** — shows current XP toward next level with level name preview; "★ max level" at level 20
- **Workout** stats: total workouts, current workout streak
- **Activity heatmap** — 13-week GitHub-style grid (Mon–Sun columns); cells colored by day tier for any day with recorded data; future cells hidden; tier legend below
- **30-day points bar chart** — one bar per day, height = pts / target (capped at 100%), colored by tier; dotted target line at top; empty days show a thin baseline
- **Daily Consistency** — per-daily completion rate bar (red/gold/green) + current streak + total completions count
- Point target setting
- Export / Import data (JSON)
- Danger zone: Reset Today, Clear All Data

---

## Task Interactions

### Quick add (inline syntax parser)
All tokens are optional and order-independent. Unrecognized text becomes the task name.

| Token | Meaning | Examples |
|-------|---------|---------|
| `!hi` / `!h` / `!1` | High priority | `!1`, `!hi` |
| `!md` / `!m` / `!2` | Med priority | `!2`, `!md` |
| `!lo` / `!l` / `!3` | Low priority | `!3`, `!lo` |
| `@N` | Points (0, 0.5, 1, 2, 3) | `@2`, `@0.5` |
| `Nh` / `Nm` | Duration | `2h`, `45m`, `1hr`, `30min` |
| `Nh+` / `Nm+` | Open-ended duration | `2h+`, `45m+` |
| `frog` | Frog flag | anywhere in string |

Defaults: pts=2, time=null, priority=null, isFrog=false.

### Task card anatomy
- Checkbox (scheduled tasks only) — toggles completion
- Task name
- Points badge (0 / 0.5 / 1 / 2 / 3) — click to cycle; colors: dim(0) / silver(0.5) / yellow(1) / orange(2) / red(3)
- Duration badge — click to cycle through presets; blue when set, grey when blank
  - Presets: null → 15m → 30m → 45m → 1h → 1.5h → 2h → 3h → 4h → ∞ → null
- `+` toggle badge — appears when duration is set (not ∞); toggles open-ended mode (appends `+` to duration string)
- Assign (📅) button — on core task list only; opens date picker popup
- Delete ✕ button
- Edit ✎ button (opens modal)

**Priority coloring:** left accent bar and card background tint. hi=red, md=purple/muted, lo=teal. Overridden by frog (green), focused (gold), active (green).

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
- 🔴 High / 🟡 Med / 🔵 Low priority (toggles)
- ✕ Delete

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
- Level thresholds: `round(200 × 1.4^(level-1))` XP to reach level n from n-1
  - Level 2: 280 XP (~3 perfect days), Level 5: ~1,100 XP (~11+ days), Level 10: ~5,900 XP (~months)
- 20 level titles: Adrift → Someone Who Returns
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
- Export: downloads JSON with all state
- Import: loads JSON, overwrites state, saves
- Migrations: if schema changes, increment version key and write migration

---

## Known Behaviors / Edge Cases
- `confirm()` is blocked in sandboxed iframes — all destructive actions are direct (no confirm gates)
- Dailies completion is per-day (dIds in DayRecord), not global
- frogsComplete is per-day, not per-task — it marks the whole frog session as done
- Stats view completion rates include all days ever tracked (not just recent)
- Timer state (activeTask, activeStart) is in-memory only — not persisted across page loads by design
- HMR during active development can corrupt store listeners (listeners Set gets reset); hard page reload always fixes it
- getDayRecord() has a side effect during render (initializes missing day records) — intentional, does not call save()
