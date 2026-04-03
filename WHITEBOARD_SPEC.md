# CosmiCanvas — Spec

## Overview

A personal infinite-canvas whiteboard app (CosmiCanvas), registered as a Portal Shell app alongside Maya OS and Vault. Primary use cases: entrepreneurship mapping (business model, strategy, ideas — all on one giant board) and Endless Sky worldbuilding (story timelines, character relationships, organization charts, plot flows). Solo-use, local-first. No auth, no collaboration.

The design reference is Excalidraw — same category of tool (infinite canvas, shape primitives, freehand, arrows, text). We are **not** porting Excalidraw code. We are building from scratch using informed design decisions. The aesthetic should inherit Maya OS design tokens and support all 6 themes.

---

## File Structure

```
src/whiteboard/
├── WhiteboardApp.jsx              ← root component, registered in Shell
├── WhiteboardApp.module.css
│
├── core/
│   ├── canvas.js                  ← canvas setup, render loop (requestAnimationFrame)
│   ├── camera.js                  ← pan/zoom transform state, coordinate conversions
│   ├── spatialIndex.js            ← quadtree for element hit-testing and culling
│   ├── history.js                 ← undo/redo command stack
│   └── constants.js               ← tool IDs, defaults, limits
│
├── store/
│   ├── whiteboardStore.js         ← element CRUD, board metadata, pub/sub (same pattern as Maya store)
│   └── idb.js                     ← IndexedDB wrapper (board data + image blobs)
│
├── elements/
│   ├── types.js                   ← element type definitions and factory functions
│   ├── bounds.js                  ← bounding box calculations, hit-testing math
│   ├── arrows.js                  ← arrow routing, connection point logic, bezier math
│   └── groups.js                  ← group/ungroup logic
│
├── render/
│   ├── renderer.js                ← orchestrator: iterates elements, delegates to active style
│   ├── styles/
│   │   ├── sketchStyle.js         ← roughjs-based hand-drawn renderer (default)
│   │   ├── cleanStyle.js          ← geometric/techno renderer
│   │   └── neonStyle.js           ← cyberpunk glow renderer (Canvas 2D shadowBlur)
│   └── minimap.js                 ← corner minimap renderer
│
├── tools/
│   ├── selectTool.js              ← select, move, resize, multi-select (marquee)
│   ├── shapeTool.js               ← rectangle, ellipse creation
│   ├── lineTool.js                ← line, arrow, freehand
│   ├── textTool.js                ← text placement and inline editing
│   └── imageTool.js               ← image paste, drop, upload, resize
│
├── components/
│   ├── Toolbar.jsx                ← floating tool palette (left edge or top)
│   ├── TabBar.jsx                 ← multi-board tab bar (open multiple boards)
│   ├── ContextMenu.jsx            ← right-click context menu on elements
│   ├── ColorPicker.jsx            ← inline color picker (small, not a modal)
│   ├── StyleSwitcher.jsx          ← render style toggle (sketch / clean / neon)
│   ├── Minimap.jsx                ← corner minimap overlay
│   └── ExportMenu.jsx             ← PNG / SVG / JSON export
│
├── hooks/
│   └── useWhiteboardStore.js      ← store subscription hook (same pattern as useStore.js)
│
└── styles/
    ├── Toolbar.module.css
    ├── ContextMenu.module.css
    ├── Minimap.module.css
    └── WhiteboardApp.module.css
```

---

## Shell Registration

In `src/Shell.jsx`, add to the `APPS` array:

```js
import WhiteboardApp from './whiteboard/WhiteboardApp.jsx';

const APPS = [
  { id: 'maya',  label: 'Maya OS', icon: '◆', component: App,           wrap: 'center' },
  { id: 'vault', label: 'Vault',   icon: '⬡', component: VaultApp,      wrap: 'full'   },
  { id: 'board', label: 'CosmiCanvas', icon: '▦', component: WhiteboardApp, wrap: 'full'   },
];
```

CosmiCanvas uses `wrap: 'full'` — it needs the entire viewport. The portal bubble sits on top as usual.

---

## Storage Architecture

