# Maya OS — Claude Code Instructions

## Project layout
```
maya-os-mini/        ← git root, Claude CWD — everything lives here
├── CLAUDE.md
├── HANDOFF.md
├── ARCHITECTURE.md
├── SPEC.md
├── VAULT_SPEC.md
├── VAULT_ARCHITECTURE.md
├── PORTAL_SPEC.md
├── TODO.md
├── package.json
└── src/
```
Docs and source are all at the same level. Source files are at `src/...`.

## What this project is
A personal hub of apps. The root is `maya-os-mini` (the git repo name). It contains:
- **Maya OS** — personal productivity OS (tasks, habits, gamification). Single-user, local-first, localStorage.
- **Vault** — personal information store (tables, lists, text, showcases). Supabase backend.
- **Portal Shell** — a tiny bubble in the upper-left that lets you switch between apps.

Dark gamer/cyberpunk UI shared across all apps. CSS tokens in `src/styles/tokens.css` are the single source of truth.

## Tech stack
- Vite + React 18 (no Next.js)
- Plain CSS modules — custom design system, not Tailwind
- Maya data: centralized store in `src/store/store.js` → localStorage
- Vault data: centralized store in `src/vault/store/vaultStore.js` → Supabase
- Supabase env vars in `.env.local` (never committed)

---

## CRITICAL — App Isolation

**Maya-OS internals are completely off-limits when working on Portal or Vault.**

The protected zone is:
```
src/App.jsx
src/components/**
src/store/**
src/hooks/**
src/utils/**
src/styles/**   ← tokens.css may be READ but only new tokens may be ADDED, never modified
```

The ONLY Maya file that may change for Portal work is `src/main.jsx` — and only to swap `<App />` for `<Shell />`.

When the user asks to work on **Maya OS**: touch only Maya files. Ignore Vault and Shell.
When the user asks to work on **Vault or Portal**: touch only `src/Shell.jsx`, `src/vault/**`, and `src/styles/Shell.module.css`. Never touch Maya internals.

If a task would require touching files in both zones, **stop and ask** before proceeding.

---

## Working Process

- **Plan first.** Before any major feature or multi-part task, write a plan listing affected files and required changes. Wait for approval before touching anything.
- **Break it down.** Small, scoped steps. One at a time unless told to parallelize.
- **Subagents.** List which files each agent will touch before starting. No overlapping file ownership. Serialize any tasks that share files.
- **Stay in scope.** Never silently change behavior outside the current task. Flag adjacent issues — don't fix them.
- **Surface blockers.** Architectural decisions not covered here or in ARCHITECTURE.md / VAULT_ARCHITECTURE.md require approval before proceeding.
- **Surgical edits.** Targeted changes over broad rewrites unless a rewrite is explicitly requested.
- **TODO.md is user-managed.** Never add, remove, reorder, or act on items in TODO.md unless explicitly directed. When told to work on a TODO item, mark it [x] when done — do not delete it.

---

## Documentation Maintenance

**Update docs at the end of every session that adds a feature, changes behavior, or establishes a new pattern.** Do not wait to be asked. Docs are part of the deliverable.

### Maya OS docs
- **ARCHITECTURE.md** — file tree entries, new utility functions, new patterns
- **SPEC.md** — any visible behavior change: new UI controls, changed interactions, new settings
- **CLAUDE.md** — new gotchas, new conventions, new critical rules

### Vault docs
- **VAULT_ARCHITECTURE.md** — file tree entries, store API changes, new patterns
- **VAULT_SPEC.md** — any visible behavior change in Vault
- **CLAUDE.md** — add Vault-specific gotchas here under the Vault Gotchas section below

### Always
- **HANDOFF.md** — update at end of every session: what was done, what's next, any new issues

Err on the side of over-documenting. Even small changes should be noted if they'd trip up a future session.

**SPEC.md and VAULT_SPEC.md may be outdated.** Treat as reference only. Actual implemented behavior takes precedence.

---

## Critical Rules — Maya OS

**Store discipline** — ALL Maya data access goes through `src/store/store.js`. No direct localStorage calls in components.

