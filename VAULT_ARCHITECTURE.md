# Vault — Architecture

## File Structure

Files marked ✅ are implemented. Others are planned.

```
src/vault/
├── VaultApp.jsx               ✅  Root; sidebar + page view layout, initVault lifecycle, Cmd+K palette, sidebar resize
├── VaultApp.module.css        ✅  Includes .resizeHandle for sidebar drag-to-resize
├── store/
│   └── vaultStore.js          ✅  ALL data access; local/mock mode + Supabase mode; seed data; HMR-safe cache
├── hooks/
│   └── useVault.js            ✅  React hook wrapping vaultStore
├── components/
│   ├── layout/
│   │   ├── VaultSidebar.jsx   ✅  Tree nav: spaces + pages (infinite nesting), rename, add/delete, ⌘K hint
│   │   ├── PageView.jsx       ✅  Main area: breadcrumb nav, editable title, sections, empty state
│   │   └── CommandPalette.jsx ✅  Cmd+K search overlay, arrow nav, page navigation
│   ├── sections/
│   │   ├── SectionShell.jsx   ✅  Shared wrapper: name, collapse, delete, toolbar slot
│   │   ├── TableSection.jsx   ✅  Table section: grid/gallery toggle, filter bar, loads columns+rows
│   │   ├── ListSection.jsx    ✅  Checkable list, inline edit, add/delete, clear checked, drag-to-reorder
│   │   └── TextSection.jsx    ✅  contenteditable, debounced autosave, placeholder, rich text toolbar (B/I/U/link)
│   ├── table/
│   │   ├── TableGrid.jsx      ✅  Grid with inline editing, add/delete rows+cols, column sorting, add column panel, drag-to-reorder rows
│   │   ├── TableGallery.jsx   ✅  Card grid view: responsive, auto-fill, shows all field types, click-to-expand detail modal
│   │   ├── CellRenderer.jsx   ✅  Read-mode: text, number, select (TagChip), checkbox, rating, date, url, letter_grade (GradeBadge)
│   │   ├── CellEditor.jsx     ✅  Edit-mode: inputs, select/multi-select dropdowns, date picker, rating, letter grade picker
│   │   ├── ImportModal.jsx    ✅  CSV import: drop zone → preview with type detection → additive import
│   │   ├── RelationGraph.jsx  ✅  Force-directed SVG graph: nodes=rows, edges=relations, drag/zoom/pan
│   │   ├── ColumnHeader.jsx       Extracted header cell (planned; currently inline in TableGrid)
│   │   └── NewColumnPanel.jsx     Extracted add-column panel (planned; currently inline in TableGrid)
│   ├── showcase/
│   │   ├── ShowcaseRegistry.js ✅  Template registry: registerShowcase(key, component) / getShowcase(key)
│   │   ├── ShowcaseView.jsx   ✅  Split layout: name list (180px) + template render area
│   │   └── templates/
│   │       └── CharacterShowcase.jsx ✅  Character sheet: header, identity grid, radar chart, D&D block, tabs
│   ├── focus/
│   │   └── FocusMode.jsx          Full-screen editor (planned)
│   └── shared/
│       ├── TagChip.jsx        ✅  Colored pill using CSS token name strings
│       ├── StarRating.jsx     ✅  1–5 star widget (read + edit)
│       ├── GradeBadge.jsx     ✅  Colored badge for letter grades (F- through S+, GLITCH)
│       ├── RelationChip.jsx       Linked row chip (planned)
│       └── ImageUpload.jsx        Supabase Storage upload (planned)
└── styles/
    ├── VaultApp.module.css    ✅
    ├── VaultSidebar.module.css ✅
    ├── PageView.module.css    ✅
    ├── SectionShell.module.css ✅
    ├── TableGrid.module.css   ✅
    ├── TableGallery.module.css ✅
    ├── CommandPalette.module.css ✅
    ├── ListSection.module.css ✅
    ├── TextSection.module.css ✅
    ├── TagChip.module.css     ✅
    ├── StarRating.module.css  ✅
    ├── GradeBadge.module.css   ✅
    ├── ImportModal.module.css  ✅
    ├── ShowcaseView.module.css ✅
    ├── CharacterShowcase.module.css ✅
    ├── RelationGraph.module.css ✅
    └── FocusMode.module.css       (planned)
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
    case 'letter_grade': return null
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

### Space color picker
```jsx
// Available colors (defined as SPACE_COLORS in VaultSidebar.jsx):
const SPACE_COLORS = ['gold', 'hot', 'grn', 'pur', 'blu', 'ora', 'tel', 'slv'];

