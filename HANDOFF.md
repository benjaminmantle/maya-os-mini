# Maya OS — Handoff

## Status
**Maya OS: Phase 6 complete.** Fully functional. All docs current.
**Portal Shell: Complete.** Bubble + launcher working. Maya and Vault switch cleanly.
**Vault: Step 7 + UI polish + 4 major features complete.** Full interactive skeleton with local/mock mode. Sidebar (resizable), page view, all 3 section types, gallery view (with card expand/edit modal), command palette, sort, filter, color picker, rich text toolbar, drag-to-reorder. Plus: letter grade column type, CSV import, character showcase (radar chart, identity grid, tabbed content), relationship graph (force-directed SVG). Awaiting Supabase setup to persist data.

---

## Orientation — read these in order before anything else

1. **CLAUDE.md** — working rules, critical gotchas, app isolation rules, commands. Follow exactly.
2. **ARCHITECTURE.md** — Maya file structure, store API, patterns.
3. **VAULT_ARCHITECTURE.md** — Vault file structure, store API, patterns.
4. **SPEC.md** — Maya feature behavior reference.
5. **VAULT_SPEC.md** — Vault feature behavior reference.
6. **PORTAL_SPEC.md** — Shell/bubble spec.
7. **TODO.md** — user-managed. Do not touch without explicit direction.

**Do not start coding until the user asks you to.** Orient, then wait.

---

## How to run
```bash
cd maya-os-mini
npm run dev    # localhost:5173
```
User runs this in their own terminal. Preview tools (preview_start, preview_screenshot, preview_eval) DO work on this machine — use them for visual verification and DOM measurement.

---

## What's implemented

### Maya OS (complete)
- **Day View** — date nav, score block (points/dailies bars, workout toggle, carry-forward, close/reopen day), frogs section, spotlight zone, core tasks (priority paint, P/T/G sort, quick-add, bump buttons, hide/show), done section
- **Sidebar** — Dailies tab, Backlog tab, Maya tab (each with quick-add and sort)
- **Maya task system** — `priority: 'maya'` tasks; star rating (1–3); completion via `task.done`; drag to DayView = linked copy; drag to Backlog = rejected
- **Carry-forward** — `↺ N` button; moves past non-done non-maya tasks to today
- **Drag and drop** — all zones; group integrity enforced; sandwich recolor; day-tab drag
- **Timer** — countdown / open-ended / countup; focus vs start distinction
- **Week View** — 7-day grid, drag to reschedule, click to navigate
- **Stats View** — progression cards, XP bar, heatmap, bar chart, radar, weekly rhythm, trend line, daily consistency, export/import
- **Scoring** — 6 tiers, XP awards, streak multiplier, idempotent close/reopen, momentum
- **Leveling** — 100 levels, 100 titles
- **Quick-add syntax** — `!hi/!md/!lo`, `@N`, `Nh/Nm`, `frog`
- **Export/import** — full backup + tasks-only; always additive with fresh IDs
- **5 themes** — Dark (default), Dim, Lavender, Vanilla, White

### Portal Shell (complete)
- [x] `src/Shell.jsx` — bubble + launcher, app registry, outside-click close, localStorage persist
- [x] `src/styles/components/Shell.module.css` — bubble (dim at rest, glow on hover), launcher panel
- [x] `src/main.jsx` updated to render `<Shell />` instead of `<App />`
- [x] `src/vault/VaultApp.jsx` + `VaultApp.module.css` — placeholder (centered "Vault — Coming soon")
- [x] Per-app wrapping: Maya gets `max-width: 1200px` centering; Vault gets full viewport

