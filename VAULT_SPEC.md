# Vault — Full Feature Specification

## What This Is

A personal information store and knowledge base. Beautiful, fast, and a genuine pleasure to use. Stores everything that isn't tasks/productivity (that's Maya-OS): story world data, favorites lists, fandom stuff, ideas, writing, shopping, reference tables, plans — anything.

Two design priorities above all else:
1. **Beauty** — this app should feel like a premium product, cyber/post-modern, visually stunning
2. **Zero friction** — getting to data, editing it, and reading it should require as few clicks/keystrokes as possible

Shares Maya-OS's full aesthetic: same CSS tokens, same grid texture, same glows, same fonts, all 6 themes. Same universe, same energy.

---

## Backend: Supabase

- **Database**: Supabase (Postgres) — free tier covers all personal use indefinitely
- **File storage**: Supabase Storage — for character art and any future file attachments
- **Auth**: Supabase Auth — single user (Ben) for now; architecture allows multi-user later if productized
- Free tier: 500MB DB, 1GB storage — more than sufficient for personal scale
- All DB access goes through `src/vault/store/vaultStore.js` — no direct Supabase calls in components (same discipline as Maya-OS store)

### Environment
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
Loaded via `.env.local`. Never committed.

---

## File Structure

```
src/vault/
├── VaultApp.jsx                        ← Root; owns layout, active page, modal/focus state
├── store/
│   └── vaultStore.js                   ← All Supabase access; pub/sub pattern matching Maya store
├── hooks/
│   └── useVault.js                     ← React hook wrapping vaultStore (same pattern as useStore)
├── components/
│   ├── layout/
│   │   ├── VaultSidebar.jsx            ← Tree nav: spaces/pages, infinite nesting
│   │   ├── PageView.jsx                ← Main content area: renders a page's sections
│   │   └── CommandPalette.jsx          ← Cmd+K global search/navigation overlay
│   ├── sections/
│   │   ├── TableSection.jsx            ← Table with inline editing, views, add/remove
│   │   ├── ListSection.jsx             ← Checkable list, drag reorder
│   │   ├── TextSection.jsx             ← Free-form rich text area
│   │   └── SectionShell.jsx            ← Shared wrapper: name, collapse, add row btn, delete
│   ├── table/
│   │   ├── TableGrid.jsx               ← Standard row/column view
│   │   ├── TableGallery.jsx            ← Card/gallery view
│   │   ├── TableFilters.jsx            ← Filter/sort panel
│   │   ├── ColumnHeader.jsx            ← Header cell: rename, type, delete, resize
│   │   ├── CellRenderer.jsx            ← Renders correct cell type (read mode)
│   │   ├── CellEditor.jsx              ← Renders correct edit control for each type
│   │   └── NewColumnPanel.jsx          ← Inline panel for adding a column
│   ├── showcase/
│   │   ├── ShowcaseModal.jsx           ← Full-screen overlay wrapper for showcase
│   │   ├── ShowcaseRegistry.js         ← Maps showcase_template string → React component
│   │   └── templates/
│   │       ├── CharacterShowcase.jsx   ← Character profile
│   │       ├── PlaceShowcase.jsx       ← Place/world/city
│   │       ├── RaceShowcase.jsx        ← Race
│   │       ├── AbilityShowcase.jsx     ← Ability
│   │       ├── ItemShowcase.jsx        ← Item/weapon
│   │       ├── MagicSystemShowcase.jsx ← Magic system
│   │       └── ElementShowcase.jsx     ← Magic element
│   ├── focus/
│   │   └── FocusMode.jsx               ← Full-screen minimal-chrome editor/reader
│   └── shared/
│       ├── TagChip.jsx                 ← Colored select/multi-select tag pill
│       ├── StarRating.jsx              ← Rating display/edit
│       ├── RelationChip.jsx            ← Linked row chip
│       └── ImageUpload.jsx             ← Supabase Storage upload + display
└── styles/
    ├── VaultApp.module.css
    ├── VaultSidebar.module.css
    ├── PageView.module.css
    ├── TableSection.module.css
    ├── ListSection.module.css
    ├── TextSection.module.css
    ├── CommandPalette.module.css
    ├── ShowcaseModal.module.css
    └── FocusMode.module.css
```

---

## Data Model (Supabase Schema)

