import { createClient } from '@supabase/supabase-js';

// ── Supabase client ─────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR_PROJECT'))
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const LOCAL = !supabase; // true = mock/local mode (in-memory only)

// ── Pub/sub (same pattern as Maya store) ────────────────────
if (!window.__vaultListeners) window.__vaultListeners = new Set();
const listeners = window.__vaultListeners;

function notify() { listeners.forEach(fn => fn()); }
export function subscribe(fn) { listeners.add(fn); }
export function unsubscribe(fn) { listeners.delete(fn); }

// ── Tiny UUID for local mode ────────────────────────────────
let _seq = 0;
function lid() { return `local-${Date.now()}-${++_seq}`; }

// ── In-memory cache ─────────────────────────────────────────
if (!window.__vaultCache) window.__vaultCache = {
  spaces: [],
  pages: {},       // spaceId → Page[]
  sections: {},    // pageId  → Section[]
  columns: {},     // sectionId → Column[]
  rows: {},        // sectionId → Row[] (each has .cells map)
  listItems: {},   // sectionId → ListItem[]
  textContent: {}, // sectionId → HTML string
  relations: {},   // `${sourceRowId}:${sourceColId}` → Set of targetRowIds
  searchIndex: [],
  ready: false,
  _allPages: [],   // flat list of every page (for breadcrumbs, tree)
};
const C = window.__vaultCache;

export function getVaultSnapshot() { return { ...C }; }
export function isConnected() { return supabase !== null; }

