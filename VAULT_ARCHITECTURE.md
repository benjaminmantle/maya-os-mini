# Vault — Architecture

## File Structure

```
src/vault/
├── VaultApp.jsx                        ← Root component; owns layout, active page, modal/mode state
├── store/
│   └── vaultStore.js                   ← ALL Supabase access; pub/sub pattern matching Maya store
├── hooks/
│   └── useVault.js                     ← React hook wrapping vaultStore; triggers re-renders
├── components/
│   ├── layout/
│   │   ├── VaultSidebar.jsx            ← Tree nav: spaces + pages (infinite nesting)
│   │   ├── PageView.jsx                ← Main area: renders a page's ordered sections
│   │   └── CommandPalette.jsx          ← Cmd+K overlay: search pages, rows, sections
│   ├── sections/
│   │   ├── TableSection.jsx            ← Table section: grid/gallery views, add/remove rows+cols
│   │   ├── ListSection.jsx             ← List section: checkable items, drag reorder
│   │   ├── TextSection.jsx             ← Free-form rich text (contenteditable, autosave)
│   │   └── SectionShell.jsx            ← Shared wrapper: name, collapse, view switcher, delete
│   ├── table/
│   │   ├── TableGrid.jsx               ← Standard row/column table view
│   │   ├── TableGallery.jsx            ← Card grid view
│   │   ├── TableFilters.jsx            ← Filter/sort panel (slides down from SectionShell)
│   │   ├── ColumnHeader.jsx            ← Header cell: name, type icon, resize handle, right-click menu
│   │   ├── CellRenderer.jsx            ← Read-mode cell: renders correct display per column type
│   │   ├── CellEditor.jsx              ← Edit-mode cell: renders correct input per column type
│   │   └── NewColumnPanel.jsx          ← Inline panel: name + type + options when adding a column
│   ├── showcase/
│   │   ├── ShowcaseModal.jsx           ← Full-screen overlay wrapper; renders registered template or fallback
│   │   ├── ShowcaseRegistry.js         ← Module-level map: showcase_template string → React component
│   │   └── templates/
│   │       ├── CharacterShowcase.jsx   ← Character profile (portrait, stats, personality, combat, relations)
│   │       ├── PlaceShowcase.jsx       ← Place/world/city (banner, description, inhabitants, connections)
│   │       ├── RaceShowcase.jsx        ← Race (art, traits, abilities, culture, notable members)
│   │       ├── AbilityShowcase.jsx     ← Ability (type, element, effects, known users)
│   │       ├── ItemShowcase.jsx        ← Item/weapon (art, stats, lore, owner)
│   │       ├── MagicSystemShowcase.jsx ← Magic system (overview, rules, elements, abilities)
│   │       └── ElementShowcase.jsx     ← Magic element (description, strengths/weaknesses, users)
│   ├── focus/
│   │   └── FocusMode.jsx               ← Full-screen minimal-chrome editor; [ / ] to move between sections
│   └── shared/
│       ├── TagChip.jsx                 ← Colored pill for select/multi-select options
│       ├── StarRating.jsx              ← 1–5 star widget (read + edit modes)
│       ├── RelationChip.jsx            ← Linked row chip; click opens that row's showcase
│       └── ImageUpload.jsx             ← Supabase Storage upload + signed URL display
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

## Supabase Schema (run in Supabase SQL editor)

```sql
-- Spaces: top-level grouping nodes
create table spaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon       text,
  color      text,  -- token name: 'gold', 'tel', 'pur', 'hot', 'grn', 'slv'
  position   integer,
  created_at timestamptz default now()
);

-- Pages: infinitely nestable via parent_id
create table pages (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid references spaces on delete cascade,
  parent_id  uuid references pages on delete cascade,  -- null = top-level within space
  name       text not null,
  position   integer,
  created_at timestamptz default now()
);