### `spaces`
```sql
id          uuid primary key default gen_random_uuid()
name        text not null
icon        text            -- emoji or symbol
color       text            -- token name: 'gold', 'tel', 'pur', 'hot', 'grn', etc.
position    integer         -- display order
created_at  timestamptz default now()
```

### `pages`
```sql
id          uuid primary key default gen_random_uuid()
space_id    uuid references spaces on delete cascade
parent_id   uuid references pages on delete cascade  -- null = top-level; cascades to children
name        text not null
position    integer
created_at  timestamptz default now()
```

### `sections`
```sql
id          uuid primary key default gen_random_uuid()
page_id     uuid references pages on delete cascade
name        text
type        text not null   -- 'table' | 'list' | 'text'
collapsed   boolean default false
position    integer
created_at  timestamptz default now()
```

### `table_columns`
```sql
id          uuid primary key default gen_random_uuid()
section_id  uuid references sections on delete cascade
name        text not null
type        text not null   -- see Column Types
options     jsonb           -- [{ id, label, color }] for select/multi_select
position    integer
width       integer default 160
```

### `table_rows`
```sql
id          uuid primary key default gen_random_uuid()
section_id  uuid references sections on delete cascade
position    integer
created_at  timestamptz default now()
```

### `table_cells`
```sql
id          uuid primary key default gen_random_uuid()
row_id      uuid references table_rows on delete cascade
column_id   uuid references table_columns on delete cascade
value       jsonb
unique(row_id, column_id)
```

### `list_items`
```sql
id          uuid primary key default gen_random_uuid()
section_id  uuid references sections on delete cascade
text        text not null default ''
checked     boolean default false
position    integer
```

### `text_content`
```sql
id          uuid primary key references sections on delete cascade  -- 1:1 with sections
content     text default ''   -- rich text stored as HTML string
```

### `relation_links`
```sql
id              uuid primary key default gen_random_uuid()
source_row_id   uuid references table_rows on delete cascade
source_col_id   uuid references table_columns on delete cascade
target_row_id   uuid references table_rows on delete cascade
```

---

## Column Types

| Type | `value` format in JSONB | Notes |
|------|------------------------|-------|
| `text` | `"string"` | Plain single/multiline text |
| `rich_text` | `"<html string>"` | Bold, italic, links only in v1 |
| `number` | `123` or `12.5` | |
| `select` | `"option_id"` | Single colored tag |
| `multi_select` | `["id1", "id2"]` | Multiple colored tags |
| `date` | `"YYYY-MM-DD"` | |
| `datetime` | `"ISO string"` | |
| `checkbox` | `true` / `false` | |
| `url` | `"https://..."` | Displays as clickable link |
| `rating` | `1`–`5` | Star widget |
| `image` | `"storage_path"` | Uploaded to Supabase Storage bucket `vault-images` |
| `relation` | (stored in `relation_links`) | Links to rows in any other table |

**Complexity notes:**
- `relation`: implement last in v1 — schema is ready from day one but UI row-picker comes after other types
- `rich_text`: minimal contenteditable (B, I, link) — no external editor library
- `image`: store path, generate signed URL for display; cache URL in component state

---

## Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ [portal bubble]                                                    │
│ ┌────────────────────┐  ┌─────────────────────────────────────────┐│
│ │  VaultSidebar      │  │  PageView                               ││
│ │                    │  │                                         ││
│ │  ▾ Personal Misc   │  │  ◆ Endless Sky › Characters             ││
│ │    ▾ Pokemon       │  │                                         ││
│ │        Faves       │  │  ▾ Characters  [Grid] [Gallery] [⚙]    ││
│ │        Teams       │  │    ┌──────┬────────────┬──────┐         ││
│ │    Anime           │  │    │ Name │ Significance│ Age  │         ││
│ │  ▾ Endless Sky     │  │    ├──────┼────────────┼──────┤         ││
│ │    Characters      │  │    │ ...  │  [Tier 1]  │  16  │         ││
│ │    Places          │  │    └──────┴────────────┴──────┘         ││
│ │    Items           │  │  ▾ Notes  [text]                        ││
│ │  ▾ MTG             │  │    Lorem ipsum...                       ││
│ │  + New Space       │  │  + Add section                          ││
│ └────────────────────┘  └─────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

- Sidebar: ~220px fixed, independently scrollable
- PageView: fills remaining width, independently scrollable
- No topbar — portal bubble handles app switching

---

## VaultSidebar