### Vault (steps 1–7 complete)
- [~] Supabase project created + env vars in `.env.local` — `.env.local` created with placeholders; user needs to create Supabase project and fill in real values
- [ ] Supabase schema migrated (SQL from VAULT_ARCHITECTURE.md)
- [x] `@supabase/supabase-js` installed
- [x] `src/vault/store/vaultStore.js` — full store with local/mock mode (all CRUD works in-memory when Supabase not configured) + seed data
- [x] `src/vault/hooks/useVault.js` — React hook wrapping vaultStore
- [x] `src/vault/VaultApp.jsx` — full layout (sidebar + page view), init/load lifecycle, Cmd+K palette, sidebar drag-to-resize (160–400px, persisted to localStorage)
- [x] `src/vault/components/layout/VaultSidebar.jsx` — tree nav with expand/collapse, inline rename, add/delete spaces+pages, ⌘K shortcut hint
- [x] `src/vault/components/layout/PageView.jsx` — breadcrumb nav, double-click editable page title, section renderer, add section picker (Table/List/Text), empty page state
- [x] `src/vault/components/layout/CommandPalette.jsx` — frosted overlay, search all pages, arrow key nav, Enter to navigate, Escape to close
- [x] `src/vault/components/sections/SectionShell.jsx` — shared wrapper (collapse, rename, delete, toolbar slot)
- [x] `src/vault/components/sections/TableSection.jsx` — table section with grid/gallery toggle, filter bar, row count
- [x] `src/vault/components/table/TableGrid.jsx` — full inline editing, add/delete rows+columns, column sorting (asc/desc/none cycle), alternating rows, drag-to-reorder rows
- [x] `src/vault/components/table/TableGallery.jsx` — card grid layout, auto-fills columns, responsive, shows all field types, click-to-expand detail modal with inline editing
- [x] `src/vault/components/table/CellRenderer.jsx` — renders text, number, select (TagChip), checkbox, rating (stars), date, url, letter_grade (GradeBadge)
- [x] `src/vault/components/table/CellEditor.jsx` — inline editors for all cell types, select/multi-select dropdowns, letter grade picker
- [x] `src/vault/components/table/ImportModal.jsx` — CSV import: drop zone → preview with type detection → additive import
- [x] `src/vault/components/table/RelationGraph.jsx` — Force-directed SVG graph: nodes = rows, edges = relations, drag/zoom/pan, hover highlighting
- [x] `src/vault/components/showcase/ShowcaseRegistry.js` — Template registry (registerShowcase/getShowcase)
- [x] `src/vault/components/showcase/ShowcaseView.jsx` — Split layout: name list + template render area
- [x] `src/vault/components/showcase/templates/CharacterShowcase.jsx` — Character sheet: header, identity grid, 8-axis radar chart, stat badges, D&D block, tabbed content
- [x] `src/vault/components/shared/GradeBadge.jsx` — Colored badge for letter grades (F- through S+, GLITCH)
- [x] `src/vault/components/sections/ListSection.jsx` — checkable list, inline edit, add/delete, clear checked, drag-to-reorder items
- [x] `src/vault/components/sections/TextSection.jsx` — contenteditable rich text, debounced autosave, formatting toolbar (bold/italic/underline/link)
- [x] `src/vault/components/shared/TagChip.jsx` — colored pill using CSS token colors
- [x] `src/vault/components/shared/StarRating.jsx` — 1-5 star widget (read + edit)
- [x] All CSS modules (VaultApp, VaultSidebar, PageView, SectionShell, TableGrid, TableGallery, CommandPalette, ListSection, TextSection, TagChip, StarRating, GradeBadge, ImportModal, ShowcaseView, CharacterShowcase, RelationGraph)
- [ ] Focus Mode
- [x] Showcase templates (CharacterShowcase for 'endless-sky-character')
- [x] Letter grade column type (F- through S+, GLITCH; GradeBadge rendering, GradeEditor picker)
- [x] CSV Import (📥 button → ImportModal with preview + type auto-detection)
- [x] Relationship Graph (◈ button → force-directed SVG graph for relation columns)
- [ ] Remaining column types (image upload, relation picker UI)

---

## Not yet verified (Maya)
- [ ] Frog section right-click complete/undo
- [ ] Core tasks collapse toggle persists across navigation
- [ ] v4→v5 migration
- [ ] AssignPopup positioning on small viewports

---

## Recent changes (4 major Vault features)
- **Letter Grade column type** — New `letter_grade` column type with 18 grades (F- through S+, plus GLITCH). GradeBadge component renders colored badges with tier-based colors (F=grey, D=brown, C=green, B=blue, A=purple, S=gold, GLITCH=red). GradeEditor dropdown for editing. Sorting via numeric grade index. Filter matches grade text. Works in grid, gallery, and showcase views.
- **CSV Import** — 📥 button in table toolbar opens ImportModal. Three-step flow: (1) drag-and-drop/file picker for CSV, (2) preview table with auto-detected column types (number, date, checkbox, letter_grade, URL, text), column toggle on/off, type override dropdown, (3) import with fresh UUIDs. Always additive. Built-in CSV parser handles quoted fields.
- **Character Showcase** — ⬡ button appears when section has `showcase_template` set. Renders ShowcaseView with name list + template. CharacterShowcase template includes: header with name/badges/initials portrait, 2-column identity grid, 8-axis SVG radar chart for letter-grade stats (STR/END/AGI/MAG/INT/WIS/CHA/TAR), stat badge row, D&D stat block (6 stats), tabbed content (Backstory, Personality, Combat, Relations, World, Notes). Registered via ShowcaseRegistry on VaultApp mount.
- **Relationship Graph** — ◈ button appears when section has a `relation` column. RelationGraph renders a force-directed SVG graph: nodes = rows (circle + initials + name), edges = relations. Inline force simulation (repulsion + spring attraction + damping, ~200 iterations). Node drag, wheel zoom, background pan. Hover highlighting dims non-connected nodes. Zoom controls (+/−/reset) in top-right corner.
- **Expanded seed data** — Characters table now has 25 columns (identity fields, 8 letter-grade stats, 6 D&D numeric stats, backstory), a Bonds relation column, and sample relations between 5 characters.
- **Local-mode relations** — vaultStore relation functions (getRelations, addRelation, removeRelation) now work in local/mock mode with in-memory Set storage. Added getRelationsSync() and getAllRelations() for synchronous access.