-- Sections: Table | List | Text
create table sections (
  id                 uuid primary key default gen_random_uuid(),
  page_id            uuid references pages on delete cascade,
  name               text,
  type               text not null check (type in ('table','list','text')),
  collapsed          boolean default false,
  position           integer,
  showcase_template  text,  -- e.g. 'endless-sky-character'; null = no showcase
  created_at         timestamptz default now()
);

-- Table columns
create table table_columns (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid references sections on delete cascade,
  name       text not null,
  type       text not null,
  -- valid types: text | rich_text | number | select | multi_select |
  --              date | datetime | checkbox | url | rating | image | relation
  options    jsonb,  -- [{ id: uuid, label: string, color: token_name }] for select types
  position   integer,
  width      integer default 160
);

-- Table rows
create table table_rows (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid references sections on delete cascade,
  position   integer,
  created_at timestamptz default now()
);

-- Table cells (sparse: not every row has every column)
create table table_cells (
  id        uuid primary key default gen_random_uuid(),
  row_id    uuid references table_rows on delete cascade,
  column_id uuid references table_columns on delete cascade,
  value     jsonb,
  unique (row_id, column_id)
);

-- List items
create table list_items (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid references sections on delete cascade,
  text       text not null default '',
  checked    boolean default false,
  position   integer
);

-- Text section content (1:1 with sections where type='text')
create table text_content (
  id      uuid primary key references sections on delete cascade,
  content text default ''  -- stored as HTML string
);

-- Relation links (for relation column type)
create table relation_links (
  id            uuid primary key default gen_random_uuid(),
  source_row_id uuid references table_rows on delete cascade,
  source_col_id uuid references table_columns on delete cascade,
  target_row_id uuid references table_rows on delete cascade
);
```

---

## Vault Store API (`vaultStore.js`)

Same pub/sub pattern as Maya's `store.js`. Holds Supabase client; components never call Supabase directly.

```js
// ── Spaces ────────────────────────────────────────────────
getSpaces()                              // returns Space[]
saveSpace(space)                         // upsert
deleteSpace(id)                          // cascades to pages → sections → rows/cells
reorderSpaces(ids)                       // reorder by id array

// ── Pages ─────────────────────────────────────────────────
getPages(spaceId)                        // returns Page[] for space (all, build tree client-side)
savePage(page)                           // upsert
deletePage(id)                           // cascades to children pages + sections
reorderPages(parentId, ids)

// ── Sections ──────────────────────────────────────────────
getSections(pageId)                      // returns Section[] ordered by position
saveSection(section)                     // upsert
deleteSection(id)                        // cascades to rows/cells or list_items or text_content
reorderSections(pageId, ids)
toggleSectionCollapsed(id)

// ── Table ─────────────────────────────────────────────────
getColumns(sectionId)                    // returns Column[]
addColumn(sectionId, column)
deleteColumn(sectionId, colId)           // cascades cells
renameColumn(sectionId, colId, name)
updateColumnOptions(sectionId, colId, options)
reorderColumns(sectionId, ids)
resizeColumn(colId, width)

getRows(sectionId)                       // returns Row[] with cells map
addRow(sectionId)                        // appends empty row, returns new row id
deleteRow(rowId)
setCellValue(rowId, colId, value)        // upsert into table_cells
reorderRows(sectionId, ids)

// ── List ──────────────────────────────────────────────────
getListItems(sectionId)
addListItem(sectionId, text)
updateListItem(itemId, patch)            // { text?, checked? }
deleteListItem(itemId)
reorderListItems(sectionId, ids)

// ── Text ──────────────────────────────────────────────────
getTextContent(sectionId)               // returns HTML string
setTextContent(sectionId, html)         // upsert into text_content; debounce call-site 500ms

// ── Relations ─────────────────────────────────────────────
getRelations(sourceRowId, sourceColId)  // returns target Row[]
addRelation(sourceRowId, sourceColId, targetRowId)
removeRelation(sourceRowId, sourceColId, targetRowId)

// ── Import / Export ───────────────────────────────────────
exportSectionCSV(sectionId)             // returns CSV string
exportSectionJSON(sectionId)            // returns JSON string
importSectionCSV(sectionId, csvString)  // additive; fresh UUIDs; map cols by name
importSectionJSON(sectionId, jsonStr)   // additive; fresh UUIDs