// Dot is a <button> with inline background style:
<button className={s.spaceDot} style={{ background: `var(--${sp.color || 'slv'})` }} />

// Clicking opens a popover with 8 swatches. Selecting calls saveSpace({ ...sp, color: c }).
// Outside-click closes via mousedown listener on document.
```

### Row / list item drag-to-reorder
Same HTML5 drag pattern as Maya-OS DailiesPanel. `⠿` drag handle appears on hover. `onDragStart` sets source id via ref; `onDragOver` highlights target with gold top-border; `onDrop` splices ID array and calls `reorderRows(sectionId, ids)` or `reorderListItems(sectionId, ids)`. Drag is disabled when table has an active column sort.

### Sidebar drag-to-resize
VaultApp.jsx maintains `sidebarWidth` state (default 220px, range 160–400px). A 4px `.resizeHandle` div sits between sidebar and content. `onMouseDown` starts resize; `document.addEventListener('mousemove')` updates width; `mouseup` persists to `localStorage('vault_sidebar_width')`. Width passed as inline `style` prop to VaultSidebar.

### Gallery card expand modal
Click a gallery card → `RowDetailModal` opens as a fixed overlay (z-index 500, frosted blur). Title is editable (click to edit). All fields show CellRenderer by default; click to switch to CellEditor. Checkboxes toggle immediately. Close via Escape or backdrop click. Uses `setCellValue()` for saves.

### Rich text toolbar
TextSection shows a B/I/U/🔗 toolbar on focus. Uses `document.execCommand()` for formatting. Toolbar buttons use `onMouseDown` with `e.preventDefault()` to prevent contenteditable blur. Link button preserves selection via `window.getSelection().getRangeAt(0)`, shows inline URL input, then calls `execCommand('createLink')` with restored selection.

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

### Letter Grade column type
```js
// Grade scale: 18 values ordered from worst to best
export const GRADE_SCALE = ['F-','F','F+','D-','D','D+','C-','C','C+','B-','B','B+','A-','A','A+','S','S+','GLITCH'];
export function gradeToNum(g) { return GRADE_SCALE.indexOf(g); }
export function gradeColor(g) { /* returns token name: t3/brn/grn/blu/pur/gold/hot */ }

// GradeBadge component uses color-mix with the tier token:
// background: color-mix(in srgb, var(--${color}) 18%, transparent)
// border: 1px solid color-mix(in srgb, var(--${color}) 45%, transparent)
// color: var(--${color})
```
Five touch points for any new column type: `defaultForType`, CellRenderer, CellEditor, TableGallery FieldValue, TableGrid sort logic.

### CSV Import
```js
parseCSV(csvString)                    // → string[][] (handles quoted fields, escaped quotes)
detectColumnType(values)               // → 'number'|'date'|'checkbox'|'letter_grade'|'url'|'text'
importSectionCSV(sectionId, csvString) // → { rowsAdded, columnsCreated }
```
Import is always additive (fresh UUIDs). ImportModal: 3-step flow (drop zone → preview with type override → import).

### Character Showcase
ShowcaseView receives rows, columns, templateKey. Left: scrollable name list (180px). Right: registered template.
CharacterShowcase uses `getField(name)` helper: finds column by case-insensitive name match → returns cell value.
8-axis SVG radar chart: `radarTip(i, frac)` maps grade fraction (gradeToNum/17) to x,y on a 75px radius.

### Relationship Graph
RelationGraph builds from `getAllRelations()` (returns all relation entries as `{ key: Set }`).
Force simulation: repulsion (coulomb N²) + spring attraction for edges + velocity damping.
~200 iterations via requestAnimationFrame, then settles. Nodes draggable, wheel zoom, background pan.

### Local-mode relations
```js
// Cache: C.relations = { "${rowId}:${colId}": Set<targetRowId> }
getRelationsSync(rowId, colId)  // → targetRowId[] (synchronous)
getAllRelations()                // → { key: targetRowId[] } (all relations)
addRelation(srcRowId, srcColId, tgtRowId)
removeRelation(srcRowId, srcColId, tgtRowId)
```

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