**Aesthetic** — CSS variables in `src/styles/tokens.css` are the source of truth. No Tailwind, no hardcoded hex values. New colors get a token.

**No confirm() dialogs** — blocked in sandboxed iframes and bad UX. Destructive actions execute immediately.

**No placeholder text** — do not add placeholder attributes to task quick-add inputs.

**Preserve existing features** — read SPEC.md before modifying any feature. Don't silently remove behavior.

**Schema versioning** — localStorage key is `maya_os_v5`. Breaking schema changes must increment the version and add a migration in `src/store/migrations.js`.

---

## Critical Rules — Vault

**Store discipline** — ALL Vault data access goes through `src/vault/store/vaultStore.js`. No direct Supabase calls in components.

**No hardcoded colors** — select option colors stored as token name strings (`'gold'`, `'tel'`, `'pur'`). TagChip maps to `var(--token)`. Never store hex.

**Cascade deletes** — always via Supabase `on delete cascade` rules + a single store function. Never cascade in components.

**Showcase templates** — registered by `showcase_template` string field on sections table (e.g. `'endless-sky-character'`), NOT by section UUID. Registry lives in `ShowcaseRegistry.js`.

**Import is always additive** — `importTableCSV` and `importTableJSON` never replace existing rows. Fresh UUIDs on all imported rows.

**No confirm() dialogs** — same rule as Maya.

---

## Known Gotchas & Traps — Maya OS

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
`S` and `listeners` are stored on `window.__mayaS` and `window.__mayaListeners` so Vite HMR module re-evaluation doesn't wipe them. Hard reload fixes any remaining edge cases. No effect in production.

### Drag-and-drop group integrity
Same-priority tasks must stay contiguous. The snap-to-boundary algorithm in `DayView.jsx` (`makeDrop('day')`) and `BacklogPanel.jsx` must not be removed.

### exportTasks / importTasks — IDs are always replaced on import
`importTasks(json)` assigns a fresh `uid()` and `createdAt` to every incoming task. Do not attempt to preserve original IDs on import.

### Tasks-only import is additive, not replacing
`importTasks` merges into `S.tasks` — never wipes. `importData` (full backup) does a full replace. Keep these behaviors distinct.

### Maya task done state — single source of truth
`task.done` (boolean on the task object itself) is the completion flag for maya tasks — NOT `dayRecord.cIds`. Use `isDone(t)` in DayView: `t.priority === 'maya' ? (t.done ?? false) : dayRecord.cIds.includes(t.id)`. Never derive maya completion from cIds alone.

### markMayaDone — auto-schedules for scoring
`markMayaDone(taskId, done)` auto-assigns `scheduledDate = today()` + `_autoScheduled = true` when checking an unscheduled maya task. Reverses cleanly on uncheck. Do not call `updateTask` directly for maya completion.

### Maya tasks in DayView — unschedule, don't delete
Delete action for maya tasks calls `updateTask(id, { scheduledDate: null })`, not `deleteTask`. Label: "📅 Remove from day".

### Maya drag to DayView — linked copy, skip doMove
`makeDrop('day')` ONLY calls `updateTask({ scheduledDate: focusDate, isFrog: false })` for maya tasks — does NOT call `doMove`. Intentional. Do not add `doMove` back.

### Theme system — dark is the default, no class
Dark theme uses `:root` defaults. Other themes apply a class on `<html>`. Light-mode overrides must always be in named `html.theme-*` blocks:
```css
:global(html.theme-light) .foo,
:global(html.theme-vanilla) .foo,
:global(html.theme-white) .foo { ... }
```
`overflow: hidden` on `.topbar` was removed to allow the theme dropdown to escape — do not restore it.

### Em dash — applyEmDash must be wired to all name inputs
`applyEmDash(str)` in `parsing.js` converts `--X` to `—X`. Must be applied in `onChange` on every task/daily name input. Any new name input must wire `applyEmDash`.

### Done section and Core Tasks — both have collapse state
`DayView.jsx` has `coreHidden` and `doneHidden` boolean states (both start `false`). Do not merge or remove either.

---

## Known Gotchas & Traps — Vault

