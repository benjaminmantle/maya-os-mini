# Maya OS — Handoff

## Status
**Maya OS: Phase 6+ complete.** Projects UX overhaul, idea rich text, task movement rules.
**Portal Shell: Complete.** Bubble + launcher + app switching.
**Vault: Feature-complete skeleton.** Local/mock mode working. Awaiting Supabase setup.
**CosmiCanvas: Phase 5 complete.** 3 render styles, alignment guides, touch support, perf optimizations, multi-board tabs.

---

## Orientation — read these in order

1. **CLAUDE.md** — working rules, critical gotchas, app isolation rules, commands
2. **ARCHITECTURE.md** — Maya file structure, store API, patterns
3. **VAULT_ARCHITECTURE.md** — Vault file structure, store API, patterns
4. **WHITEBOARD_SPEC.md** — CosmiCanvas file structure, element model, render architecture
5. **SPEC.md** — Maya feature behavior reference
6. **VAULT_SPEC.md** — Vault feature behavior reference
7. **PORTAL_SPEC.md** — Shell/bubble spec
8. **TODO.md** — user-managed; do not touch without explicit direction

**Do not start coding until the user asks you to.** Orient, then wait.

---

## How to run
```bash
npm run dev    # localhost:5173 (user terminal) or 5174 (preview server)
```
Preview tools (preview_start, preview_screenshot, preview_eval) work on this machine. Preview server configured for port 5174 in `.claude/launch.json`.

---

## What's implemented

### Maya OS
- **Day View** — date nav, score block, fasting widget, frogs section (toggleable), spotlight/focus zone, core tasks (sort P/T/G/J, quick-add, hide/show), done section
- **Sidebar** — 4 tabs: Day (dailies + food log), Tasks (backlog, no project tasks), Proj (project tasks only, sort P/T/G/J, filter chips), Idea (notes with topics + rich text)
- **Star system** — 1-5 stars (`mayaPts`), determines sort order and grouping
- **Projects** — `task.project` field, universal ProjectPicker on all cards + context menu, `#ProjectName` quick-add syntax, per-project colors, Backend management with drag reorder + arrow buttons
- **Ideas** — `priority: 'idea'` notes, topic system with colors, rich text (Ctrl+B bold, Ctrl+I italic, bullets, newlines), `renderRichText()` display
- **Task movement rules** — Tasks tab rejects project tasks, Proj tab rejects non-project tasks; moving focused/active/frog tasks to backlog auto-clears those states
- **Drag & drop** — all zones, group integrity, sandwich recolor, day-tab drag, cross-tab enforcement
- **Timer** — countdown / open-ended / countup with focus vs start
- **Week View** — 7-day grid, drag to reschedule
- **Stats (Backend tab)** — progression cards, XP bar, workout/fasting stats, heatmap, bar chart, radar, weekly rhythm, trend line, daily consistency, fasting config, export/import, project/topic label management
- **Scoring** — 9 tiers (percentage-based), XP + streak multiplier, +8 XP habit bonuses
- **100 levels** — formula `19*(n+24)^1.15`, 100 titles
- **6 themes** — Dark, Soft-Dark, Kraft, Vanilla, Lav-Light, Light. Project card hover colors match project color across all themes.
- **Quick-add** — `!1`-`!5` (stars), `@N` (pts), `Nh/Nm` (duration), `frog`, `#ProjectName`
- **Export/import** — full backup + tasks-only (additive with fresh IDs)

### Portal Shell
- Bubble + launcher, app registry, outside-click close, localStorage persist
- Per-app wrapping: Maya `max-width: 1200px`, Vault/CosmiCanvas full viewport

### Vault
- Full layout: resizable sidebar, page view, all section types (table, list, text)
- Table features: grid + gallery views, column sorting, column resize, row drag-reorder, filter bar, row detail modal
- Column types: text, number, select, multi-select, checkbox, rating, date, url, letter_grade, relation
- CSV import, character showcase, relationship graph, command palette, rich text toolbar
- Local/mock mode with seed data (works without Supabase)

### CosmiCanvas
- Infinite canvas with pan/zoom, 7 drawing tools, 3 render styles (Sketch/Clean/Neon)
- Select/move/resize, undo/redo, groups, z-ordering, copy/paste, alignment guides
- PNG/SVG/JSON export, image paste, minimap, dot grid, snap-to-grid
- Multi-board tabs, touch/pointer events, performance optimizations

---

## Not yet verified
- Frog section right-click complete/undo
- Core tasks collapse toggle persists across navigation
- v4-v5 migration
- AssignPopup positioning on small viewports

## Known issues
See `KNOWN_BUGS.md` for deferred items.

---

## Last session (2026-04-03) — Projects UX Overhaul + Idea Rich Text + Polish

### What was done
**Projects overhaul:** Universal ProjectPicker component (select/edit/delete/create-new/color), project chip on ALL non-idea cards (`+ proj` when unassigned), right-click context menu project row, `#ProjectName` quick-add syntax in all inputs, opaque colored filter chips (bigger, ALL caps), task movement restrictions (Tasks tab rejects project tasks, Proj tab rejects non-project tasks), unfrog/unfocus on backlog move.

**Backend LabelManager:** Drag reorder + arrow buttons (⇈↑↓⇊) on right side in single row with edit/delete, color picker positioned near click (viewport-clamped).

**Idea rich text:** Ctrl+B bold (`**...**`), Ctrl+I italic (`*...*`), `- ` auto-bullets, Shift+Enter bullet continuation, `renderRichText()` renderer on idea cards.

**Token + style fixes:** `--lgrn` darkened `#55cc66` → `#339944`, project card hover colors match project color (not teal) across all 6 themes, Sort by Project (J) button moved from Tasks tab to Proj tab + Core Tasks.

### New files
- `src/components/shared/ProjectPicker.jsx` — universal project picker
- `src/utils/richText.jsx` — mini-markdown renderer for ideas

### Previous session (2026-04-01)
Doc cleanup: rewrote HANDOFF/MEMORY, updated scoring refs, cleaned stale docs.

---

## Recommended next

### From TODO.md
1. Responsive layout audit (multi-device)
2. Mobile usability (touch targets, PWA, etc.)

### Vault
1. Supabase schema migration + real backend connection
2. Remaining column types (image upload)

### Do not start without direction
- TypeScript migration, task history/archive, weekly review, Kanban view, formula columns, public sharing, anything in TODO.md