### Tree structure
- Infinite nesting via `parent_id`
- Each node: ▸/▾ expand + name + hover actions
- Active page: `var(--gold)` text, no background pill
- Spaces are top-level group nodes (not navigable pages themselves)
- Space row: color dot + icon + name; hover shows ✎ edit, ✕ delete
- Tree indentation: 16px per level
- Connector lines: subtle `var(--s1)` vertical/horizontal lines between parent and children

### Interactions
- Click page name → navigate
- Click ▸ → expand only (does not navigate)
- Hover → ✎ rename, ✕ delete, + add child page
- Double-click name → inline rename
- Drag to reorder within siblings
- "+ New Space" at bottom of list
- Each expanded node: dim "+ page" as last child item

### Visual
- Space color dot glows in space color on hover
- No visible scrollbar at rest; thin custom scrollbar on hover

---

## PageView

### Header
- Breadcrumb: `Space › Parent › Page` — each segment clickable to navigate
- Page name: large Orbitron heading, click to edit inline
- `+ Add section` button → picker: Table / List / Text

### Sections
Each section wrapped in `SectionShell`:
- Section name (inline editable)
- Collapse ▾/▸
- View switcher for tables: [Grid] [Gallery]
- Add row / add item button
- Filter/sort button (tables only) — `var(--gold)` dot when active
- Delete ✕ (immediate, no confirm — consistent with Maya-OS)
- Drag handle (left edge, on hover) for reorder

---

## TableSection

### Grid view
- Sticky column header row
- Alternating row backgrounds (`var(--bg)` / `var(--bg-2)`)
- Row hover: left edge shows ✕ delete + ↗ open showcase (if registered)
- Last row: dim `+ add row`
- Column header right-click → rename / change type / delete / insert column left/right

### Cell editing
Click cell → edit in place.

| Type | Control |
|------|---------|
| text | `<input>` inline |
| rich_text | contenteditable, selection toolbar (B, I, link) |
| number | `<input type="number">` |
| select | Dropdown of colored options; add new option inline |
| multi_select | Multi-select dropdown; chips shown inline |
| date / datetime | Date picker |
| checkbox | Toggle on click immediately |
| url | `<input>`; renders as link in read mode |
| rating | Click star to set; same star clears |
| image | Opens upload panel (Supabase Storage) |
| relation | Row-picker modal: search rows from target table |

Blur or Enter saves. Escape cancels.

### Gallery view
- Cards 3–4 per row (responsive)
- Card: primary image fills top ~60%; name + key fields below
- Card hover: neon border glow in `var(--gold)`
- Clicking card → Showcase (if registered) or Focus Mode
- "+ add" card at end of grid

### Column management
- `+` at header end → inline panel: name + type + options
- Double-click header → rename
- Right-click header → Delete (cascades to all cells)
- Drag header to reorder
- Drag right edge to resize (width persisted)

### Filtering & sorting
- Filter panel slides down from SectionShell
- Filter rules: `[column] [operator] [value]` — multiple rules = AND
- Sort rules: `[column] [asc/desc]` — multiple = priority order
- Filters/sorts are per-view (Grid vs Gallery can differ) and persisted to DB

### Export / Import
- Export: CSV or JSON (user picks)
- Import: accepts CSV; maps columns by name; unmatched → offer as new columns
- Import is always **additive** — never replaces existing rows

---

## ListSection

- Checkable items, drag-to-reorder (same pattern as Maya-OS DailiesPanel)
- Checked items: dimmed in place, not hidden
- "Clear checked" button appears when any items are checked
- Add input at bottom (Enter adds, clears for next)
- Click text → edit inline; blur/Enter saves
- Right-click → Delete item

---

## TextSection

- Full-width contenteditable
- Minimal rich text: bold, italic, underline, link — floating toolbar on selection
- No block editor
- Autosaves on blur (debounced 500ms)
- In Focus Mode: fills viewport at comfortable reading width (~680px centered)

---

## Command Palette (`Cmd+K`)

Full-width overlay (~600px wide, ~25% from top). Primary navigation method.

### Search scope
- Page names
- Space names
- Section names
- Table row content (name/title column of each table)

### Behavior
- Results grouped: Pages, Rows, Sections
- Arrow keys navigate; Enter activates
- Page result → navigate to page
- Row result → open Showcase (if registered) or Focus Mode
- Escape closes
- Client-side search over cached index in vaultStore; instant results