### Why not localStorage

Maya OS core uses localStorage (`maya_os_v5`) for task/daily data — small JSON blobs, fine. The whiteboard will store images as binary blobs. A single pasted photo can be 500KB–5MB. localStorage caps at ~5–10MB total across the entire origin. IndexedDB has no practical limit (hundreds of MB, GB with user permission).

### IndexedDB design

`src/whiteboard/store/idb.js` — thin async wrapper around raw IndexedDB API (no library dependency).

Database: `maya_whiteboard`

Object stores:
- **boards** — `{ id, name, createdAt, updatedAt, camera: { x, y, zoom }, renderStyle, elements: [...] }`
  - `elements` is the full array of element objects (shapes, text, arrows, groups, images)
  - Image elements store a `blobKey` reference, NOT inline base64
- **blobs** — `{ key, data, mimeType, width, height }`
  - Key format: `img_${uid}`
  - `data` is a `Blob` or `ArrayBuffer`

Operations:
```js
export async function openDB()
export async function saveBoard(board)
export async function loadBoard(id)
export async function listBoards()          // returns [{ id, name, updatedAt }]
export async function deleteBoard(id)
export async function saveBlob(key, blob, mimeType, width, height)
export async function loadBlob(key)
export async function deleteBlob(key)
export async function deleteOrphanedBlobs(boardId)  // GC: remove blobs not referenced by any element
```

### Store pattern

`whiteboardStore.js` follows the exact same pub/sub pattern as `store.js` and `vaultStore.js`:

```js
if (!window.__boardListeners) window.__boardListeners = new Set();
const listeners = window.__boardListeners;
function notify() { listeners.forEach(fn => fn()); }
export function subscribe(fn) { listeners.add(fn); }
export function unsubscribe(fn) { listeners.delete(fn); }
```