## Earlier changes (Vault button sizing + expanded colors)
- **Button size pass #2** — Second round of button enlargements: sidebar action buttons (0.78→0.88rem), add page/space (0.78→0.85rem), add row (0.78→0.88rem), add section/picker buttons (0.8→0.88rem), picker cancel (0.75→0.85rem), add column confirm/cancel/select (0.78→0.85rem), list add (0.9→1rem), clear checked (0.78→0.85rem). Color swatches 16→18px.
- **Expanded color palette** — Added 6 new color tokens to tokens.css: `--pnk` (#ff80b0 pink), `--lim` (#88ee44 lime), `--ind` (#6655ee indigo), `--brn` (#c8885e brown), `--crl` (#ff6680 coral), plus existing `--yel` now included. Total: 14 colors available (up from 8). Color picker grid changed from 4-col to 7-col layout (2 rows of 7).

## Earlier changes (Vault feature improvements)
- **Rich text toolbar** — TextSection now shows a formatting toolbar on focus: **B** (bold), *I* (italic), U̲ (underline), 🔗 (link). Uses `document.execCommand()`. Link button opens inline URL input with selection preservation. Toolbar auto-hides on blur.
- **Row drag-to-reorder** — Table rows and list items can be reordered by dragging the `⠿` handle. Gold top-border indicator on drop target. Drag disabled when column sort is active (sort overrides manual order). Uses HTML5 drag API + splice-based reorder → `reorderRows()` / `reorderListItems()`.
- **Sidebar drag-to-resize** — Drag the edge between sidebar and content to resize (160–400px range). Width persisted to `localStorage('vault_sidebar_width')`. 4px invisible handle with hover highlight (`var(--b2)`). Body cursor set to `col-resize` during drag, `userSelect: none` prevents text selection.
- **Gallery card expand/edit modal** — Click any gallery card to open a detail modal (frosted overlay, blur backdrop, z-index 500). Shows row title (editable) + all fields with inline editing via CellEditor. Checkboxes toggle immediately. Close via Escape or click backdrop. Edits save to store and reflect in grid view.

## Earlier changes (Vault UI polish pass)
- **Button/toggle size increase** — All interactive buttons across Vault scaled up for comfortable clicking: sidebar expand/collapse (0.65→0.8rem), action buttons (0.65→0.78rem), section collapse (0.75→0.9rem), section delete (0.7→0.85rem), row delete (0.65→0.78rem), add column (0.85→0.95rem), view toggles (0.72→0.85rem), list checkboxes (0.9→1.05rem), clear checked (0.72→0.78rem).
- **Sidebar bubble clearance** — `.tree` top padding increased from 12px to 36px so first space row doesn't overlap portal bubble.
- **Emoji icons removed** — Space rows simplified to: expand arrow + colored dot + name. Removed `📦`/`✦`/`📁` icons from sidebar, breadcrumbs, seed data, and new-space creation.
- **Space color picker** — Click the colored dot next to a space name to open an 8-swatch color picker popover (gold, hot, grn, pur, blu, ora, tel, slv). Click a swatch to change, click outside to close. Dot enlargened from 7px to 9px with hover scale effect.
- **Removed `.spaceIcon` CSS** — Dead class removed after emoji deletion.

## Earlier changes (Vault steps 6–7: Command Palette, Gallery, Sort, Filter, Polish)
- **Command Palette** — Cmd+K / Ctrl+K opens frosted overlay. Searches all pages by name. Arrow key navigation, Enter to navigate, Escape to close. Shows all pages with space breadcrumbs when query is empty. Gold accent bar on active result.
- **Gallery view** — Table sections now have a grid/gallery toggle (☰/▦) in the section header. Gallery shows rows as cards with title (first text column) + all other fields. Responsive auto-fill grid (min 190px per card). Cards show TagChips, StarRating, checkboxes, numbers, dates, URLs.
- **Table sorting** — Click column header to cycle: unsorted → ascending ↑ → descending ↓ → unsorted. Sorts correctly by type (string comparison, numeric, select label, checkbox state). Gold sort arrow indicator.
- **Table filtering** — Filter icon (⚲) in section header toolbar. Opens text input above table. Filters all rows by matching any cell value against query. Supports select/multi-select label matching. Shows "N / M" count. Works in both grid and gallery views.
- **Page title editing** — Double-click page title (h1) to inline edit. Enter to save, Escape to cancel.
- **Empty page state** — Pages with no sections show a centered hexagon icon + "This page is empty" + hint to add sections.
- **Sidebar shortcut hint** — ⌘K Search hint at bottom of sidebar.
- **SectionShell toolbar slot** — SectionShell now accepts a `toolbar` prop rendered between the section name and delete button.

## Earlier changes (Vault skeleton + mock mode)
- **Mock/local mode** — vaultStore.js works entirely in-memory when Supabase isn't configured. All CRUD operations work against `window.__vaultCache`. Seed data includes 2 spaces, 6 pages, tables with 7 column types, lists, and text sections.
- **Vault skeleton** — full layout with 220px sidebar + scrollable page view. Sidebar has tree navigation (infinite nesting via parent_id), inline rename, add/delete, expand/collapse.
- **Section types** — Table (grid view with inline editing for all cell types), List (checkable, edit, add/delete, clear checked), Text (contenteditable with debounced autosave).
- **Table grid** — alternating row backgrounds, column headers with rename/delete, add row/add column, select/multi-select dropdowns, star rating widget, checkbox toggle, all using CSS token colors.

## Recent fixes (Portal Shell refinements)
- **Bubble positioning** — moved from wrapper margin area into the topbar's own padding via `:global` CSS overrides in Shell.module.css. Topbar and nav padding-left overridden from 18px → 31px. Bubble has 9px equal gaps to both the topbar left edge and the "M" of MAYA (matches word spacing in the logo). Vertically centered with the logo text.
- **Topbar divider line removed** — `border-bottom-color: transparent` hides the line while preserving layout height.
- **Topbar bottom spacing** — `padding-bottom: 14px` (up from 10px) adds breathing room between the title bar and day tabs.
- **Wrapper padding removed** — `.appWrapCenter` and `.appWrapFull` no longer need `padding-left` since the topbar/nav overrides handle bubble space internally.

## Earlier fixes (pre-Portal/Vault)
- **Momentum "slipping" bug** — `calcMomentum()` in scoring.js was counting empty day records (created by nav tab getDayRecord side-effect) as "fail" days. Fixed: filter to closed days only.
- **Phantom tracked day (Mar 7)** — empty day records inflated Days Tracked and deflated Avg Pts/Day and daily consistency %. Fixed: `pastDayKeys` in StatsView.jsx now filters to days with actual activity. Also fixed `dailyStats` which had its own bypass.
- **Hardcoded dailies removed** — `DEFAULT_DAILIES` in defaults.js emptied; `DAILY_RENAMES` fixup loop removed from store.js. Fresh installs start blank.
- **Settings divider lines removed** — `.divider` background stripped (spacing preserved via 1px element).
- **Doc fixes** — PORTAL_SPEC.md token names corrected (`--s2`, `--text`, `--f`, `--b1`); ARCHITECTURE.md stale descriptions updated; pages.parent_id cascade fixed in both Vault docs.

---

## Known issues
- None currently.

---

## Recommended build order for Portal + Vault

1. ~~**Portal Shell first**~~ ✅ Done.
2. ~~**Supabase setup**~~ ✅ Code done (store, hook, env placeholders). Awaiting: user creates Supabase project, fills `.env.local`, runs schema SQL from VAULT_ARCHITECTURE.md
3. ~~**Vault skeleton**~~ ✅ Done (sidebar, page nav, sections, mock mode with seed data)
4. ~~**Sections: Text + List**~~ ✅ Done (both interactive, editable in mock mode)
5. ~~**Sections: Table (Grid view)**~~ ✅ Done (inline editing, add/delete rows+cols, select dropdowns, ratings, checkboxes)
6. ~~**Command Palette**~~ ✅ Done (Cmd+K search, arrow nav, page navigation)
7. ~~**Gallery view + filters**~~ ✅ Done (card grid layout, text filter bar, column sorting)
8. **Focus Mode**
9. ~~**Showcase Mode + CharacterShowcase template**~~ ✅ Done (ShowcaseRegistry, ShowcaseView, CharacterShowcase with radar chart)
10. ~~**Letter grade + CSV import + Relationship graph**~~ ✅ Done (all 4 major features)
11. **Remaining column types** — image upload, relation picker UI

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