### Visual
- Frosted dark overlay behind palette
- Input in Orbitron with blinking cursor
- Result rows: icon + name + muted breadcrumb path
- Active result: `var(--gold)` left accent bar + subtle background

---

## Focus Mode

**Hotkey: `F` while hovering a section, or from row ↗ button**

Full viewport. Minimal chrome. Content front and center. Edit/View toggle (see Showcase Mode section above).

- `✎ Edit` / `👁 View` toggle top-right (same behavior as Showcase — see above)
- Background: `var(--bg)` + grid texture at reduced opacity
- Content centered at reading width (~680px)
- **View mode**: clean reading experience, no input affordances
- **Edit mode**: text sections are live contenteditable; list items can be checked/edited/added; table cells are click-to-edit (same inline editing as PageView)
- Minimal controls in both modes: no column headers on tables, no section management (add/delete/reorder sections), but row add/delete and cell editing work in edit mode
- Escape or `F` to close
- `[` / `]` to move between sections of the same page

---

## Showcase Mode

**Trigger: ↗ on a row, or clicking a gallery card**

Full-screen overlay. A purpose-built React component renders the row's data in a beautiful layout. Falls back to a clean generic detail view if no template is registered.

### Edit / View toggle

Every showcase and focus mode instance has a **`✎ Edit` / `👁 View` toggle** in the top-right corner:

- **View mode** (default): pure presentation. No input borders, no hover affordances, no accidental edits. Text is static, tags are display-only, images are just images. This is the reading/admiring experience.
- **Edit mode**: same layout, but fields gain subtle hover affordances (faint `var(--b2)` border, pencil cursor). Click any field to edit in place. Click portrait to upload/replace. Click tags to open select dropdown. Changes save to Supabase immediately. Toggle back to View to admire.

The toggle applies identically to Showcase Mode and Focus Mode.

### ShowcaseRegistry
```js
// src/vault/components/showcase/ShowcaseRegistry.js

const registry = {};

export function registerShowcase(templateKey, component) {
  // templateKey matches sections.showcase_template field in DB
  // e.g. 'endless-sky-character', 'endless-sky-place'
  // NEVER use section UUIDs as keys — they differ per installation
  registry[templateKey] = component;
}

export function getShowcase(templateKey) {
  return registry[templateKey] || null;
}
```

To add a new showcase:
1. Create `src/vault/components/showcase/templates/MyShowcase.jsx`
2. In `VaultApp.jsx` `useEffect` on mount: `registerShowcase('my-template-key', MyShowcase)`
3. In Supabase, set `sections.showcase_template = 'my-template-key'` on the target section
4. Map row columns to layout zones in the template

No other files change.

---

## Showcase Templates

### Character Showcase (`endless-sky-character`)