// ── Search index ──────────────────────────────────────────
buildSearchIndex()                      // builds flat array of { type, id, name, breadcrumb }
searchIndex(query)                      // client-side fuzzy match; returns results[]

// ── Pub/sub ───────────────────────────────────────────────
subscribe(fn)
unsubscribe(fn)
```

### Adding a new store function
```js
export async function myNewFunction(args) {
  const { data, error } = await supabase.from('table').select(...)
  if (error) throw error
  notify()  // calls all subscribers
  return data
}
```

### useVault hook
```js
export function useVault() {
  const [state, setState] = useState(getVaultSnapshot())
  useEffect(() => {
    subscribe(setState)
    return () => unsubscribe(setState)
  }, [])
  return state
}
```

---

## ShowcaseRegistry Pattern

```js
// ShowcaseRegistry.js
const registry = {}

export function registerShowcase(templateKey, component) {
  registry[templateKey] = component
}

export function getShowcase(templateKey) {
  return registry[templateKey] || null
}
```

```jsx
// VaultApp.jsx — register on mount
useEffect(() => {
  registerShowcase('endless-sky-character', CharacterShowcase)
  registerShowcase('endless-sky-place', PlaceShowcase)
  registerShowcase('endless-sky-race', RaceShowcase)
  registerShowcase('endless-sky-ability', AbilityShowcase)
  registerShowcase('endless-sky-item', ItemShowcase)
  registerShowcase('endless-sky-magic-system', MagicSystemShowcase)
  registerShowcase('endless-sky-element', ElementShowcase)
}, [])
```

Template key (`'endless-sky-character'`) must match `sections.showcase_template` in the DB.

---

## Column Type → Default Value Map

```js
function defaultForType(type) {
  switch (type) {
    case 'text':         return ''
    case 'rich_text':    return ''
    case 'number':       return null
    case 'select':       return null
    case 'multi_select': return []
    case 'date':         return null
    case 'datetime':     return null
    case 'checkbox':     return false
    case 'url':          return ''
    case 'rating':       return null
    case 'image':        return null
    case 'relation':     return []
    default:             return null
  }
}
```

---

## Common Patterns

### TagChip
```jsx
// color is a token name string: 'gold', 'tel', 'pur', etc.
<TagChip label={option.label} color={option.color} />

// In TagChip.jsx:
style={{ background: `color-mix(in srgb, var(--${color}) 20%, transparent)`,
         border: `1px solid var(--${color})`,
         color: `var(--${color})` }}
```

### Section drag-to-reorder
Same HTML5 drag pattern as Maya-OS DailiesPanel. `onDragStart` sets dragged id; `onDrop` calls `reorderSections(pageId, newIds)`.

### Infinite tree building (client-side)
```js
function buildTree(pages) {
  const map = {}
  const roots = []
  pages.forEach(p => map[p.id] = { ...p, children: [] })
  pages.forEach(p => {
    if (p.parent_id) map[p.parent_id]?.children.push(map[p.id])
    else roots.push(map[p.id])
  })
  return roots
}
```

### New CSS module
```jsx
import s from './MyComponent.module.css'
// <div className={s.myClass}>
```
All color/spacing values must reference tokens from `src/styles/tokens.css`.

---

## Key Decisions

| Decision | Reason |
|----------|--------|
| Supabase backend | Free tier covers personal scale; clean migration path to paid if productized |
| showcase_template string as registry key | UUIDs differ per installation; string keys are stable |
| Sparse cells (not a cell per row/col) | Columns added after rows shouldn't require backfilling |
| HTML string for rich text | Avoids markdown parse complexity in v1; can migrate to structured later |
| Client-side search index | Instant results; personal scale means index stays small |
| Infinite nesting via parent_id | Single self-join; tree built client-side |
| Import always additive | Never destroy existing data; consistent with Maya-OS import behavior |