In-memory state (`S`) holds the active board. Mutations update `S`, call `notify()`, and debounce-persist to IndexedDB (200ms trailing — don't write on every mouse move during drag).

### Multi-board support

Support multiple boards from the start. The whiteboard app opens to a board picker (list of boards, "New Board" button). Selecting a board loads it. This is important for the use cases — one board for entrepreneurship, one for Endless Sky, etc. Keep it simple: a list, not a fancy gallery.

---

## Canvas Architecture

### HTML Canvas (not SVG)

Use a single `<canvas>` element filling the viewport. All elements rendered via Canvas 2D API. Reasons:
- Better performance at scale (hundreds/thousands of elements)
- Consistent rendering with roughjs (which draws to Canvas)
- Easier pan/zoom (just transform the context)

### Camera (pan/zoom)

`camera.js` manages the view transform: `{ x, y, zoom }`.

- **Pan**: middle-click drag, or space + left-click drag
- **Zoom**: scroll wheel (centered on cursor position)
- **Zoom range**: 5% to 6400% (generous but not infinite — avoids floating-point precision issues at extremes)
- **Zoom-to-fit**: keyboard shortcut to frame all elements

Coordinate conversion:
```js
// Screen pixel → canvas world coordinate
export function screenToWorld(sx, sy, camera) {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom,
  };
}

// Canvas world coordinate → screen pixel
export function worldToScreen(wx, wy, camera) {
  return {
    x: wx * camera.zoom + camera.x,
    y: wy * camera.zoom + camera.y,
  };
}
```

### Render loop

`requestAnimationFrame` loop. Only re-render when dirty (element change, camera change, hover state change). Use a `dirty` flag — set it on any mutation, clear it after render.

Render order:
1. Clear canvas
2. Apply camera transform (`ctx.setTransform(zoom, 0, 0, zoom, camera.x, camera.y)`)
3. Cull elements outside viewport (quadtree query)
4. Render visible elements in z-order via active style renderer
5. Render selection handles, hover outlines (UI layer — not affected by style mode)
6. Reset transform
7. Render minimap (screen-space, fixed position)
8. Render selection marquee if active (screen-space)

### Spatial index (quadtree)

`spatialIndex.js` — standard quadtree over element bounding boxes. Rebuilt on element add/remove/move. Used for:
- Hit-testing (which element is under the cursor?)
- Viewport culling (which elements are visible at current camera?)
- Future: level-of-detail decisions for semantic zoom

---

## Element Model

Every element is a plain JS object:

```js
{
  id: 'el_abc123',
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text' | 'image',
  x: 100,
  y: 200,
  width: 300,          // not used by line/arrow/freehand
  height: 150,         // not used by line/arrow/freehand
  points: [],          // for line, arrow, freehand: array of { x, y } relative to (x, y)
  rotation: 0,         // radians, future use
  zIndex: 1,
  groupId: null,       // ID of parent group, or null

  // Style
  strokeColor: '#ddd9d6',    // token-resolved hex
  fillColor: 'transparent',
  strokeWidth: 2,
  fillStyle: 'solid',        // 'solid' | 'hachure' | 'cross-hatch' | 'none' (roughjs fill styles)
  opacity: 1,

  // Type-specific
  text: '',                   // for type: 'text'
  fontSize: 20,               // for type: 'text'
  fontFamily: 'hand' | 'mono' | 'sans',
  textAlign: 'left' | 'center' | 'right',

  arrowStart: 'none' | 'arrow' | 'dot',    // for type: 'arrow'
  arrowEnd: 'arrow' | 'none' | 'dot',
  bendPoints: [],             // control points for curved arrows: [{ x, y }]

  blobKey: null,              // for type: 'image' — reference to blobs store
  cropShape: 'rect',          // for type: 'image' — 'rect' | 'circle' | 'roundedRect'
  cropOffset: { x: 0, y: 0, zoom: 1 },  // crop adjustment within the shape mask

  // Connections (arrows)
  startBinding: null,         // { elementId, point: 'top'|'right'|'bottom'|'left'|'center' }
  endBinding: null,
}
```

### Groups

A group is not a separate element type. It's an ID referenced by `groupId` on member elements. Group metadata (if needed) stored in a `groups` map on the board:

```js
board.groups = {
  'grp_xyz': { id: 'grp_xyz', label: '' }
}
```

Select any member → entire group selects. Move/resize applies to all members. Ungroup clears `groupId`.

---

## Render Style Abstraction

### Interface

Each style module exports:

```js
export function renderElement(ctx, element, isSelected, isHovered)
export function getName()  // 'Sketch' | 'Clean' | ...
```

The orchestrator in `renderer.js` calls the active style's `renderElement` for each visible element.

### Sketch style (default)

Uses [roughjs](https://roughjs.com/) — `rough.canvas(canvasEl)`. Maps element properties to roughjs options:
- `strokeColor` → `stroke`
- `fillColor` → `fill`
- `fillStyle` → roughjs fill style (hachure, cross-hatch, solid, etc.)
- `strokeWidth` → `strokeWidth`
- Roughness/bowing configurable per-board (default: `roughness: 1, bowing: 1`)

Text rendered with Canvas 2D `fillText` using a handwriting-style font (Virgil or similar — bundle as a local font file, don't rely on Google Fonts CDN).

### Clean style

Pure Canvas 2D geometric rendering. Sharp edges, solid fills, no roughness. Uses `var(--f)` (Rajdhani) for text to match the Maya OS techno aesthetic.

### Future styles

The abstraction allows adding more styles later without touching element data or core logic. Just add a new file in `render/styles/` and register it.

---

## Tools

### General interaction model

- **Left-click** — use current tool (draw shape, place text, select)
- **Right-click** — context menu on elements (always, regardless of active tool)
- **Middle-click drag** — pan (always, regardless of active tool)
- **Space + left-click drag** — pan (alternative)
- **Scroll wheel** — zoom
- **Double-click** — enter text edit mode on text elements; enter text creation at click point on empty canvas
- **Escape** — cancel current operation, deselect, close menus
- **Delete / Backspace** — delete selected elements

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `V` or `1` | Select tool |
| `R` or `2` | Rectangle |
| `E` or `3` | Ellipse |
| `L` or `4` | Line |
| `A` or `5` | Arrow |
| `D` or `6` | Freehand (draw) |
| `T` or `7` | Text |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+G` | Group selection |
| `Ctrl+Shift+G` | Ungroup |
| `Ctrl+A` | Select all |
| `Ctrl+C` / `Ctrl+V` | Copy / paste elements |
| `Ctrl+D` | Duplicate selection |
| `Ctrl+S` | Force save (normally auto-saves) |
| `Ctrl+Shift+E` | Export menu |
| `[` / `]` | Send backward / bring forward |
| `Ctrl+[` / `Ctrl+]` | Send to back / bring to front |
| `Shift` (while drawing) | Constrain to square/circle/45° lines |
| `Alt` (while drawing) | Draw from center |
| `Ctrl+0` | Zoom to fit all elements |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |

### Select tool

- Click element → select it (show 8 resize handles + rotation handle)
- Click empty → deselect
- Drag on empty → marquee selection (select all elements intersecting the rectangle)
- Drag on selected element → move
- Drag on resize handle → resize (Shift to maintain aspect ratio)
- Tab → cycle selection to next element in z-order
- Multi-select: Shift+click to toggle individual elements in selection

### Shape tool (rectangle, ellipse)

- Click and drag → create shape from corner to corner
- Shift → constrain to square / circle
- Alt → draw from center instead of corner
- After creation, switch to select tool with new element selected

### Line / Arrow tool

- Click start → drag → release end
- For arrows: after creation, control points appear on the line. Drag them to create bends.
- **Arrow types**: straight (0 control points), quadratic bend (1 control point), cubic S-curve (2 control points). Add control points by double-clicking the arrow body.
- **Connection snapping**: when dragging an arrow endpoint near a shape, snap to the nearest connection point (top/right/bottom/left/center). Show a visual indicator (blue dot) when snapping. Bound arrows move with their connected shapes.

### Freehand tool

- Click and drag → draw freehand path
- Points recorded at pointer events; simplified on release (Ramer–Douglas–Peucker or similar to reduce point count)

### Text tool

- Click on empty → place text cursor, open inline text editor
- Text editor is a `<textarea>` overlay positioned at the element's screen position, styled to match the canvas font. On blur or Enter (with Shift+Enter for newline), the text is committed to the element and the overlay removed.
- Double-click existing text element → re-enter edit mode

### Image tool (passive — no toolbar button)

Images are added via:
1. **Clipboard paste** (`Ctrl+V`) — if clipboard contains image data, create an image element at viewport center
2. **Drag and drop** — drop image file(s) onto canvas
3. **Context menu** → "Insert image" → file picker

On insertion:
- Read the file as a Blob
- Store in IndexedDB blobs store
- Create an image element with `blobKey` reference
- Set initial size to image natural dimensions, capped at 800px on the longest side
- Place at viewport center (paste) or drop position (drag)

Image elements support:
- Resize with handles (Shift for aspect lock — default ON for images)
- `cropShape`: right-click → "Crop shape" → rect / circle / rounded rect. Applies a clip path during rendering.
- `cropOffset`: when crop shape is active, Shift+drag on the image adjusts the image position within the crop window.

---

## Context Menu

Right-click on element(s) shows a context menu with:

- **Style section**: stroke color, fill color, stroke width (as small inline controls, not sub-menus)
- **Arrange**: Bring forward / Send backward / Bring to front / Send to back
- **Group** / **Ungroup** (if multiple selected or already grouped)
- **Duplicate**
- **Copy / Paste**
- **Delete**
- For images: **Crop shape** → rect / circle / rounded rect
- For arrows: **Arrow start** → none / arrow / dot; **Arrow end** → none / arrow / dot

Right-click on empty canvas:
- **Paste** (if elements in clipboard)
- **Insert image**
- **Select all**
- **Zoom to fit**

---

## Undo / Redo

Command pattern in `history.js`:

```js
const MAX_HISTORY = 200;

export function pushCommand(command)    // { type, before, after, elementIds }
export function undo()                  // returns the command to reverse
export function redo()                  // returns the command to reapply
export function canUndo()
export function canRedo()
export function clear()
```

Every mutation (create, delete, move, resize, style change, group, ungroup) pushes a command. Undo restores `before` state, redo restores `after` state. History cleared on board switch.

---

## Minimap

Small rectangle in the bottom-right corner (200×140px, semi-transparent background). Shows:
- All elements as simplified colored rectangles/dots (no detail rendering)
- A viewport rectangle showing current camera position
- Click or drag on the minimap to navigate

Hidden when the board is empty or has very few elements. Toggleable via a small button.

---

## Export

### PNG export
- Render all elements (or selection) to an off-screen canvas at 2× resolution
- Add padding (20px)
- `canvas.toBlob()` → download

### SVG export
- Build SVG markup from element data
- Text as `<text>`, shapes as `<rect>`, `<ellipse>`, `<path>`, etc.
- Images embedded as `<image>` with base64 data URI
- Download as `.svg`

### JSON export (LLM-readable)
- The killer export. Structured representation of the entire board:
```json
{
  "name": "Endless Sky — Act 1 Plot Map",
  "exportedAt": "2026-03-20T...",
  "elements": [
    {
      "id": "el_1",
      "type": "text",
      "position": { "x": 100, "y": 200 },
      "text": "Tsukasa discovers her powers",
      "connections": {
        "outgoingArrows": ["el_5"],
        "incomingArrows": ["el_3"]
      },
      "group": "Act 1 — Setup"
    },
    {
      "id": "el_5",
      "type": "arrow",
      "from": { "elementId": "el_1", "label": "Tsukasa discovers her powers" },
      "to": { "elementId": "el_2", "label": "First encounter with Valdora" },
      "label": ""
    }
  ],
  "groups": [
    { "name": "Act 1 — Setup", "elementCount": 12 }
  ],
  "summary": {
    "totalElements": 47,
    "textElements": 18,
    "connections": 23,
    "images": 6
  }
}
```
- Resolves connections: arrows list their source and target element labels (not just IDs)
- Groups listed with names
- Images referenced by description (not embedded — too large)
- An LLM receiving this JSON can understand the full board: what's connected to what, the flow, the groupings

---

## Color Palette

The whiteboard uses Maya OS design tokens for UI chrome (toolbar, menus, panels). For drawing colors, provide a curated palette that works across all themes:

Default palette (accessible from color picker):
```
#ddd9d6  (--text)
#f0b030  (--gold)
#ff3060  (--hot)
#22ee80  (--grn)
#4488ff  (--blu)
#9955ff  (--pur)
#ff7030  (--ora)
#20c8d8  (--tel)
#ff80b0  (--pnk)
#ffffff
#000000
transparent
```

Plus a "custom color" option (hex input or simple HSL picker).

Element defaults:
- Stroke: `var(--text)` resolved hex
- Fill: transparent
- Stroke width: 2
- Text: `var(--text)` resolved hex

---

## Responsive / Layout

The whiteboard is full-viewport (`wrap: 'full'`). The canvas `<canvas>` element fills `100vw × 100vh`. Toolbar floats on the left edge (or top — decide during implementation based on what feels better). All UI overlays (toolbar, minimap, context menu) are absolutely positioned above the canvas.

The canvas must handle `window.resize` — update canvas dimensions and re-render.

Desktop-first (mouse + keyboard). Touch/pointer events added in Phase 5 (pinch zoom, two-finger pan, tap to select).

---

## Dependencies

New npm packages:
- **roughjs** — hand-drawn style rendering

That's it. No other new dependencies. IndexedDB is native. Canvas 2D is native. Font files bundled locally.

---

## Phases (implementation order)

### Phase 1 — Canvas + camera + storage
1. Create `src/whiteboard/` directory structure
2. Register in Shell (`APPS` array, lazy import)
3. `idb.js` — IndexedDB wrapper
4. `whiteboardStore.js` — board CRUD, pub/sub, debounced persist
5. `useWhiteboardStore.js` hook
6. `WhiteboardApp.jsx` — board picker screen (list boards, create new, delete)
7. `canvas.js` + `camera.js` — canvas element, render loop, pan/zoom
8. `spatialIndex.js` — quadtree
9. `renderer.js` + style abstraction skeleton
10. `constants.js`

**Verification**: Can create a board, see an empty canvas, pan and zoom. Board persists across reload.

### Phase 2 — Drawing primitives + select
1. `types.js` — element factory functions
2. `bounds.js` — bounding box, hit-testing
3. `selectTool.js` — select, move, resize handles, marquee
4. `shapeTool.js` — rectangle, ellipse
5. `lineTool.js` — line, freehand
6. `textTool.js` — text placement, inline editing
7. `sketchStyle.js` — roughjs renderer (install roughjs)
8. `cleanStyle.js` — geometric renderer
9. `Toolbar.jsx` — tool palette with keyboard shortcuts
10. `StyleSwitcher.jsx` — sketch/clean toggle
11. `history.js` — undo/redo

**Verification**: Can draw shapes, text, freehand. Select, move, resize. Undo/redo works. Can toggle sketch/clean style.

### Phase 3 — Arrows + context menu + groups
1. `arrows.js` — straight, quadratic, cubic bezier; connection points on shapes; arrow routing
2. Arrow tool in `lineTool.js`
3. `ContextMenu.jsx` — right-click menu with style controls
4. `ColorPicker.jsx` — inline color picker
5. `groups.js` — group/ungroup logic
6. Z-ordering controls
7. Copy/paste/duplicate

**Verification**: Can create arrows that snap to shapes and follow them on move. Curved arrows work. Right-click gives style options. Groups work.

### Phase 4 — Images + export + minimap
1. `imageTool.js` — paste, drag-drop, file upload
2. Image rendering with crop shapes
3. Image blob storage in IndexedDB
4. `ExportMenu.jsx` — PNG, SVG, JSON export
5. `Minimap.jsx` — corner minimap with navigation
6. Orphaned blob cleanup

**Verification**: Can paste/drop images, resize them, change crop shape. All three export formats work. Minimap shows board overview and responds to clicks.

### Phase 5 — Polish (complete)
1. Alignment guides (snap to edges/centers of other elements, dashed blue lines)
2. Keyboard shortcut help overlay
3. Neon render style (cyberpunk glow via Canvas 2D shadowBlur, double-pass rendering)
4. Pointer/touch events (pinch zoom, two-finger pan, `setPointerCapture`)
5. Performance: silent drag updates (`updateElementsSilent`), struct-versioned spatial index rebuild
6. Multi-board tabs (open multiple boards, tab bar with switch/close, "+" to add)

---

## Critical Rules

**Store discipline** — ALL whiteboard data access goes through `whiteboardStore.js`. No direct IndexedDB calls in components.

**No localStorage for whiteboard data** — board data and images go to IndexedDB exclusively. Only tiny config (last-opened board ID, toolbar state) may use localStorage with `maya_board_` prefix.

**Aesthetic** — UI chrome (toolbar, menus, panels) uses CSS variables from `tokens.css`. Drawing colors are user-chosen per-element; defaults reference token values but are stored as resolved hex on the element (elements must be self-contained, not theme-dependent).

**No confirm() dialogs** — same rule as Maya and Vault.

**Canvas element must not be React-managed** — the `<canvas>` DOM element is created once and never re-rendered by React. All drawing is imperative via the Canvas 2D API. React manages only the overlay UI (toolbar, menus, dialogs). The canvas ref is passed via `useRef`.

**Z-index budget** — whiteboard overlays (toolbar, context menu, minimap) must stay below z-index 9000. Shell bubble is 9999.

**Image blobs are never serialized to JSON** — the board JSON (save format) stores `blobKey` references. Blobs live in a separate IndexedDB object store. Export formats handle images differently: PNG renders them, SVG embeds base64, JSON references them by description.

**Debounced persistence** — mutations queue a 200ms trailing debounce to IndexedDB. Do not write on every mouse-move pixel during drag operations. Persist immediately on board switch, tab close (`beforeunload`), and explicit Ctrl+S.

**Roughjs is the only new dependency** — do not add Canvas abstraction libraries (Fabric.js, Konva, Paper.js). We want full control over the render pipeline.