// ── Helpers ─────────────────────────────────────────────────
function sb() {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export function defaultForType(type) {
  switch (type) {
    case 'text':         return '';
    case 'rich_text':    return '';
    case 'number':       return null;
    case 'select':       return null;
    case 'multi_select': return [];
    case 'date':         return null;
    case 'datetime':     return null;
    case 'checkbox':     return false;
    case 'url':          return '';
    case 'rating':       return null;
    case 'image':        return null;
    case 'relation':     return [];
    case 'letter_grade': return null;
    default:             return null;
  }
}

// ── Letter grade utilities ──────────────────────────────────
export const GRADE_SCALE = ['F-','F','F+','D-','D','D+','C-','C','C+','B-','B','B+','A-','A','A+','S','S+','GLITCH'];

export function gradeToNum(g) {
  const idx = GRADE_SCALE.indexOf(g);
  return idx >= 0 ? idx : -1;
}

export function gradeColor(g) {
  if (g === 'GLITCH') return 'hot';
  const idx = GRADE_SCALE.indexOf(g);
  if (idx < 0) return 't3';
  if (idx <= 2) return 't3';   // F tier — dim grey
  if (idx <= 5) return 'brn';  // D tier — brown
  if (idx <= 8) return 'grn';  // C tier — green
  if (idx <= 11) return 'blu'; // B tier — blue
  if (idx <= 14) return 'pur'; // A tier — purple
  return 'gold';                // S tier — gold
}

// ── Spaces ──────────────────────────────────────────────────
export async function loadSpaces() {
  if (LOCAL) { notify(); return C.spaces; }
  const { data, error } = await sb().from('spaces').select('*').order('position');
  if (error) throw error;
  C.spaces = data;
  notify();
  return data;
}

export function getSpaces() { return C.spaces; }

export async function saveSpace(space) {
  if (LOCAL) {
    const idx = C.spaces.findIndex(s => s.id === space.id);
    if (idx >= 0) Object.assign(C.spaces[idx], space);
    else {
      const ns = { id: lid(), position: C.spaces.length, created_at: new Date().toISOString(), ...space };
      C.spaces.push(ns);
      C.pages[ns.id] = [];
      space = ns;
    }
    notify();
    return space;
  }
  const { data, error } = await sb().from('spaces').upsert(space).select().single();
  if (error) throw error;
  await loadSpaces();
  return data;
}

export async function deleteSpace(id) {
  if (LOCAL) {
    C.spaces = C.spaces.filter(s => s.id !== id);
    // cascade: remove pages, sections, etc.
    const pageIds = (C.pages[id] || []).map(p => p.id);
    delete C.pages[id];
    pageIds.forEach(pid => {
      const secs = C.sections[pid] || [];
      secs.forEach(sec => { delete C.columns[sec.id]; delete C.rows[sec.id]; delete C.listItems[sec.id]; delete C.textContent[sec.id]; });
      delete C.sections[pid];
    });
    C._allPages = C._allPages.filter(p => p.space_id !== id);
    notify();
    return;
  }
  const { error } = await sb().from('spaces').delete().eq('id', id);
  if (error) throw error;
  await loadSpaces();
}

export async function reorderSpaces(ids) {
  if (LOCAL) {
    C.spaces.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    C.spaces.forEach((s, i) => s.position = i);
    notify();
    return;
  }
  const updates = ids.map((id, i) => ({ id, position: i }));
  const { error } = await sb().from('spaces').upsert(updates);
  if (error) throw error;
  await loadSpaces();
}

// ── Pages ───────────────────────────────────────────────────
export async function loadPages(spaceId) {
  if (LOCAL) {
    if (!C.pages[spaceId]) C.pages[spaceId] = [];
    notify();
    return C.pages[spaceId];
  }
  const { data, error } = await sb().from('pages').select('*').eq('space_id', spaceId).order('position');
  if (error) throw error;
  C.pages[spaceId] = data;
  notify();
  return data;
}

export function getPages(spaceId) { return C.pages[spaceId] || []; }
export function getAllPages() { return C._allPages; }

export async function savePage(page) {
  if (LOCAL) {
    const spacePages = C.pages[page.space_id] || [];
    const idx = spacePages.findIndex(p => p.id === page.id);
    if (idx >= 0) {
      Object.assign(spacePages[idx], page);
      // sync _allPages
      const ai = C._allPages.findIndex(p => p.id === page.id);
      if (ai >= 0) Object.assign(C._allPages[ai], page);
    } else {
      const np = { id: lid(), position: spacePages.length, parent_id: null, created_at: new Date().toISOString(), ...page };
      spacePages.push(np);
      C.pages[page.space_id] = spacePages;
      C.sections[np.id] = [];
      C._allPages.push(np);
      page = np;
    }
    notify();
    return page;
  }
  const { data, error } = await sb().from('pages').upsert(page).select().single();
  if (error) throw error;
  await loadPages(data.space_id);
  return data;
}

export async function deletePage(id) {
  if (LOCAL) {
    const page = C._allPages.find(p => p.id === id);
    if (!page) return;
    // cascade children
    const childIds = C._allPages.filter(p => p.parent_id === id).map(p => p.id);
    for (const cid of childIds) await deletePage(cid);
    // cascade sections
    const secs = C.sections[id] || [];
    secs.forEach(sec => { delete C.columns[sec.id]; delete C.rows[sec.id]; delete C.listItems[sec.id]; delete C.textContent[sec.id]; });
    delete C.sections[id];
    C.pages[page.space_id] = (C.pages[page.space_id] || []).filter(p => p.id !== id);
    C._allPages = C._allPages.filter(p => p.id !== id);
    notify();
    return;
  }
  const { data: page } = await sb().from('pages').select('space_id').eq('id', id).single();
  const { error } = await sb().from('pages').delete().eq('id', id);
  if (error) throw error;
  if (page) await loadPages(page.space_id);
}

export async function reorderPages(parentId, ids) {
  if (LOCAL) {
    // Reorder in the appropriate pages array
    for (const pages of Object.values(C.pages)) {
      ids.forEach((id, i) => {
        const p = pages.find(pg => pg.id === id);
        if (p) p.position = i;
      });
    }
    notify();
    return;
  }
  const updates = ids.map((id, i) => ({ id, position: i }));
  const { error } = await sb().from('pages').upsert(updates);
  if (error) throw error;
  notify();
}

// ── Sections ────────────────────────────────────────────────
export async function loadSections(pageId) {
  if (LOCAL) {
    if (!C.sections[pageId]) C.sections[pageId] = [];
    notify();
    return C.sections[pageId];
  }
  const { data, error } = await sb().from('sections').select('*').eq('page_id', pageId).order('position');
  if (error) throw error;
  C.sections[pageId] = data;
  notify();
  return data;
}

export function getSections(pageId) { return C.sections[pageId] || []; }

export async function saveSection(section) {
  if (LOCAL) {
    const pageSecs = C.sections[section.page_id] || [];
    const idx = pageSecs.findIndex(s => s.id === section.id);
    if (idx >= 0) {
      Object.assign(pageSecs[idx], section);
    } else {
      const ns = { id: lid(), position: pageSecs.length, collapsed: false, showcase_template: null, created_at: new Date().toISOString(), ...section };
      pageSecs.push(ns);
      C.sections[section.page_id] = pageSecs;
      if (ns.type === 'table') { C.columns[ns.id] = []; C.rows[ns.id] = []; }
      if (ns.type === 'list') { C.listItems[ns.id] = []; }
      if (ns.type === 'text') { C.textContent[ns.id] = ''; }
      section = ns;
    }
    notify();
    return section;
  }
  const { data, error } = await sb().from('sections').upsert(section).select().single();
  if (error) throw error;
  await loadSections(data.page_id);
  return data;
}

export async function deleteSection(id) {
  if (LOCAL) {
    for (const [pageId, secs] of Object.entries(C.sections)) {
      const idx = secs.findIndex(s => s.id === id);
      if (idx >= 0) {
        secs.splice(idx, 1);
        delete C.columns[id]; delete C.rows[id]; delete C.listItems[id]; delete C.textContent[id];
        notify();
        return;
      }
    }
    return;
  }
  const { data: section } = await sb().from('sections').select('page_id').eq('id', id).single();
  const { error } = await sb().from('sections').delete().eq('id', id);
  if (error) throw error;
  if (section) await loadSections(section.page_id);
}

export async function reorderSections(pageId, ids) {
  if (LOCAL) {
    const secs = C.sections[pageId] || [];
    secs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    secs.forEach((s, i) => s.position = i);
    notify();
    return;
  }
  const updates = ids.map((id, i) => ({ id, position: i }));
  const { error } = await sb().from('sections').upsert(updates);
  if (error) throw error;
  await loadSections(pageId);
}

export async function toggleSectionCollapsed(id) {
  if (LOCAL) {
    for (const secs of Object.values(C.sections)) {
      const sec = secs.find(s => s.id === id);
      if (sec) { sec.collapsed = !sec.collapsed; notify(); return; }
    }
    return;
  }
  const { data: section } = await sb().from('sections').select('collapsed, page_id').eq('id', id).single();
  if (!section) return;
  const { error } = await sb().from('sections').update({ collapsed: !section.collapsed }).eq('id', id);
  if (error) throw error;
  await loadSections(section.page_id);
}

// ── Table: Columns ──────────────────────────────────────────
export async function loadColumns(sectionId) {
  if (LOCAL) { notify(); return C.columns[sectionId] || []; }
  const { data, error } = await sb().from('table_columns').select('*').eq('section_id', sectionId).order('position');
  if (error) throw error;
  C.columns[sectionId] = data;
  notify();
  return data;
}

export function getColumns(sectionId) { return C.columns[sectionId] || []; }

export async function addColumn(sectionId, column) {
  if (LOCAL) {
    const cols = C.columns[sectionId] || [];
    const nc = { id: lid(), section_id: sectionId, position: cols.length, width: 160, options: null, ...column };
    cols.push(nc);
    C.columns[sectionId] = cols;
    notify();
    return nc;
  }
  const existing = C.columns[sectionId] || [];
  const { data, error } = await sb().from('table_columns')
    .insert({ ...column, section_id: sectionId, position: existing.length })
    .select().single();
  if (error) throw error;
  await loadColumns(sectionId);
  return data;
}

export async function deleteColumn(sectionId, colId) {
  if (LOCAL) {
    C.columns[sectionId] = (C.columns[sectionId] || []).filter(c => c.id !== colId);
    // remove cells for this column
    (C.rows[sectionId] || []).forEach(r => { delete r.cells[colId]; });
    notify();
    return;
  }
  const { error } = await sb().from('table_columns').delete().eq('id', colId);
  if (error) throw error;
  await loadColumns(sectionId);
}

export async function renameColumn(sectionId, colId, name) {
  if (LOCAL) {
    const col = (C.columns[sectionId] || []).find(c => c.id === colId);
    if (col) col.name = name;
    notify();
    return;
  }
  const { error } = await sb().from('table_columns').update({ name }).eq('id', colId);
  if (error) throw error;
  await loadColumns(sectionId);
}

export async function updateColumnOptions(sectionId, colId, options) {
  if (LOCAL) {
    const col = (C.columns[sectionId] || []).find(c => c.id === colId);
    if (col) col.options = options;
    notify();
    return;
  }
  const { error } = await sb().from('table_columns').update({ options }).eq('id', colId);
  if (error) throw error;
  await loadColumns(sectionId);
}

export async function reorderColumns(sectionId, ids) {
  if (LOCAL) {
    const cols = C.columns[sectionId] || [];
    cols.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    cols.forEach((c, i) => c.position = i);
    notify();
    return;
  }
  const updates = ids.map((id, i) => ({ id, position: i }));
  const { error } = await sb().from('table_columns').upsert(updates);
  if (error) throw error;
  await loadColumns(sectionId);
}

export async function resizeColumn(colId, width) {
  for (const cols of Object.values(C.columns)) {
    const col = cols.find(c => c.id === colId);
    if (col) { col.width = width; break; }
  }
  if (!LOCAL) {
    const { error } = await sb().from('table_columns').update({ width }).eq('id', colId);
    if (error) throw error;
  }
  notify();
}

// ── Table: Rows & Cells ─────────────────────────────────────
export async function loadRows(sectionId) {
  if (LOCAL) { notify(); return C.rows[sectionId] || []; }
  const { data: rows, error: rErr } = await sb().from('table_rows')
    .select('*').eq('section_id', sectionId).order('position');
  if (rErr) throw rErr;
  const rowIds = rows.map(r => r.id);
  let cells = [];
  if (rowIds.length) {
    const { data, error: cErr } = await sb().from('table_cells').select('*').in('row_id', rowIds);
    if (cErr) throw cErr;
    cells = data;
  }
  const cellsByRow = {};
  cells.forEach(c => {
    if (!cellsByRow[c.row_id]) cellsByRow[c.row_id] = {};
    cellsByRow[c.row_id][c.column_id] = c.value;
  });
  C.rows[sectionId] = rows.map(r => ({ ...r, cells: cellsByRow[r.id] || {} }));
  notify();
  return C.rows[sectionId];
}

export function getRows(sectionId) { return C.rows[sectionId] || []; }

export async function addRow(sectionId) {
  if (LOCAL) {
    const rows = C.rows[sectionId] || [];
    const nr = { id: lid(), section_id: sectionId, position: rows.length, created_at: new Date().toISOString(), cells: {} };
    rows.push(nr);
    C.rows[sectionId] = rows;
    notify();
    return nr.id;
  }
  const existing = C.rows[sectionId] || [];
  const { data, error } = await sb().from('table_rows')
    .insert({ section_id: sectionId, position: existing.length }).select().single();
  if (error) throw error;
  await loadRows(sectionId);
  return data.id;
}

export async function deleteRow(rowId) {
  if (LOCAL) {
    for (const [sid, rows] of Object.entries(C.rows)) {
      const idx = rows.findIndex(r => r.id === rowId);
      if (idx >= 0) { rows.splice(idx, 1); notify(); return; }
    }
    return;
  }
  let sectionId = null;
  for (const [sid, rows] of Object.entries(C.rows)) {
    if (rows.some(r => r.id === rowId)) { sectionId = sid; break; }
  }
  const { error } = await sb().from('table_rows').delete().eq('id', rowId);
  if (error) throw error;
  if (sectionId) await loadRows(sectionId);
}

export async function setCellValue(rowId, colId, value) {
  // Always update cache for responsiveness
  for (const rows of Object.values(C.rows)) {
    const row = rows.find(r => r.id === rowId);
    if (row) { row.cells[colId] = value; break; }
  }
  if (!LOCAL) {
    const { error } = await sb().from('table_cells')
      .upsert({ row_id: rowId, column_id: colId, value }, { onConflict: 'row_id,column_id' });
    if (error) throw error;
  }
  notify();
}

export async function reorderRows(sectionId, ids) {
  if (LOCAL) {
    const rows = C.rows[sectionId] || [];
    rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    rows.forEach((r, i) => r.position = i);
    notify();
    return;
  }
  const updates = ids.map((id, i) => ({ id, position: i }));
  const { error } = await sb().from('table_rows').upsert(updates);
  if (error) throw error;
  await loadRows(sectionId);
}

// ── List ────────────────────────────────────────────────────
export async function loadListItems(sectionId) {
  if (LOCAL) { notify(); return C.listItems[sectionId] || []; }
  const { data, error } = await sb().from('list_items').select('*').eq('section_id', sectionId).order('position');
  if (error) throw error;
  C.listItems[sectionId] = data;
  notify();
  return data;
}

export function getListItems(sectionId) { return C.listItems[sectionId] || []; }

export async function addListItem(sectionId, text) {
  if (LOCAL) {
    const items = C.listItems[sectionId] || [];
    const ni = { id: lid(), section_id: sectionId, text, checked: false, position: items.length };
    items.push(ni);
    C.listItems[sectionId] = items;
    notify();
    return ni;
  }
  const existing = C.listItems[sectionId] || [];
  const { data, error } = await sb().from('list_items')
    .insert({ section_id: sectionId, text, position: existing.length }).select().single();
  if (error) throw error;
  await loadListItems(sectionId);
  return data;
}

export async function updateListItem(itemId, patch) {
  if (LOCAL) {
    for (const items of Object.values(C.listItems)) {
      const item = items.find(i => i.id === itemId);
      if (item) { Object.assign(item, patch); notify(); return; }
    }
    return;
  }
  const { error } = await sb().from('list_items').update(patch).eq('id', itemId);
  if (error) throw error;
  for (const [sid, items] of Object.entries(C.listItems)) {
    if (items.some(i => i.id === itemId)) { await loadListItems(sid); break; }
  }
}

export async function deleteListItem(itemId) {
  if (LOCAL) {
    for (const [sid, items] of Object.entries(C.listItems)) {
      const idx = items.findIndex(i => i.id === itemId);
      if (idx >= 0) { items.splice(idx, 1); notify(); return; }
    }
    return;
  }
  let sectionId = null;
  for (const [sid, items] of Object.entries(C.listItems)) {
    if (items.some(i => i.id === itemId)) { sectionId = sid; break; }
  }
  const { error } = await sb().from('list_items').delete().eq('id', itemId);
  if (error) throw error;
  if (sectionId) await loadListItems(sectionId);
}

export async function clearCheckedListItems(sectionId) {
  if (LOCAL) {
    C.listItems[sectionId] = (C.listItems[sectionId] || []).filter(i => !i.checked);
    notify();
    return;
  }
  const { error } = await sb().from('list_items').delete().eq('section_id', sectionId).eq('checked', true);
  if (error) throw error;
  await loadListItems(sectionId);
}

export async function reorderListItems(sectionId, ids) {
  if (LOCAL) {
    const items = C.listItems[sectionId] || [];
    items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    items.forEach((it, i) => it.position = i);
    notify();
    return;
  }
  const updates = ids.map((id, i) => ({ id, position: i }));
  const { error } = await sb().from('list_items').upsert(updates);
  if (error) throw error;
  await loadListItems(sectionId);
}

// ── Text ────────────────────────────────────────────────────
export async function loadTextContent(sectionId) {
  if (LOCAL) { notify(); return C.textContent[sectionId] ?? ''; }
  const { data, error } = await sb().from('text_content').select('content').eq('id', sectionId).single();
  if (error && error.code !== 'PGRST116') throw error;
  C.textContent[sectionId] = data?.content ?? '';
  notify();
  return C.textContent[sectionId];
}

export function getTextContent(sectionId) { return C.textContent[sectionId] ?? ''; }

export async function setTextContent(sectionId, html) {
  C.textContent[sectionId] = html;
  if (!LOCAL) {
    const { error } = await sb().from('text_content')
      .upsert({ id: sectionId, content: html }, { onConflict: 'id' });
    if (error) throw error;
  }
  notify();
}

// ── Relations ───────────────────────────────────────────────
function relKey(sourceRowId, sourceColId) { return `${sourceRowId}:${sourceColId}`; }

export function getRelations(sourceRowId, sourceColId) {
  if (LOCAL) {
    const key = relKey(sourceRowId, sourceColId);
    return Array.from(C.relations[key] || []);
  }
  // Supabase mode returns a promise
  return sb().from('relation_links')
    .select('target_row_id').eq('source_row_id', sourceRowId).eq('source_col_id', sourceColId)
    .then(({ data, error }) => {
      if (error) throw error;
      return data.map(r => r.target_row_id);
    });
}

export function getRelationsSync(sourceRowId, sourceColId) {
  const key = relKey(sourceRowId, sourceColId);
  return Array.from(C.relations[key] || []);
}

export function getAllRelations() {
  return C.relations;
}

export async function addRelation(sourceRowId, sourceColId, targetRowId) {
  const key = relKey(sourceRowId, sourceColId);
  if (!C.relations[key]) C.relations[key] = new Set();
  C.relations[key].add(targetRowId);
  if (!LOCAL) {
    const { error } = await sb().from('relation_links')
      .insert({ source_row_id: sourceRowId, source_col_id: sourceColId, target_row_id: targetRowId });
    if (error) throw error;
  }
  notify();
}

export async function removeRelation(sourceRowId, sourceColId, targetRowId) {
  const key = relKey(sourceRowId, sourceColId);
  if (C.relations[key]) C.relations[key].delete(targetRowId);
  if (!LOCAL) {
    const { error } = await sb().from('relation_links')
      .delete().eq('source_row_id', sourceRowId).eq('source_col_id', sourceColId).eq('target_row_id', targetRowId);
    if (error) throw error;
  }
  notify();
}

// ── CSV Import ──────────────────────────────────────────────

export function parseCSV(csvString) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  const s = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < s.length && s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        if (current.some(c => c !== '')) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  if (current.some(c => c !== '')) rows.push(current);
  return rows;
}

