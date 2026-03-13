# Maya OS — Handoff

## Status
**Maya OS: Phase 6 complete.** Fully functional. All docs current.
**Portal Shell: Not started.** Spec complete (PORTAL_SPEC.md).
**Vault: Not started.** Spec complete (VAULT_SPEC.md, VAULT_ARCHITECTURE.md). All 7 showcase templates designed.

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
User runs this in their own terminal. Do not use `preview_*` tools to verify — the embedded preview browser doesn't maintain connection on Windows. Do code review instead.

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

### Portal Shell (not started)
- [ ] `src/Shell.jsx` — bubble + launcher
- [ ] `src/styles/components/Shell.module.css`
- [ ] `src/main.jsx` updated to render `<Shell />` instead of `<App />`

### Vault (not started)
- [ ] Supabase project created + env vars in `.env.local`
- [ ] Supabase schema migrated (SQL from VAULT_ARCHITECTURE.md)
- [ ] `src/vault/` — all components, store, hooks, styles
- [ ] CharacterShowcase template

---

## Not yet verified (Maya)
- [ ] Frog section right-click complete/undo
- [ ] Core tasks collapse toggle persists across navigation
- [ ] v4→v5 migration
- [ ] AssignPopup positioning on small viewports

---

## Recent fixes (pre-Portal/Vault)
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

1. **Portal Shell first** — minimal change to main.jsx, Shell.jsx, Shell.module.css. Verify bubble appears and Maya still works identically before touching anything else.
2. **Supabase setup** — create project, run schema SQL, confirm connection in vaultStore.js
3. **Vault skeleton** — VaultApp.jsx renders in the shell, sidebar loads spaces/pages from Supabase
4. **Sections: Text + List** — simpler types first; proves the section/page model
5. **Sections: Table (Grid view)** — column types one at a time; text and checkbox first
6. **Command Palette** — Cmd+K search over pages/rows
7. **Gallery view + filters**
8. **Focus Mode**
9. **Showcase Mode + CharacterShowcase template**
10. **Remaining column types** — relation last

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