**`CharacterShowcase.jsx`** — the premium template; designed around deep fantasy character profiles.

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ESC]                                              [👁 View] [✎ Edit] │
│                                                                          │
│  ┌──────────────────┐  ┌───────────────────────────────────────────┐    │
│  │                  │  │  TSUKASA HOSHINO                          │    │
│  │                  │  │  "The White Flame"              [Status]  │    │
│  │  [Portrait]      │  │                                           │    │
│  │                  │  │  [Tier 1] · [Female] · Age 16 · 5'4"     │    │
│  │                  │  │  [Human] [Half-Elf]                       │    │
│  │                  │  │                                           │    │
│  │                  │  │  [Lawful Good]  [ENFP]  🔵⚪ MTG          │    │
│  └──────────────────┘  └───────────────────────────────────────────┘    │
│                                                                          │
│  ╔══════════════════════════════════════════════════════════════════╗    │
│  ║  STATS                                                          ║    │
│  ║  STR ████░░ B    END ██████ A    AGI ████░░ B                   ║    │
│  ║  MAG ████████ S  INT ██████ A    WIS ████░░ B                   ║    │
│  ║  CHA ██████ A    TAR ████░░ B                                   ║    │
│  ╚══════════════════════════════════════════════════════════════════╝    │
│                                                                          │
│  ▾ PERSONALITY & IDENTITY                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Likes: ...              Dislikes: ...                           │   │
│  │  Hobbies: ...            Fav Food: ...                           │   │
│  │  Quirks: ...             Speech: ...                             │   │
│  │  Motives: ...            Philosophies: [tag] [tag]               │   │
│  │  Cultural Influence: ... Trauma: ...                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ APPEARANCE & PHYSICAL                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Appearance: [text block]                                        │   │
│  │  Physique: ...    Def Color: [swatch]    Visual Age: 16          │   │
│  │  Height: 5'4"    Weight: 110 lbs    Birthday: Mar 8              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ STORY & GROWTH                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Personal Problems: [text block]                                 │   │
│  │  Overall Strengths: ...    Overall Shortcomings: ...             │   │
│  │  Personal Growth Journey: [text block]                           │   │
│  │  Crit Char Flaws: ...     Transformations: ...                  │   │
│  │  Tropes: [chip] [chip]                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ COMBAT & ABILITIES                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Combat Style: ...    DnD Class: [chip]                          │   │
│  │  Top Abilities: ...                                              │   │
│  │  Activated Abilities: ...                                        │   │
│  │  Passive Abilities: ...                                          │   │
│  │  Basic Combat Skills: ...                                        │   │
│  │  Spec Equip: ...    Spec Talents: [chips]    Spec Faults: [chips]│   │
│  │  Elem Resistance: ...    Elem Weakness: ...                      │   │
│  │  DnD: STR 14  CON 12  DEX 16  INT 18  WIS 13  CHA 15           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ RELATIONSHIPS & WORLD                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Bonds: [Maya Mizuki] [Saya] [Valdora]                          │   │
│  │  Family: [chip] [chip]                                           │   │
│  │  Soul Signature: [chip]    Affiliations: ...                     │   │
│  │  Occupations: ...    Feats and Rep: ...                          │   │
│  │  Home World: [chip]    Current World: [chip]    Current Home: ...│   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ REFERENCE & META                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Song Casts: [chips]    VA Casts: [chips]    Concept Refs: [...]│   │
│  │  M. Briggs Persona: [chips]    Ability Growth Journey: ...      │   │
│  │  Main Persona Traits: [chips]                                    │   │
│  │  Work Note: ...    Other Notes: ...    Nicknames: ...            │   │
│  │  Char Images: [gallery grid]                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ EVERYTHING ELSE  (any unmapped columns, 2-col key/value grid)        │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Column mapping (case-insensitive, trimmed)

**Hero section (top)**
| Column | Placement |
|--------|-----------|
| Name | Large Orbitron heading, all-caps |
| Nicknames | Quoted subtitle below name (italic, `var(--t2)`) |
| Status | Colored chip, top-right of hero card |
| Significance | Colored tag inline below name |
| Gender Identity | Colored tag inline |
| Age | Inline stat |
| Height / Weight | Inline stats |
| Race 1, Race 2 | Tag chips on their own line |
| Alignment | Tag chips |
| M. Briggs Persona | Tag chips |
| MTG Colors | Color dots/chips |
| Icon | Favicon-sized image next to name (if present) |
| Char Images / Portrait / Image / Art | Portrait panel (~260px, left); first image is hero, rest go to gallery in Reference section |

**Stats block**
| Column | Placement |
|--------|-----------|
| STR, END, AGI, MAG, INT, WIS, CHA, TAR | Horizontal stat bars with rank label (relation displayed as tag) |

**Section: Personality & Identity**
| Column | Placement |
|--------|-----------|
| Likes, Dislikes, Hobbies, Fav Food | 2-column key/value pairs |
| Quirks, Speech, Motives | 2-column key/value |
| Philosophies | Tag chips |
| Cultural Influence, Trauma | Text blocks |

**Section: Appearance & Physical**
| Column | Placement |
|--------|-----------|
| Appearance, Physique | Text blocks |
| Def Color | Color swatch + name |
| Visual Age, Birthday | Inline stats |
| Height, Weight | Inline stats (also shown in hero for quick glance) |

**Section: Story & Growth**
| Column | Placement |
|--------|-----------|
| Personal Problems, Overall Strengths, Overall Shortcomings | Text blocks |
| Personal Growth Journey, Ability Growth Journey | Text blocks |
| Crit Char Flaws, Transformations | Text blocks |
| Tropes | Relation chips |

**Section: Combat & Abilities**
| Column | Placement |
|--------|-----------|
| Combat Style, Basic Combat Skills | Text blocks |
| Top Abilities, Activated Abilities, Passive Abilities | Text blocks (or bulleted if multiline) |
| Spec Equip | Text block |
| Spec Talents, Spec Faults | Relation chips |
| Elem Resistance, Elem Weakness | Text inline |
| DnD Class | Relation chip |
| DnD STR/CON/DEX/INT/WIS/CHA | Compact stat row (number values) |