### Showcase registry key is showcase_template string, not section UUID
Templates are registered by `section.showcase_template` (a text column on the sections table), e.g. `'endless-sky-character'`. Never use section UUIDs as registry keys — they differ per installation.

### Sparse cells — always default
Not every row has a cell for every column. Always read as `cells[colId] ?? defaultForType(column.type)`. Never crash on undefined.

### Command Palette — cache the search index
Build and cache a flattened search index in vaultStore on load; update it on mutations. Never query Supabase per keystroke.

### Rich text stored as HTML string
`text_content.content` is an HTML string in v1. Not markdown. Do not introduce a markdown parser.

### Image signed URLs — do not store
Generate signed URLs on render; cache in component state with TTL. Never store signed URLs in the database.

### registerShowcase timing
Call `registerShowcase()` in `VaultApp.jsx` `useEffect` on mount, before any page renders. Registry is module-level — safe to populate once.

### Portal bubble z-index
Shell bubble and launcher are `z-index: 9999`. No component in Maya or Vault may use z-index above 9000.

### Shell layout wrapping — #root vs Shell
`global.css` still has `#root { max-width: 1200px; margin: 0 auto }` but Shell uses `position: fixed; inset: 0` to escape that constraint. Maya's centering now comes from `.appWrapCenter` in Shell.module.css (same max-width + flex-column). Vault uses `.appWrapFull` (full viewport). Do not modify `#root` styles — Shell handles the adaptation layer.

### Portal bubble position — inside topbar padding, not fixed
The bubble and launcher are rendered inside the per-app wrapper div (`.appWrapCenter` / `.appWrapFull`) with `position: absolute`. Both wrappers have `position: relative` so the bubble anchors to their edges. Shell.module.css overrides the topbar and nav `padding-left` from 18px to 31px via `:global([class^="_topbar_"])` / `:global([class^="_nav_"])` selectors to create room for the bubble (9px + 13px bubble + 9px). The bubble sits entirely inside the topbar's background — do not reduce this padding. Do not change bubble to `position: fixed`.

### Shell.module.css :global overrides — fragile selectors
Shell.module.css uses `:global([class^="_topbar_"])` and `:global([class^="_nav_"])` to override padding/border on Maya's topbar and nav from the Shell layer. These selectors depend on Vite CSS Modules naming format (`_className_hash`). They work because Shell.module.css is the only allowed file for Portal work. If Vite's CSS Modules naming changes, these selectors will break. Also overrides: `border-bottom-color: transparent` (removes topbar divider line) and `padding-bottom: 14px` (extra breathing room below title).

### ToastProvider scope
`ToastProvider` wraps Shell in `main.jsx`. All apps share it. Never add a second ToastProvider inside Shell, VaultApp, or App.

---

## Commands
```bash
npm run dev      # localhost:5173
npm run build
npm run preview
```
Run from the project root (`maya-os-mini/`).

## Key files — Maya OS
- `src/main.jsx` — React root mount, ToastProvider, Shell wrapper
- `src/Shell.jsx` — portal bubble, app switcher
- `src/App.jsx` — Maya view routing, timer/focus state
- `src/store/store.js` — ALL Maya data access
- `src/styles/tokens.css` — ALL design tokens (shared by all apps)
- `src/components/day/DayView.jsx` — main Maya view (intentionally monolithic)
- `src/components/NavTabs.jsx` — Maya navigation
- `src/hooks/useStore.js` — Maya store subscription
- `src/utils/parsing.js` — quick-add syntax parser; `applyEmDash()`
- `src/utils/scoring.js` — XP, leveling, day tier logic

## Key files — Vault
- `src/vault/VaultApp.jsx` — Vault root, layout, active page state
- `src/vault/store/vaultStore.js` — ALL Vault data access (Supabase)
- `src/vault/hooks/useVault.js` — Vault store subscription
- `src/vault/components/layout/CommandPalette.jsx` — Cmd+K search
- `src/vault/components/showcase/ShowcaseRegistry.js` — template registry
- `src/vault/components/showcase/templates/CharacterShowcase.jsx` — Endless Sky character layout

See ARCHITECTURE.md for Maya file tree and patterns.
See VAULT_ARCHITECTURE.md for Vault file tree, store API, and patterns.