export function detectColumnType(values) {
  const nonEmpty = values.filter(v => v != null && v !== '');
  if (!nonEmpty.length) return 'text';

  // Check letter_grade
  if (nonEmpty.every(v => GRADE_SCALE.includes(v.trim().toUpperCase()))) return 'letter_grade';

  // Check number
  if (nonEmpty.every(v => !isNaN(Number(v)) && v.trim() !== '')) return 'number';

  // Check checkbox
  const boolVals = ['true', 'false', 'yes', 'no', '1', '0'];
  if (nonEmpty.every(v => boolVals.includes(v.trim().toLowerCase()))) return 'checkbox';

  // Check date
  const dateRe = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  if (nonEmpty.every(v => dateRe.test(v.trim()))) return 'date';

  // Check URL
  if (nonEmpty.every(v => /^https?:\/\//i.test(v.trim()))) return 'url';

  return 'text';
}

export async function importSectionCSV(sectionId, csvString, options = {}) {
  const { columnMap = null, excludeColumns = new Set() } = options;
  const parsed = parseCSV(csvString);
  if (parsed.length < 2) return { rowsAdded: 0, columnsCreated: 0 };

  const headers = parsed[0];
  const dataRows = parsed.slice(1);
  const existingCols = getColumns(sectionId);
  let columnsCreated = 0;

  // Map each CSV column index to a vault column id
  const colMapping = []; // { csvIdx, colId, type }
  for (let i = 0; i < headers.length; i++) {
    const name = headers[i].trim();
    if (!name || excludeColumns.has(name)) { colMapping.push(null); continue; }

    // Check if there's an explicit mapping or find by name match
    let existingCol = null;
    if (columnMap && columnMap[name]) {
      existingCol = existingCols.find(c => c.id === columnMap[name]);
    }
    if (!existingCol) {
      existingCol = existingCols.find(c => c.name.toLowerCase() === name.toLowerCase());
    }

    if (existingCol) {
      colMapping.push({ csvIdx: i, colId: existingCol.id, type: existingCol.type });
    } else {
      // Detect type and create new column
      const colValues = dataRows.map(r => r[i] || '');
      const detectedType = detectColumnType(colValues);
      const newCol = await addColumn(sectionId, { name, type: detectedType });
      colMapping.push({ csvIdx: i, colId: newCol.id, type: detectedType });
      columnsCreated++;
    }
  }

  // Import each row
  let rowsAdded = 0;
  for (const dataRow of dataRows) {
    const hasAnyValue = colMapping.some((m, idx) => m && dataRow[idx]?.trim());
    if (!hasAnyValue) continue;

    const rowId = await addRow(sectionId);
    for (const mapping of colMapping) {
      if (!mapping) continue;
      const raw = (dataRow[mapping.csvIdx] || '').trim();
      if (!raw) continue;

      let value;
      switch (mapping.type) {
        case 'number':
          value = Number(raw);
          if (isNaN(value)) value = null;
          break;
        case 'checkbox':
          value = ['true', 'yes', '1'].includes(raw.toLowerCase());
          break;
        case 'letter_grade':
          value = GRADE_SCALE.includes(raw.toUpperCase()) ? raw.toUpperCase() : raw;
          break;
        default:
          value = raw;
      }
      if (value !== null && value !== undefined && value !== '') {
        await setCellValue(rowId, mapping.colId, value);
      }
    }
    rowsAdded++;
  }

  notify();
  return { rowsAdded, columnsCreated };
}

// ── Search index (for Command Palette) ──────────────────────
export function buildSearchIndex() {
  const index = [];
  C.spaces.forEach(s => {
    index.push({ type: 'space', id: s.id, name: s.name, breadcrumb: s.name });
  });
  for (const [spaceId, pages] of Object.entries(C.pages)) {
    const space = C.spaces.find(s => s.id === spaceId);
    const spaceName = space?.name ?? '';
    pages.forEach(p => {
      index.push({ type: 'page', id: p.id, name: p.name, breadcrumb: `${spaceName} › ${p.name}` });
    });
  }
  for (const [sectionId, rows] of Object.entries(C.rows)) {
    const cols = C.columns[sectionId] || [];
    const nameCol = cols.find(c => /^(name|title)$/i.test(c.name));
    if (!nameCol) continue;
    rows.forEach(r => {
      const val = r.cells[nameCol.id];
      if (val && typeof val === 'string') {
        index.push({ type: 'row', id: r.id, sectionId, name: val, breadcrumb: val });
      }
    });
  }
  C.searchIndex = index;
  return index;
}

export function searchIndex(query) {
  if (!query) return [];
  const q = query.toLowerCase();
  return C.searchIndex.filter(entry => entry.name.toLowerCase().includes(q));
}

// ── Seed data (local mode only) ─────────────────────────────
function seedLocalData() {
  // ─ Spaces ─
  const sp1 = { id: 'sp-personal', name: 'Personal Misc', color: 'gold', position: 0 };
  const sp2 = { id: 'sp-endless',  name: 'Endless Sky',   color: 'pur',  position: 1 };
  C.spaces = [sp1, sp2];

  // ─ Pages ─
  const pg1 = { id: 'pg-pokemon', space_id: 'sp-personal', parent_id: null, name: 'Pokemon',    position: 0 };
  const pg2 = { id: 'pg-faves',   space_id: 'sp-personal', parent_id: 'pg-pokemon', name: 'Faves', position: 0 };
  const pg3 = { id: 'pg-anime',   space_id: 'sp-personal', parent_id: null, name: 'Anime',      position: 1 };
  const pg4 = { id: 'pg-chars',   space_id: 'sp-endless',  parent_id: null, name: 'Characters', position: 0 };
  const pg5 = { id: 'pg-places',  space_id: 'sp-endless',  parent_id: null, name: 'Places',     position: 1 };
  const pg6 = { id: 'pg-items',   space_id: 'sp-endless',  parent_id: null, name: 'Items',      position: 2 };
  C.pages = {
    'sp-personal': [pg1, pg2, pg3],
    'sp-endless':  [pg4, pg5, pg6],
  };
  C._allPages = [pg1, pg2, pg3, pg4, pg5, pg6];

  // ─ Sections ─
  // Pokemon Faves page: list + text
  const secList = { id: 'sec-faves-list', page_id: 'pg-faves', name: 'Top Favorites', type: 'list', collapsed: false, position: 0 };
  const secText = { id: 'sec-faves-notes', page_id: 'pg-faves', name: 'Notes', type: 'text', collapsed: false, position: 1 };
  // Characters page: table
  const secChars = { id: 'sec-chars-table', page_id: 'pg-chars', name: 'Characters', type: 'table', collapsed: false, position: 0, showcase_template: 'endless-sky-character' };
  // Places page: table
  const secPlaces = { id: 'sec-places-table', page_id: 'pg-places', name: 'Places', type: 'table', collapsed: false, position: 0 };
  // Anime page: text
  const secAnime = { id: 'sec-anime-notes', page_id: 'pg-anime', name: 'Watch List Notes', type: 'text', collapsed: false, position: 0 };
  // Anime page: list
  const secAnimeList = { id: 'sec-anime-list', page_id: 'pg-anime', name: 'To Watch', type: 'list', collapsed: false, position: 1 };

  C.sections = {
    'pg-faves':  [secList, secText],
    'pg-chars':  [secChars],
    'pg-places': [secPlaces],
    'pg-anime':  [secAnime, secAnimeList],
    'pg-pokemon': [],
    'pg-items':  [],
  };

  // ─ List items (faves) ─
  C.listItems = {
    'sec-faves-list': [
      { id: 'li-1', section_id: 'sec-faves-list', text: 'Charizard', checked: false, position: 0 },
      { id: 'li-2', section_id: 'sec-faves-list', text: 'Gengar', checked: false, position: 1 },
      { id: 'li-3', section_id: 'sec-faves-list', text: 'Lucario', checked: true, position: 2 },
      { id: 'li-4', section_id: 'sec-faves-list', text: 'Gardevoir', checked: false, position: 3 },
    ],
    'sec-anime-list': [
      { id: 'li-a1', section_id: 'sec-anime-list', text: 'Frieren: Beyond Journey\'s End', checked: false, position: 0 },
      { id: 'li-a2', section_id: 'sec-anime-list', text: 'Dandadan', checked: false, position: 1 },
      { id: 'li-a3', section_id: 'sec-anime-list', text: 'Solo Leveling S2', checked: true, position: 2 },
    ],
  };

  // ─ Text content ─
  C.textContent = {
    'sec-faves-notes': '<p>These are my all-time favorite Pokemon. Charizard has been #1 since Gen 1.</p><p>Gengar is the GOAT ghost type. No debate.</p>',
    'sec-anime-notes': '<p>Tracking anime to watch and thoughts on recent seasons.</p>',
  };

  // ─ Characters table ─
  const sigOpts = [
    { id: 'sig-1', label: 'Tier 1', color: 'gold' },
    { id: 'sig-2', label: 'Tier 2', color: 'slv' },
    { id: 'sig-3', label: 'Tier 3', color: 'tel' },
  ];
  const genderOpts = [
    { id: 'g-m', label: 'Male', color: 'blu' },
    { id: 'g-f', label: 'Female', color: 'hot' },
    { id: 'g-nb', label: 'Non-binary', color: 'pur' },
  ];
  const statusOpts = [
    { id: 'st-active', label: 'Active', color: 'grn' },
    { id: 'st-inactive', label: 'Inactive', color: 'gry' },
    { id: 'st-deceased', label: 'Deceased', color: 'hot' },
  ];

  // Core identity columns
  const col1  = { id: 'col-name',   section_id: 'sec-chars-table', name: 'Name',         type: 'text',         position: 0,  width: 180 };
  const col2  = { id: 'col-sig',    section_id: 'sec-chars-table', name: 'Significance',  type: 'select',       position: 1,  width: 130, options: sigOpts };
  const col3  = { id: 'col-gender', section_id: 'sec-chars-table', name: 'Gender',        type: 'select',       position: 2,  width: 120, options: genderOpts };
  const col4  = { id: 'col-age',    section_id: 'sec-chars-table', name: 'Age',           type: 'number',       position: 3,  width: 80 };
  const col5  = { id: 'col-status', section_id: 'sec-chars-table', name: 'Status',        type: 'select',       position: 4,  width: 120, options: statusOpts };
  const col6  = { id: 'col-rating', section_id: 'sec-chars-table', name: 'Rating',        type: 'rating',       position: 5,  width: 130 };
  const col7  = { id: 'col-main',   section_id: 'sec-chars-table', name: 'Main Cast',     type: 'checkbox',     position: 6,  width: 100 };
  const col8  = { id: 'col-race',   section_id: 'sec-chars-table', name: 'Race',          type: 'text',         position: 7,  width: 120 };
  const col9  = { id: 'col-align',  section_id: 'sec-chars-table', name: 'Alignment',     type: 'text',         position: 8,  width: 120 };
  const col10 = { id: 'col-mbti',   section_id: 'sec-chars-table', name: 'MBTI',          type: 'text',         position: 9,  width: 80 };
  // Letter grade stats
  const col11 = { id: 'col-str',    section_id: 'sec-chars-table', name: 'STR',           type: 'letter_grade', position: 10, width: 80 };
  const col12 = { id: 'col-end',    section_id: 'sec-chars-table', name: 'END',           type: 'letter_grade', position: 11, width: 80 };
  const col13 = { id: 'col-agi',    section_id: 'sec-chars-table', name: 'AGI',           type: 'letter_grade', position: 12, width: 80 };
  const col14 = { id: 'col-mag',    section_id: 'sec-chars-table', name: 'MAG',           type: 'letter_grade', position: 13, width: 80 };
  const col15 = { id: 'col-int',    section_id: 'sec-chars-table', name: 'INT',           type: 'letter_grade', position: 14, width: 80 };
  const col16 = { id: 'col-wis',    section_id: 'sec-chars-table', name: 'WIS',           type: 'letter_grade', position: 15, width: 80 };
  const col17 = { id: 'col-cha',    section_id: 'sec-chars-table', name: 'CHA',           type: 'letter_grade', position: 16, width: 80 };
  const col18 = { id: 'col-tar',    section_id: 'sec-chars-table', name: 'TAR',           type: 'letter_grade', position: 17, width: 80 };
  // D&D stats
  const col19 = { id: 'col-dstr',   section_id: 'sec-chars-table', name: 'Strength',      type: 'number',       position: 18, width: 80 };
  const col20 = { id: 'col-ddex',   section_id: 'sec-chars-table', name: 'Dexterity',     type: 'number',       position: 19, width: 80 };
  const col21 = { id: 'col-dcon',   section_id: 'sec-chars-table', name: 'Constitution',  type: 'number',       position: 20, width: 80 };
  const col22 = { id: 'col-dint',   section_id: 'sec-chars-table', name: 'Intelligence',  type: 'number',       position: 21, width: 80 };
  const col23 = { id: 'col-dwis',   section_id: 'sec-chars-table', name: 'Wisdom',        type: 'number',       position: 22, width: 80 };
  const col24 = { id: 'col-dchar',  section_id: 'sec-chars-table', name: 'Charisma',      type: 'number',       position: 23, width: 80 };
  // Backstory
  const col25 = { id: 'col-back',   section_id: 'sec-chars-table', name: 'Backstory',     type: 'text',         position: 24, width: 200 };

  C.columns['sec-chars-table'] = [col1,col2,col3,col4,col5,col6,col7,col8,col9,col10,col11,col12,col13,col14,col15,col16,col17,col18,col19,col20,col21,col22,col23,col24,col25];

  const row1 = { id: 'row-1', section_id: 'sec-chars-table', position: 0, cells: {
    'col-name': 'Tsukasa Hoshino', 'col-sig': 'sig-1', 'col-gender': 'g-f', 'col-age': 16, 'col-status': 'st-active', 'col-rating': 5, 'col-main': true,
    'col-race': 'Human', 'col-align': 'Chaotic Good', 'col-mbti': 'ENFP',
    'col-str': 'B+', 'col-end': 'A-', 'col-agi': 'S', 'col-mag': 'S+', 'col-int': 'A+', 'col-wis': 'B', 'col-cha': 'A', 'col-tar': 'A+',
    'col-dstr': 14, 'col-ddex': 18, 'col-dcon': 13, 'col-dint': 17, 'col-dwis': 15, 'col-dchar': 19,
    'col-back': 'Born under a fractured sky, Tsukasa discovered her magical affinity at age 6 when she accidentally froze an entire lake during a tantrum.',
  }};
  const row2 = { id: 'row-2', section_id: 'sec-chars-table', position: 1, cells: {
    'col-name': 'Valdora Ashcrest', 'col-sig': 'sig-1', 'col-gender': 'g-m', 'col-age': 24, 'col-status': 'st-active', 'col-rating': 4, 'col-main': true,
    'col-race': 'Half-Elf', 'col-align': 'Lawful Neutral', 'col-mbti': 'INTJ',
    'col-str': 'A', 'col-end': 'A+', 'col-agi': 'B+', 'col-mag': 'C+', 'col-int': 'A-', 'col-wis': 'A', 'col-cha': 'B-', 'col-tar': 'S',
    'col-dstr': 18, 'col-ddex': 14, 'col-dcon': 16, 'col-dint': 16, 'col-dwis': 17, 'col-dchar': 12,
    'col-back': 'A disgraced knight who abandoned his oath after discovering the kingdom he served was built on corruption.',
  }};
  const row3 = { id: 'row-3', section_id: 'sec-chars-table', position: 2, cells: {
    'col-name': 'Saya Mizuki', 'col-sig': 'sig-2', 'col-gender': 'g-f', 'col-age': 17, 'col-status': 'st-active', 'col-rating': 4, 'col-main': false,
    'col-race': 'Human', 'col-align': 'Neutral Good', 'col-mbti': 'INFJ',
    'col-str': 'C', 'col-end': 'C+', 'col-agi': 'B', 'col-mag': 'A+', 'col-int': 'A', 'col-wis': 'B+', 'col-cha': 'B+', 'col-tar': 'B-',
    'col-dstr': 10, 'col-ddex': 13, 'col-dcon': 11, 'col-dint': 18, 'col-dwis': 16, 'col-dchar': 15,
  }};
  const row4 = { id: 'row-4', section_id: 'sec-chars-table', position: 3, cells: {
    'col-name': 'Kael Nightbane', 'col-sig': 'sig-2', 'col-gender': 'g-m', 'col-age': 300, 'col-status': 'st-active', 'col-rating': 3, 'col-main': false,
    'col-race': 'Elf', 'col-align': 'True Neutral', 'col-mbti': 'ISTP',
    'col-str': 'B', 'col-end': 'S', 'col-agi': 'A-', 'col-mag': 'D+', 'col-int': 'B+', 'col-wis': 'S+', 'col-cha': 'C-', 'col-tar': 'A',
    'col-dstr': 15, 'col-ddex': 16, 'col-dcon': 20, 'col-dint': 14, 'col-dwis': 20, 'col-dchar': 8,
  }};
  const row5 = { id: 'row-5', section_id: 'sec-chars-table', position: 4, cells: {
    'col-name': 'Eris Valkyr', 'col-sig': 'sig-3', 'col-gender': 'g-f', 'col-age': 21, 'col-status': 'st-deceased', 'col-rating': 3, 'col-main': false,
    'col-race': 'Tiefling', 'col-align': 'Chaotic Neutral', 'col-mbti': 'ENTP',
    'col-str': 'A-', 'col-end': 'B', 'col-agi': 'A+', 'col-mag': 'GLITCH', 'col-int': 'B-', 'col-wis': 'D+', 'col-cha': 'A+', 'col-tar': 'C+',
    'col-dstr': 16, 'col-ddex': 19, 'col-dcon': 14, 'col-dint': 13, 'col-dwis': 9, 'col-dchar': 18,
    'col-back': 'A former circus performer whose latent magical abilities manifested as uncontrollable reality-warping. Died sealing a dimensional rift.',
  }};
  C.rows['sec-chars-table'] = [row1, row2, row3, row4, row5];

  // ─ Places table ─
  const placeTypeOpts = [
    { id: 'pt-world', label: 'World', color: 'pur' },
    { id: 'pt-city', label: 'City', color: 'tel' },
    { id: 'pt-region', label: 'Region', color: 'grn' },
  ];
  const pcol1 = { id: 'pcol-name', section_id: 'sec-places-table', name: 'Name', type: 'text', position: 0, width: 180 };
  const pcol2 = { id: 'pcol-type', section_id: 'sec-places-table', name: 'Type', type: 'select', position: 1, width: 120, options: placeTypeOpts };
  const pcol3 = { id: 'pcol-desc', section_id: 'sec-places-table', name: 'Description', type: 'text', position: 2, width: 260 };
  C.columns['sec-places-table'] = [pcol1, pcol2, pcol3];

  C.rows['sec-places-table'] = [
    { id: 'prow-1', section_id: 'sec-places-table', position: 0, cells: { 'pcol-name': 'Aethermoor', 'pcol-type': 'pt-city', 'pcol-desc': 'The City of Fractured Light' }},
    { id: 'prow-2', section_id: 'sec-places-table', position: 1, cells: { 'pcol-name': 'Starfall Basin', 'pcol-type': 'pt-region', 'pcol-desc': 'A vast crater filled with crystallized mana' }},
  ];

  // ─ Add Bonds (relation) column to Characters ─
  const colBonds = { id: 'col-bonds', section_id: 'sec-chars-table', name: 'Bonds', type: 'relation', position: 25, width: 140 };
  C.columns['sec-chars-table'].push(colBonds);

  // ─ Sample relations ─
  C.relations = {
    'row-1:col-bonds': new Set(['row-2', 'row-3']),   // Tsukasa → Valdora, Saya
    'row-2:col-bonds': new Set(['row-1', 'row-4']),   // Valdora → Tsukasa, Kael
    'row-3:col-bonds': new Set(['row-1']),             // Saya → Tsukasa
    'row-4:col-bonds': new Set(['row-2', 'row-5']),   // Kael → Valdora, Eris
    'row-5:col-bonds': new Set(['row-4']),             // Eris → Kael
  };

  // Empty sections init
  C.columns['sec-faves-list'] = [];
  C.rows['sec-faves-list'] = [];
}

// ── Initial load ────────────────────────────────────────────
export async function initVault() {
  if (LOCAL) {
    // Only seed if cache is empty (survives HMR)
    if (!C.spaces.length) {
      seedLocalData();
      console.log('[Vault] Running in local/mock mode with seed data');
    }
    C.ready = true;
    notify();
    return;
  }
  try {
    await loadSpaces();
    C.ready = true;
    notify();
  } catch (e) {
    console.error('[Vault] Failed to initialize:', e.message);
    C.ready = true;
    notify();
  }
}