**Section: Relationships & World**
| Column | Placement |
|--------|-----------|
| Bonds, Family | Relation chips (clickable → open that character's showcase) |
| Soul Signature | Relation chip |
| Affiliations, Occupations, Feats and Rep | Text blocks |
| Home World, Current World, Current Home | Relation chips |

**Section: Reference & Meta**
| Column | Placement |
|--------|-----------|
| Song Casts, VA Casts, Concept Refs | Relation chips |
| Main Persona Traits | Relation chips |
| Work Note, Other Notes | Text blocks |
| Char Images | Image gallery grid (thumbnails, click to expand) |

**Everything else**: 2-column key/value grid for any column not matched above.

#### Visual details
- Portrait: ~260px wide, `object-fit: cover`, neon border glow in Significance color; subtle scanline animation overlay
- Stat bars: thin horizontal bars, fill color based on rank tier (S=`var(--gold)`, A=`var(--grn)`, B=`var(--tel)`, C=`var(--slv)`, D+=`var(--hot)`)
- Each collapsible section: `▾`/`▸` toggle, section header in small-caps Orbitron, `var(--t3)`
- Sections remember collapsed state per-row in component state (not persisted)
- Relation chips: `var(--pur)` tint by default; clickable → opens that row's showcase
- Def Color: rendered as a small color swatch circle next to the token name
- Grid texture at reduced opacity on background
- All text blocks: `var(--text)` on `var(--bg)`, comfortable reading line-height

---

### Other Showcase Templates (planned, not yet built)

Detailed layouts for 6 additional templates — Place, Race, Ability, Item, Magic System, Element — are in **VAULT_SHOWCASE_PLANS.md**. Same shared behavior (column mapping, edit mode, collapsible sections).

---

## Navigation Hotkeys

| Key | Action |
|-----|--------|
| `Cmd+K` | Open Command Palette |
| `F` | Enter Focus Mode (hovered section) |
| `Escape` | Close Focus Mode / Showcase / Command Palette |
| `[` | Previous section (in Focus Mode) |
| `]` | Next section (in Focus Mode) |

---

## Empty States

| Context | Display |
|---------|---------|
| No spaces | Centered "No spaces yet." + create button |
| Empty page | Centered "+ Add section" with icon |
| Empty table | Column headers + `+ add row` row only |
| Empty list | Add-item input immediately, no message |
| Empty text section | Dim placeholder "Start writing…" (clears on focus — exception to Maya-OS no-placeholder rule; this is a prose area, not a task input) |

---

## v1 Scope Boundaries (explicitly out)

- No Kanban view (schema accommodates it; build later)
- No formula/computed columns (type slot reserved in schema; no v1 UI)
- No offline mode
- No sharing / public pages
- No version history
- No calendar view
- No inline video/embed
- No block-style page editor

---

## Known Traps for Claude Code

- **Cascade deletes**: deleting a space → all its pages → all their children → all sections → all rows/cells. Use Postgres `on delete cascade` rules + a single store function. Never cascade in components.
- **Tree loading**: fetch pages by space, build tree client-side. Do not recurse Supabase for each level.
- **Sparse cells**: not every row has a cell for every column. Always default: `cells[colId] ?? defaultForType(type)`. Never crash on undefined.
- **Select option colors**: store as token name string (`'gold'`, `'tel'`, `'pur'`). `TagChip` maps to `var(--token)`. Never store hex.
- **Image signed URLs**: generate on render, cache in component state with TTL. Do not store public URLs.
- **Command Palette index**: build and cache a flattened search index in vaultStore on load; update on mutations. Never query Supabase per keystroke in v1.
- **Showcase column mapping**: case-insensitive + trimmed matching. Warn (don't crash) on missing expected columns; degrade to OTHER FIELDS grid.
- **Rich text storage**: HTML string in v1. Not markdown — avoid parse complexity.
- **Relation row-picker**: load all rows of target table into picker on open (personal scale = fine). No pagination needed in v1.
- **`registerShowcase` timing**: call in `VaultApp.jsx` `useEffect` on mount, before any page renders. Registry is a module-level object — safe to populate once.
