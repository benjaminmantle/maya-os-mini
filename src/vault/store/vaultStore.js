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

// ── Power rating computation ────────────────────────────────
const STAT_WEIGHTS = { STR: 1.0, END: 1.0, AGI: 1.0, MAG: 1.1, INT: 0.9, WIS: 0.9, CHA: 1.1, TAR: 1.1 };
const POWER_TIERS = [
  [96, 'S+-CLASS'], [86, 'S-CLASS'], [71, 'A-CLASS'],
  [56, 'B-CLASS'], [41, 'C-CLASS'], [21, 'D-CLASS'], [0, 'E-CLASS'],
];
const POWER_TIER_COLORS = { 'S+-CLASS': 'hot', 'S-CLASS': 'gold', 'A-CLASS': 'pur', 'B-CLASS': 'blu', 'C-CLASS': 'grn', 'D-CLASS': 'brn', 'E-CLASS': 't3' };

export function computePowerRating(statGrades) {
  // statGrades: { STR: 'A+', END: 'B', ... }
  let totalWeight = 0, totalVal = 0;
  for (const [stat, grade] of Object.entries(statGrades)) {
    if (!grade) continue;
    const w = STAT_WEIGHTS[stat] || 1.0;
    const num = grade === 'GLITCH' ? 17 : gradeToNum(grade);
    if (num < 0) continue;
    totalVal += num * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return { index: 0, tier: 'E-CLASS', color: 't3' };
  const index = Math.round((totalVal / totalWeight / 17) * 100);
  const tier = POWER_TIERS.find(([min]) => index >= min)?.[1] || 'E-CLASS';
  return { index, tier, color: POWER_TIER_COLORS[tier] || 't3' };
}

// ── Row lookup helpers ──────────────────────────────────────
export function getRowName(rowId) {
  for (const secId in C.rows) {
    const row = C.rows[secId].find(r => r.id === rowId);
    if (!row) continue;
    const cols = C.columns[secId] || [];
    const nameCol = cols.find(c => c.type === 'text') || cols[0];
    if (!nameCol) return 'Untitled';
    return row.cells?.[nameCol.id] || 'Untitled';
  }
  return 'Untitled';
}

export function getRowsForSection(sectionId) {
  return C.rows[sectionId] || [];
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
          value = GRADE_SCALE.includes(raw.toUpperCase()) ? raw.toUpperCase() : null;
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

  // Tab content columns
  const col26 = { id: 'col-pers',  section_id: 'sec-chars-table', name: 'Personality Traits', type: 'text', position: 25, width: 200 };
  const col27 = { id: 'col-comb',  section_id: 'sec-chars-table', name: 'Combat Abilities',   type: 'text', position: 26, width: 200 };
  const col28 = { id: 'col-world', section_id: 'sec-chars-table', name: 'World Info',          type: 'text', position: 27, width: 200 };
  const col29 = { id: 'col-notes', section_id: 'sec-chars-table', name: 'Work Notes',          type: 'text', position: 28, width: 200 };

  // New structured + long-form columns
  const affilOpts = [
    { id: 'af-mage',   label: 'Mage Council',      color: 'pur' },
    { id: 'af-ash',    label: 'Ashcrest Vanguard',  color: 'slv' },
    { id: 'af-lum',    label: 'Luminari Order',     color: 'gold' },
    { id: 'af-carn',   label: 'Crimson Carnival',   color: 'hot' },
    { id: 'af-indep',  label: 'Independent',        color: 'grn' },
    { id: 'af-forest', label: 'Forest Spirits',     color: 'tel' },
    { id: 'af-iron',   label: 'Iron Crown',         color: 'blu' },
    { id: 'af-veil',   label: 'Shattered Veil',     color: 'hot' },
  ];
  const col30 = { id: 'col-title',   section_id: 'sec-chars-table', name: 'Title',               type: 'text',   position: 29, width: 180 };
  const col31 = { id: 'col-affil',   section_id: 'sec-chars-table', name: 'Affiliation',          type: 'select', position: 30, width: 150, options: affilOpts };
  const col32 = { id: 'col-class',   section_id: 'sec-chars-table', name: 'Class',                type: 'text',   position: 31, width: 140 };
  const col33 = { id: 'col-sigmove', section_id: 'sec-chars-table', name: 'Signature Move',       type: 'text',   position: 32, width: 180 };
  const col34 = { id: 'col-weapon',  section_id: 'sec-chars-table', name: 'Weapon',               type: 'text',   position: 33, width: 180 };
  const col35 = { id: 'col-weak',    section_id: 'sec-chars-table', name: 'Weakness',             type: 'text',   position: 34, width: 200 };
  const col36 = { id: 'col-goal',    section_id: 'sec-chars-table', name: 'Goal',                 type: 'text',   position: 35, width: 200 };
  const col37 = { id: 'col-fear',    section_id: 'sec-chars-table', name: 'Fear',                 type: 'text',   position: 36, width: 200 };
  const col38 = { id: 'col-theme',   section_id: 'sec-chars-table', name: 'Theme Song',           type: 'text',   position: 37, width: 160 };
  const col39 = { id: 'col-voice',   section_id: 'sec-chars-table', name: 'Voice Claim',          type: 'text',   position: 38, width: 140 };
  const col40 = { id: 'col-arc',     section_id: 'sec-chars-table', name: 'Story Arc',            type: 'text',   position: 39, width: 260 };
  const col41 = { id: 'col-moments', section_id: 'sec-chars-table', name: 'Key Moments',          type: 'text',   position: 40, width: 260 };
  const col42 = { id: 'col-reldet',  section_id: 'sec-chars-table', name: 'Relationships Detail', type: 'text',   position: 41, width: 260 };
  const col43 = { id: 'col-timeline', section_id: 'sec-chars-table', name: 'Timeline',              type: 'text',   position: 42, width: 200 };
  const col44 = { id: 'col-quote',    section_id: 'sec-chars-table', name: 'Featured Quote',        type: 'text',   position: 43, width: 300 };
  const col45 = { id: 'col-profileimg', section_id: 'sec-chars-table', name: 'Profile Image',       type: 'url',    position: 44, width: 200 };
  const col46 = { id: 'col-fullimg',  section_id: 'sec-chars-table', name: 'Full Body Image',       type: 'url',    position: 45, width: 200 };
  const col47 = { id: 'col-gallery',  section_id: 'sec-chars-table', name: 'Gallery',               type: 'text',   position: 46, width: 200 };

  C.columns['sec-chars-table'] = [col1,col2,col3,col4,col5,col6,col7,col8,col9,col10,col11,col12,col13,col14,col15,col16,col17,col18,col19,col20,col21,col22,col23,col24,col25,col26,col27,col28,col29,col30,col31,col32,col33,col34,col35,col36,col37,col38,col39,col40,col41,col42,col43,col44,col45,col46,col47];

  const row1 = { id: 'row-1', section_id: 'sec-chars-table', position: 0, cells: {
    'col-name': 'Tsukasa Hoshino', 'col-sig': 'sig-1', 'col-gender': 'g-f', 'col-age': 16, 'col-status': 'st-active', 'col-rating': 5, 'col-main': true,
    'col-race': 'Human', 'col-align': 'Chaotic Good', 'col-mbti': 'ENFP',
    'col-str': 'B+', 'col-end': 'A-', 'col-agi': 'S', 'col-mag': 'S+', 'col-int': 'A+', 'col-wis': 'B', 'col-cha': 'A', 'col-tar': 'A+',
    'col-dstr': 14, 'col-ddex': 18, 'col-dcon': 13, 'col-dint': 17, 'col-dwis': 15, 'col-dchar': 19,
    'col-back': 'Born under a fractured sky, Tsukasa discovered her magical affinity at age 6 when she accidentally froze an entire lake during a tantrum. Raised by a rogue scholar in the floating city of Aethermoor, she learned to channel raw mana through emotion rather than discipline.',
    'col-pers': 'Impulsive and fiercely loyal. She acts before thinking but her instincts are almost always right. Hides deep insecurity behind a confident front and uses humor as a shield.',
    'col-comb': 'Specializes in ice and gravity magic, weaving spells mid-combat with terrifying speed. Her signature move "Absolute Zero Field" freezes everything in a 30m radius. Also carries twin daggers for close range.',
    'col-world': 'Grew up in Aethermoor, the City of Fractured Light. Her mentor was executed for heresy when she was 12, setting her on a path of rebellion against the Mage Council.',
    'col-notes': 'Protagonist archetype. Needs a rival character to push her growth. Consider adding a betrayal arc in Act 2.',
    'col-title': 'The Frost Prodigy', 'col-affil': 'af-mage', 'col-class': 'Battlemage', 'col-sigmove': 'Absolute Zero Field',
    'col-weapon': 'Twin ice daggers + Starbreaker staff', 'col-weak': 'Emotional instability amplifies her magic unpredictably — rage can cause collateral damage',
    'col-goal': 'Overthrow the corrupt Mage Council and reform how magic is governed', 'col-fear': 'Losing control of her powers and killing someone she loves',
    'col-theme': 'Unravel — Toru Kitajima', 'col-voice': 'Saori Hayami',
    'col-arc': 'Tsukasa begins as a runaway prodigy hiding from the Mage Council. After joining the party, she learns that raw talent without discipline is a liability. Her arc peaks when she must confront her former mentor\'s killer — a Council Elder — and choose between vengeance and the greater mission. She ultimately channels her grief into sealing the Shattered Veil, nearly dying in the process.',
    'col-moments': '- Froze an entire lake at age 6 during a tantrum\n- Witnessed her mentor\'s public execution at age 12\n- First meeting with Valdora — fought him to a standstill\n- Mastered Absolute Zero Field during the Siege of Aethermoor\n- Chose mercy over vengeance against Elder Corinth\n- Nearly died channeling power to seal the Veil alongside Eris',
    'col-reldet': 'Valdora Ashcrest — her anchor and foil. He represents discipline where she is chaos. Deep mutual respect that may be more. They balance each other in combat and in counsel.\n\nSaya Mizuki — her closest friend and emotional support. Saya heals not just her wounds but her spirit. Tsukasa is fiercely protective of Saya, sometimes to a fault.',
    'col-timeline': JSON.stringify([
      { id: 'era-1', label: 'Childhood', overrides: { 'Age': 6, 'Title': 'Village Girl', 'Class': 'None', 'Affiliation': null, 'STR': 'D', 'END': 'D+', 'AGI': 'C', 'MAG': 'B-', 'INT': 'C+', 'WIS': 'D', 'CHA': 'B', 'TAR': 'C-', 'Signature Move': 'None', 'Weapon': 'None', 'Goal': 'Understand why she is different', 'Fear': 'The strange power inside her' }},
      { id: 'era-2', label: 'Apprentice', overrides: { 'Age': 12, 'Title': 'Mage Apprentice', 'Class': 'Apprentice Mage', 'STR': 'C', 'END': 'C+', 'AGI': 'B', 'MAG': 'A-', 'INT': 'B+', 'WIS': 'C+', 'CHA': 'B+', 'TAR': 'B-', 'Signature Move': 'Frost Lance', 'Weapon': 'Training staff', 'Goal': 'Master her magic before it masters her', 'Fear': 'Disappointing her mentor' }},
      { id: 'era-3', label: 'Awakening', overrides: { 'Age': 15, 'Title': 'The Prodigy', 'Class': 'Battlemage', 'STR': 'B', 'END': 'B+', 'AGI': 'A+', 'MAG': 'S', 'INT': 'A', 'WIS': 'B-', 'CHA': 'A-', 'TAR': 'A', 'Signature Move': 'Absolute Zero Field (unstable)', 'Weapon': 'Ice daggers', 'Goal': 'Avenge her mentor', 'Fear': 'Becoming consumed by vengeance' }},
    ]),
    'col-quote': "If my magic is a storm, then I'll learn to be the eye of it.",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};
  const row2 = { id: 'row-2', section_id: 'sec-chars-table', position: 1, cells: {
    'col-name': 'Valdora Ashcrest', 'col-sig': 'sig-1', 'col-gender': 'g-m', 'col-age': 24, 'col-status': 'st-active', 'col-rating': 4, 'col-main': true,
    'col-race': 'Half-Elf', 'col-align': 'Lawful Neutral', 'col-mbti': 'INTJ',
    'col-str': 'A', 'col-end': 'A+', 'col-agi': 'B+', 'col-mag': 'C+', 'col-int': 'A-', 'col-wis': 'A', 'col-cha': 'B-', 'col-tar': 'S',
    'col-dstr': 18, 'col-ddex': 14, 'col-dcon': 16, 'col-dint': 16, 'col-dwis': 17, 'col-dchar': 12,
    'col-back': 'A disgraced knight who abandoned his oath after discovering the kingdom he served was built on corruption. Now leads a mercenary company called the Ashcrest Vanguard, operating in the borderlands.',
    'col-pers': 'Cold and calculating on the surface but deeply honorable underneath. Never breaks a promise once given. Has trouble expressing emotions and tends to push people away.',
    'col-comb': 'Master swordsman with an enchanted greatsword "Oathbreaker." Fights with precise, economical movements. His TAR stat reflects an iron willpower that makes him nearly immune to mental magic.',
    'col-world': 'Formerly a Knight-Commander of the Ironhollow Citadel. Discovered the king was using soul-binding magic on prisoners. Deserted and was branded a traitor.',
    'col-notes': 'Deuteragonist. The "straight man" to Tsukasa. His arc is about learning to trust again. Potential romance subplot with Saya.',
    'col-title': 'Knight of the Broken Oath', 'col-affil': 'af-ash', 'col-class': 'Knight-Commander', 'col-sigmove': 'Ironwall Resolve',
    'col-weapon': 'Oathbreaker (enchanted greatsword)', 'col-weak': 'Emotional repression — bottles up everything until it explodes in critical moments',
    'col-goal': 'Build a world where no one has to choose between honor and survival', 'col-fear': 'Becoming the same kind of tyrant he once served',
    'col-theme': 'Weight of the World — Keiichi Okabe', 'col-voice': 'Takehito Koyasu',
    'col-arc': 'Valdora carries the weight of having served a corrupt king. He forms the Ashcrest Vanguard as penance but struggles with the moral compromises mercenary life demands. Meeting Tsukasa forces him to confront that neutrality is its own form of cowardice. His turning point comes when he must return to Ironhollow Citadel and face his former brothers-in-arms, ultimately choosing the party over his past loyalties.',
    'col-moments': '- Discovered the king\'s soul-binding experiments on prisoners\n- Deserted the Iron Crown and was branded a traitor\n- Founded the Ashcrest Vanguard with 12 loyalists\n- Fought Tsukasa to a standstill at their first meeting\n- Returned to Ironhollow to confront Commander Draven\n- Shielded Saya from a fatal blow, nearly dying himself',
    'col-reldet': 'Tsukasa Hoshino — she is everything he is not: impulsive, emotional, free. He admires her conviction even when it terrifies him. She makes him want to believe in something again.\n\nKael Nightbane — a mentor figure. Kael\'s centuries of wisdom provide perspective Valdora desperately needs. They share a quiet understanding born of similar regret.',
    'col-timeline': JSON.stringify([
      { id: 'era-1', label: 'Knight-Commander', overrides: { 'Age': 20, 'Title': 'Knight-Commander of Ironhollow', 'Alignment': 'Lawful Good', 'Class': 'Knight-Commander', 'STR': 'A+', 'END': 'A', 'AGI': 'B', 'MAG': 'C', 'INT': 'B+', 'WIS': 'B+', 'CHA': 'B', 'TAR': 'A+', 'Goal': 'Serve the Iron Crown with honor', 'Fear': 'Failing his kingdom', 'Weapon': 'Crown-Forged Greatsword', 'Signature Move': 'Shield Wall Command' }},
      { id: 'era-2', label: 'Desertion', overrides: { 'Age': 22, 'Title': 'The Branded', 'Alignment': 'Chaotic Neutral', 'Class': 'Deserter', 'STR': 'A', 'END': 'A', 'AGI': 'B+', 'MAG': 'C+', 'INT': 'A-', 'WIS': 'B+', 'CHA': 'C+', 'TAR': 'A+', 'Goal': 'Survive long enough to expose the truth', 'Fear': 'That no one will believe him', 'Weapon': 'Stolen greatsword (later named Oathbreaker)', 'Signature Move': 'Desperate Stand' }},
    ]),
    'col-quote': "Honor isn't what you swear. It's what you do when no one's watching.",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};
  const row3 = { id: 'row-3', section_id: 'sec-chars-table', position: 2, cells: {
    'col-name': 'Saya Mizuki', 'col-sig': 'sig-2', 'col-gender': 'g-f', 'col-age': 17, 'col-status': 'st-active', 'col-rating': 4, 'col-main': false,
    'col-race': 'Human', 'col-align': 'Neutral Good', 'col-mbti': 'INFJ',
    'col-str': 'C', 'col-end': 'C+', 'col-agi': 'B', 'col-mag': 'A+', 'col-int': 'A', 'col-wis': 'B+', 'col-cha': 'B+', 'col-tar': 'B-',
    'col-dstr': 10, 'col-ddex': 13, 'col-dcon': 11, 'col-dint': 18, 'col-dwis': 16, 'col-dchar': 15,
    'col-back': 'A prodigious healer from a small village on the edge of the Verdant Reach. Orphaned during a demon incursion, she was taken in by temple priestesses who trained her in restoration magic.',
    'col-pers': 'Gentle and empathetic but surprisingly stubborn when it comes to protecting others. Tends to overwork herself healing others. Has a quiet, scholarly side and keeps detailed journals.',
    'col-comb': 'Primarily a support mage specializing in barriers and healing. Her "Sanctuary Bloom" creates a 10m healing field. Can channel offensive light magic in desperation but it drains her rapidly.',
    'col-world': 'Born in a frontier village near the Verdant Reach. The temple that raised her has connections to an ancient order of healers called the Luminari.',
    'col-notes': 'Glass cannon support archetype. Her fragility is a plot device. Consider a power-up arc where she learns offensive magic.',
    'col-title': 'The Gentle Flame', 'col-affil': 'af-lum', 'col-class': 'Priest-Healer', 'col-sigmove': 'Sanctuary Bloom',
    'col-weapon': 'Luminari Vestments (sacred robes) + healing staff', 'col-weak': 'Physically fragile — overusing healing magic causes her own life force to drain',
    'col-goal': 'Rebuild the Luminari Order and prove that healing is not weakness', 'col-fear': 'Being too slow to save someone she cares about',
    'col-theme': 'Lilium — Kumiko Noma', 'col-voice': 'Mamiko Noto',
    'col-arc': 'Saya starts as the quiet healer everyone overlooks. Her arc is about finding her own strength beyond supporting others. When the party is captured and separated, she must survive alone for the first time — and discovers she can channel offensive light magic when pushed to her limits. Her transformation from passive support to fierce protector culminates in her standing alone against a demon lord to buy the party time to escape.',
    'col-moments': '- Orphaned during the demon incursion on her village at age 8\n- Taken in by the Luminari priestesses and trained in restoration magic\n- Healed Valdora after his near-fatal wound, forming a deep bond\n- Survived alone in the Starfall Basin for three days after capture\n- Unlocked offensive light magic in a desperate stand against demon scouts\n- Faced down the demon lord Xar\'thul single-handedly to protect the party',
    'col-reldet': 'Tsukasa Hoshino — her best friend. Tsukasa\'s fierce energy inspires Saya to be braver. Saya grounds Tsukasa when her emotions spiral. They balance each other perfectly.\n\nValdora Ashcrest — a complicated bond. He protected her, she healed him. There is unspoken tenderness between them that neither will acknowledge.',
    'col-quote': "Healing isn't about fixing what's broken. It's about reminding someone they're worth fixing.",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};
  const row4 = { id: 'row-4', section_id: 'sec-chars-table', position: 3, cells: {
    'col-name': 'Kael Nightbane', 'col-sig': 'sig-2', 'col-gender': 'g-m', 'col-age': 300, 'col-status': 'st-active', 'col-rating': 3, 'col-main': false,
    'col-race': 'Elf', 'col-align': 'True Neutral', 'col-mbti': 'ISTP',
    'col-str': 'B', 'col-end': 'S', 'col-agi': 'A-', 'col-mag': 'D+', 'col-int': 'B+', 'col-wis': 'S+', 'col-cha': 'C-', 'col-tar': 'A',
    'col-dstr': 15, 'col-ddex': 16, 'col-dcon': 20, 'col-dint': 14, 'col-dwis': 20, 'col-dchar': 8,
    'col-back': 'An ancient elven ranger who has lived through three world-ending events. He stopped counting years after the second century. Wanders the wilderness as a solitary guardian of the old forests.',
    'col-pers': 'Laconic and stoic, rarely speaks more than necessary. Has a dry, dark sense of humor that catches people off guard. Deeply weary of the world but too stubborn to stop protecting it.',
    'col-comb': 'Peerless archer and tracker. His bow "Whisperwood" never misses at any range he can see. Relies on endurance and patience rather than raw power. Can outlast any opponent in a war of attrition.',
    'col-world': 'Witnessed the fall of the Elven Dominion 200 years ago. Now lives in the canopy of the Verdant Reach. Has an ancient pact with the forest spirits.',
    'col-notes': 'Mentor archetype. His age gives him perspective the others lack. Could have a sacrificial moment in Act 3.',
    'col-title': 'The Last Sentinel', 'col-affil': 'af-forest', 'col-class': 'Ranger-Warden', 'col-sigmove': 'Whisperwood Barrage',
    'col-weapon': 'Whisperwood (living bow) + hunting knife', 'col-weak': 'Emotional detachment — has watched so many die that he struggles to form new bonds',
    'col-goal': 'Protect the Verdant Reach until the forest no longer needs him', 'col-fear': 'Outliving everyone he ever cares about — again',
    'col-theme': 'The Last of the Mohicans — Trevor Jones', 'col-voice': 'Jouji Nakata',
    'col-arc': 'Kael has lived three hundred years and watched civilizations rise and fall. He joined the party reluctantly, seeing them as another group of mortals he\'d eventually bury. His arc is about learning that connection, even temporary, is worth the pain. When the party faces the Shattered Veil, Kael must decide whether to sacrifice himself — finally ending his vigil — or trust the younger generation to carry the torch. He chooses trust.',
    'col-moments': '- Survived the Fall of the Elven Dominion 200 years ago\n- Formed the Pact of Whispers with the forest spirits\n- Spent 80 years in complete solitude after the Second Cataclysm\n- Reluctantly agreed to guide the party through the Verdant Reach\n- Revealed his true age to the party during the campfire confession\n- Chose to trust rather than sacrifice at the Shattered Veil',
    'col-reldet': 'Valdora Ashcrest — sees a younger version of himself in Valdora\'s rigid honor. Acts as an unofficial mentor, offering hard truths wrapped in dry humor. Respects Valdora\'s willingness to carry the weight.\n\nEris Valkyr — the one who surprised him. Her chaos and warmth cracked his centuries-old shell. Her death hit him harder than he\'ll ever admit.',
    'col-quote': "I've watched civilizations rise and fall. The ones worth remembering chose kindness when cruelty was easier.",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};
  const row5 = { id: 'row-5', section_id: 'sec-chars-table', position: 4, cells: {
    'col-name': 'Eris Valkyr', 'col-sig': 'sig-3', 'col-gender': 'g-f', 'col-age': 21, 'col-status': 'st-deceased', 'col-rating': 3, 'col-main': false,
    'col-race': 'Tiefling', 'col-align': 'Chaotic Neutral', 'col-mbti': 'ENTP',
    'col-str': 'A-', 'col-end': 'B', 'col-agi': 'A+', 'col-mag': 'GLITCH', 'col-int': 'B-', 'col-wis': 'D+', 'col-cha': 'A+', 'col-tar': 'C+',
    'col-dstr': 16, 'col-ddex': 19, 'col-dcon': 14, 'col-dint': 13, 'col-dwis': 9, 'col-dchar': 18,
    'col-back': 'A former circus performer whose latent magical abilities manifested as uncontrollable reality-warping. Died sealing a dimensional rift at the Shattered Veil, saving the party.',
    'col-pers': 'Wild, irreverent, and magnetic. She made everyone around her feel more alive. Had no filter and spoke every thought. Behind the chaos was someone terrified of being alone.',
    'col-comb': 'Her GLITCH-tier magic was unstable reality warping — she could bend space, duplicate objects, or erase things from existence, but never the same way twice. Unpredictable and devastating.',
    'col-world': 'Grew up in the traveling Crimson Carnival. Her tiefling heritage made her an outsider even among outcasts. Found acceptance with the party.',
    'col-notes': 'Tragic wildcard. Her death is a major turning point. Consider a ghost/echo appearance in the finale. The GLITCH stat should feel mysterious.',
    'col-title': 'The Shattered Star', 'col-affil': 'af-carn', 'col-class': 'Reality Warper', 'col-sigmove': 'Veil Tear',
    'col-weapon': 'Veil Shard (artifact) + bare hands', 'col-weak': 'Wisdom is critically low — acts on impulse and rarely considers consequences',
    'col-goal': 'Find a place where she truly belongs', 'col-fear': 'Being forgotten after she\'s gone — that her life meant nothing',
    'col-theme': 'Komm, Susser Tod — Arianne', 'col-voice': 'Miyuki Sawashiro',
    'col-arc': 'Eris lived on the margins her whole life — a tiefling in the Crimson Carnival, always the outsider\'s outsider. Finding the party was the first time she felt she belonged. Her GLITCH magic was a gift and a curse: uncontrollable, devastating, and slowly killing her. When the Shattered Veil threatened to consume reality, she chose to use her unstable power to seal it — knowing it would cost her life. Her death transformed the party and gave them the resolve to finish the fight.',
    'col-moments': '- Manifested reality-warping powers during a carnival performance, destroying the big top\n- Fled the Carnival after accidentally erasing her best friend from existence\n- Found the Veil Shard in the ruins of an ancient temple\n- First GLITCH episode during combat — duplicated herself into three copies\n- Told Kael she was dying, the only person she trusted with the truth\n- Sealed the Shattered Veil and ceased to exist, smiling',
    'col-reldet': 'Kael Nightbane — her anchor. The ancient elf understood what it meant to be alone, and he never pitied her for it. She made him laugh for the first time in decades. Their bond was familial — the father she never had.\n\nThe Party — Eris loved them all with the fierce desperation of someone who knew her time was short. She never said it directly, but everything she did in the final act was for them.',
    'col-quote': "Reality is just a suggestion. I'm more of a... freelance editor.",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};

  // ─ New characters ─
  const row6 = { id: 'row-6', section_id: 'sec-chars-table', position: 5, cells: {
    'col-name': 'Lyra Ashford', 'col-sig': 'sig-1', 'col-gender': 'g-f', 'col-age': 17, 'col-status': 'st-active', 'col-rating': 3, 'col-main': false,
    'col-race': 'Human', 'col-align': 'Lawful Neutral', 'col-mbti': 'ISTJ',
    'col-str': 'C-', 'col-end': 'C', 'col-agi': 'B-', 'col-mag': 'A', 'col-int': 'S', 'col-wis': 'A+', 'col-cha': 'D+', 'col-tar': 'B+',
    'col-dstr': 10, 'col-ddex': 12, 'col-dcon': 11, 'col-dint': 20, 'col-dwis': 18, 'col-dchar': 9,
    'col-back': 'Born into a prestigious Mage Council family, Lyra was groomed for greatness from birth. She excelled at everything through sheer discipline and study, becoming the youngest Arcanist-Scholar in Council history. When Tsukasa arrived at Aethermoor — raw, undisciplined, and more talented — Lyra\'s entire worldview cracked.',
    'col-pers': 'Methodical, precise, and deeply competitive. She masks her insecurity with academic superiority. Struggles to connect emotionally with others because she sees relationships as distractions. Secretly admires Tsukasa\'s freedom.',
    'col-comb': 'Fights with pure arcane theory made manifest. Her "Theorem Cascade" analyzes an opponent\'s magic in real-time and constructs perfect counters. Weak in physical combat but nearly unbeatable in magical duels.',
    'col-world': 'The Ashford family has held a Council seat for seven generations. Lyra carries the weight of that legacy. Her mother is Elder Ashford, one of the most powerful voices on the Council.',
    'col-notes': 'Rival archetype. Her arc mirrors Tsukasa\'s — discipline vs. talent. Should eventually become an ally. Consider a scene where she has to choose between the Council and doing what\'s right.',
    'col-title': 'The Prodigy\'s Shadow', 'col-affil': 'af-mage', 'col-class': 'Arcanist-Scholar', 'col-sigmove': 'Theorem Cascade',
    'col-weapon': 'Null Prism (crystallized logic matrix)', 'col-weak': 'Cannot handle chaos or improvisation — panics when her calculations fail',
    'col-goal': 'Prove that discipline and study surpass raw talent', 'col-fear': 'Being second-best forever, no matter how hard she works',
    'col-theme': 'Unfinished Sympathy — Massive Attack', 'col-voice': 'Maaya Sakamoto',
    'col-arc': 'Lyra begins as Tsukasa\'s antagonist within the Mage Council, convinced that the unruly prodigy is a danger to everything the Council stands for. Through forced collaboration during the Siege of Aethermoor, she begins to see that her rigid worldview is its own kind of weakness. Her turning point comes when she discovers her own mother\'s role in the corruption Tsukasa is fighting against. She must choose between family loyalty and truth.',
    'col-moments': '- Became youngest Arcanist-Scholar at age 14\n- First encounter with Tsukasa — challenged her to a formal duel and lost\n- Assigned to "supervise" Tsukasa by the Council (really to spy)\n- Saved Tsukasa during the Siege when her Theorem Cascade predicted an ambush\n- Discovered her mother was complicit in the soul-binding experiments\n- Chose to testify against her own family before the Council',
    'col-reldet': 'Tsukasa Hoshino — her rival, her opposite, and gradually her grudging respect. Lyra cannot understand how someone so chaotic can be so powerful. Tsukasa\'s freedom both infuriates and fascinates her.\n\nElder Ashford (mother) — the person Lyra has spent her life trying to please. Discovering her mother\'s corruption shattered Lyra\'s foundation.',
    'col-quote': "Talent is a spark. Discipline is the engine. I'll take the engine every time.",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};
  const row7 = { id: 'row-7', section_id: 'sec-chars-table', position: 6, cells: {
    'col-name': 'Commander Draven', 'col-sig': 'sig-2', 'col-gender': 'g-m', 'col-age': 45, 'col-status': 'st-active', 'col-rating': 2, 'col-main': false,
    'col-race': 'Human', 'col-align': 'Lawful Evil', 'col-mbti': 'ESTJ',
    'col-str': 'A+', 'col-end': 'A', 'col-agi': 'B', 'col-mag': 'D-', 'col-int': 'B+', 'col-wis': 'B-', 'col-cha': 'B', 'col-tar': 'S+',
    'col-dstr': 20, 'col-ddex': 14, 'col-dcon': 18, 'col-dint': 15, 'col-dwis': 12, 'col-dchar': 14,
    'col-back': 'Rose through the ranks of the Iron Crown through sheer force of will and tactical brilliance. He genuinely believes that the king\'s methods — including the soul-binding experiments — are necessary evils to protect the realm from external threats. When Valdora deserted, Draven took it as a personal betrayal.',
    'col-pers': 'Unyielding, pragmatic, and utterly convinced of his own righteousness. He is not cruel for cruelty\'s sake — he sees himself as the shield that protects civilization from chaos. Respects strength and loyalty above all else.',
    'col-comb': 'A master tactician and devastating melee combatant. His Soul-Chain Halberd can bind an opponent\'s movements for 5 seconds on a clean hit. Commands armies with precision. His TAR stat reflects a willpower that borders on inhuman.',
    'col-world': 'Controls Ironhollow Citadel and the northern border territories. Has been quietly building an army for what he calls "the necessary war" — a preemptive strike against the magical threats he believes are coming.',
    'col-notes': 'Antagonist but not a villain — he believes he\'s right. His confrontation with Valdora should be emotionally complex. Consider a moment where the audience sympathizes with his position.',
    'col-title': 'The Iron Fist', 'col-affil': 'af-iron', 'col-class': 'Warlord', 'col-sigmove': 'Crown\'s Judgment',
    'col-weapon': 'Soul-Chain Halberd', 'col-weak': 'Rigid worldview cannot adapt to ambiguity — breaks rather than bends',
    'col-goal': 'Maintain order at any cost, even if it means becoming the monster he fights', 'col-fear': 'That the system he dedicated his life to was wrong all along',
    'col-theme': 'Mars, the Bringer of War — Gustav Holst', 'col-voice': 'Norio Wakamoto',
    'col-arc': 'Draven is introduced as a distant threat — the man hunting Valdora. When the party reaches Ironhollow, he becomes a complex antagonist who genuinely believes his extreme methods are the only way to save the realm. His confrontation with Valdora forces both men to reckon with the ideals they once shared. In the end, Draven must decide whether to stand with his king or acknowledge the truth — and his choice defines whether he dies a villain or lives to seek redemption.',
    'col-moments': '- Took command of Ironhollow at age 30 after the previous commander fell in battle\n- Discovered the soul-binding program and chose to allow it for "the greater good"\n- Branded Valdora a traitor and swore to bring him to justice\n- Led the defense of the northern border against a demon incursion\n- Confronted Valdora in the halls of Ironhollow\n- Made his final choice at the Battle of the Shattered Veil',
    'col-reldet': 'Valdora Ashcrest — his greatest disappointment. Draven mentored Valdora, saw him as a successor. The desertion felt like losing a son. Their conflict is deeply personal on both sides.\n\nThe King — Draven serves a king he knows is flawed, because he believes the alternative is worse. This loyalty is his defining trait and his greatest weakness.',
    'col-quote': "Mercy is a luxury bought with the blood of soldiers. I won't spend their lives on sentiment.",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};
  const row8 = { id: 'row-8', section_id: 'sec-chars-table', position: 7, cells: {
    'col-name': 'Nyx', 'col-sig': 'sig-1', 'col-gender': 'g-nb', 'col-age': null, 'col-status': 'st-active', 'col-rating': 4, 'col-main': false,
    'col-race': '???', 'col-align': 'Beyond Alignment', 'col-mbti': '????',
    'col-str': 'C', 'col-end': 'B-', 'col-agi': 'A', 'col-mag': 'S', 'col-int': 'A+', 'col-wis': 'GLITCH', 'col-cha': 'A-', 'col-tar': 'S',
    'col-dstr': 11, 'col-ddex': 17, 'col-dcon': 13, 'col-dint': 19, 'col-dwis': 25, 'col-dchar': 16,
    'col-back': 'No one knows what Nyx is — not even Nyx. They emerged from the Shattered Veil after Eris sealed it, carrying fragments of memories that don\'t belong to them. They speak in riddles, see possible futures, and remember things that haven\'t happened yet. Some believe they are what remains of Eris, transformed by the Veil.',
    'col-pers': 'Ethereal, cryptic, and deeply sad in a way they cannot explain. They alternate between profound wisdom and childlike confusion. They collect small objects — stones, buttons, feathers — as if trying to anchor themselves to reality.',
    'col-comb': 'Channels the Veil directly — no weapon needed. Can glimpse seconds into the future (GLITCH-tier Wisdom), making them nearly impossible to surprise. Their "Veil Whisper" can show someone their deepest truth, which can shatter an enemy\'s resolve.',
    'col-world': 'Appeared at the site of the Shattered Veil three months after Eris\'s death. The party discovered them wandering the crater, speaking fragments of Eris\'s last words. Their existence raises questions about what the Veil actually is.',
    'col-notes': 'Mystery archetype. They are the sequel hook — their existence implies the story isn\'t over. The question of whether they are Eris reborn, a Veil entity wearing her memories, or something entirely new should never be fully answered.',
    'col-title': 'The Unnamed', 'col-affil': 'af-veil', 'col-class': 'Oracle', 'col-sigmove': 'Veil Whisper',
    'col-weapon': 'None (channels the Veil directly)', 'col-weak': 'Memories fragment with each use of power — they are slowly losing themselves',
    'col-goal': 'Remember who they were before the Veil', 'col-fear': 'That they were never anyone at all — that they are just an echo',
    'col-theme': 'Gymnop\u00e9die No.1 — Erik Satie', 'col-voice': 'Megumi Ogata',
    'col-arc': 'Nyx appears in the aftermath of the main story as a living question mark. The party must decide whether to help this strange being recover their identity or accept that Eris is truly gone. Nyx\'s journey is about whether identity is memory, soul, or something else entirely. They gradually recover fragments — some from Eris, some from other people who were touched by the Veil — forcing the party to confront what they lost and what they might regain.',
    'col-moments': '- Emerged from the Shattered Veil crater, speaking Eris\'s last words\n- First demonstrated Veil Whisper — showed Kael a vision of Eris smiling\n- Collapsed after using too much power, forgetting their own name for three days\n- Spoke a prophecy about a "second tearing" that terrified the Mage Council\n- Recognized Kael\'s bow Whisperwood despite never having "met" him\n- Asked Tsukasa "Why are you crying?" in Eris\'s exact voice',
    'col-reldet': 'Eris Valkyr — the ghost in the machine. Nyx carries pieces of Eris but is not her. This creates an agonizing dynamic with everyone who loved Eris, especially Kael.\n\nKael Nightbane — the one who found them. Kael is torn between hope that Eris survives in some form and the fear of losing her again. He becomes Nyx\'s reluctant guardian.\n\nThe Party — everyone sees something different in Nyx. To Tsukasa, they\'re a second chance. To Valdora, they\'re an unsettling reminder. To Saya, they\'re a patient to heal.',
    'col-quote': "I remember a sky that hasn't happened yet. Is that memory, or prophecy?",
    'col-profileimg': null,
    'col-fullimg': null,
    'col-gallery': null,
  }};
  C.rows['sec-chars-table'] = [row1, row2, row3, row4, row5, row6, row7, row8];

  // ─ Places table (expanded) ─
  const placeTypeOpts = [
    { id: 'pt-world', label: 'World', color: 'pur' },
    { id: 'pt-city', label: 'City', color: 'tel' },
    { id: 'pt-region', label: 'Region', color: 'grn' },
    { id: 'pt-landmark', label: 'Landmark', color: 'ora' },
    { id: 'pt-dungeon', label: 'Dungeon', color: 'hot' },
  ];
  const climateOpts = [
    { id: 'cl-temp', label: 'Temperate', color: 'grn' },
    { id: 'cl-arctic', label: 'Arctic', color: 'blu' },
    { id: 'cl-desert', label: 'Desert', color: 'ora' },
    { id: 'cl-tropical', label: 'Tropical', color: 'tel' },
    { id: 'cl-volcanic', label: 'Volcanic', color: 'hot' },
    { id: 'cl-ethereal', label: 'Ethereal', color: 'pur' },
  ];
  const pcol1 = { id: 'pcol-name', section_id: 'sec-places-table', name: 'Name', type: 'text', position: 0, width: 180 };
  const pcol2 = { id: 'pcol-type', section_id: 'sec-places-table', name: 'Type', type: 'select', position: 1, width: 120, options: placeTypeOpts };
  const pcol3 = { id: 'pcol-climate', section_id: 'sec-places-table', name: 'Climate', type: 'select', position: 2, width: 120, options: climateOpts };
  const pcol4 = { id: 'pcol-danger', section_id: 'sec-places-table', name: 'Danger Level', type: 'letter_grade', position: 3, width: 100 };
  const pcol5 = { id: 'pcol-pop', section_id: 'sec-places-table', name: 'Population', type: 'number', position: 4, width: 100 };
  const pcol6 = { id: 'pcol-faction', section_id: 'sec-places-table', name: 'Faction', type: 'text', position: 5, width: 150 };
  const pcol7 = { id: 'pcol-desc', section_id: 'sec-places-table', name: 'Description', type: 'text', position: 6, width: 260 };
  C.columns['sec-places-table'] = [pcol1, pcol2, pcol3, pcol4, pcol5, pcol6, pcol7];

  C.rows['sec-places-table'] = [
    { id: 'prow-1', section_id: 'sec-places-table', position: 0, cells: { 'pcol-name': 'Aethermoor', 'pcol-type': 'pt-city', 'pcol-climate': 'cl-temp', 'pcol-danger': 'B+', 'pcol-pop': 45000, 'pcol-faction': 'Mage Council', 'pcol-desc': 'The City of Fractured Light. A floating metropolis held aloft by ancient crystalline pylons.' }},
    { id: 'prow-2', section_id: 'sec-places-table', position: 1, cells: { 'pcol-name': 'Starfall Basin', 'pcol-type': 'pt-region', 'pcol-climate': 'cl-ethereal', 'pcol-danger': 'A-', 'pcol-pop': 200, 'pcol-faction': 'None', 'pcol-desc': 'A vast crater filled with crystallized mana from a meteor impact. Reality is thin here.' }},
    { id: 'prow-3', section_id: 'sec-places-table', position: 2, cells: { 'pcol-name': 'Ironhollow Citadel', 'pcol-type': 'pt-city', 'pcol-climate': 'cl-arctic', 'pcol-danger': 'A+', 'pcol-pop': 12000, 'pcol-faction': 'Iron Crown', 'pcol-desc': 'A fortress-city carved into a frozen mountain. Home to the corrupted kingdom Valdora fled.' }},
    { id: 'prow-4', section_id: 'sec-places-table', position: 3, cells: { 'pcol-name': 'Verdant Reach', 'pcol-type': 'pt-region', 'pcol-climate': 'cl-tropical', 'pcol-danger': 'C+', 'pcol-pop': 3000, 'pcol-faction': 'Forest Spirits', 'pcol-desc': 'An ancient, sentient forest where the trees whisper. Kael has guarded it for centuries.' }},
    { id: 'prow-5', section_id: 'sec-places-table', position: 4, cells: { 'pcol-name': 'The Shattered Veil', 'pcol-type': 'pt-landmark', 'pcol-climate': 'cl-ethereal', 'pcol-danger': 'S+', 'pcol-pop': 0, 'pcol-faction': 'None', 'pcol-desc': 'A tear in the dimensional fabric where reality collapses. Eris died here sealing the rift.' }},
    { id: 'prow-6', section_id: 'sec-places-table', position: 5, cells: { 'pcol-name': 'Cindermaw Forge', 'pcol-type': 'pt-city', 'pcol-climate': 'cl-volcanic', 'pcol-danger': 'B', 'pcol-pop': 8000, 'pcol-faction': 'Forge Guild', 'pcol-desc': 'Built inside an active volcano. The greatest smiths in the world work here, crafting legendary weapons.' }},
  ];

  // ─ Items table ─
  const secItems = { id: 'sec-items-table', page_id: 'pg-items', name: 'Items', type: 'table', collapsed: false, position: 0 };
  C.sections['pg-items'] = [secItems];

  const rarityOpts = [
    { id: 'rar-common', label: 'Common', color: 'gry' },
    { id: 'rar-uncommon', label: 'Uncommon', color: 'grn' },
    { id: 'rar-rare', label: 'Rare', color: 'blu' },
    { id: 'rar-legendary', label: 'Legendary', color: 'gold' },
    { id: 'rar-mythic', label: 'Mythic', color: 'hot' },
  ];
  const itemTypeOpts = [
    { id: 'it-weapon', label: 'Weapon', color: 'hot' },
    { id: 'it-armor', label: 'Armor', color: 'blu' },
    { id: 'it-artifact', label: 'Artifact', color: 'pur' },
    { id: 'it-consumable', label: 'Consumable', color: 'grn' },
    { id: 'it-material', label: 'Material', color: 'ora' },
  ];
  const icol1 = { id: 'icol-name', section_id: 'sec-items-table', name: 'Name', type: 'text', position: 0, width: 180 };
  const icol2 = { id: 'icol-rarity', section_id: 'sec-items-table', name: 'Rarity', type: 'select', position: 1, width: 120, options: rarityOpts };
  const icol3 = { id: 'icol-type', section_id: 'sec-items-table', name: 'Type', type: 'select', position: 2, width: 120, options: itemTypeOpts };
  const icol4 = { id: 'icol-power', section_id: 'sec-items-table', name: 'Power', type: 'letter_grade', position: 3, width: 90 };
  const icol5 = { id: 'icol-value', section_id: 'sec-items-table', name: 'Value (gp)', type: 'number', position: 4, width: 100 };
  const icol6 = { id: 'icol-owner', section_id: 'sec-items-table', name: 'Owner', type: 'text', position: 5, width: 140 };
  const icol7 = { id: 'icol-desc', section_id: 'sec-items-table', name: 'Description', type: 'text', position: 6, width: 240 };
  const icol8 = { id: 'icol-effect', section_id: 'sec-items-table', name: 'Special Effect', type: 'text', position: 7, width: 220 };
  C.columns['sec-items-table'] = [icol1, icol2, icol3, icol4, icol5, icol6, icol7, icol8];

  C.rows['sec-items-table'] = [
    { id: 'irow-1', section_id: 'sec-items-table', position: 0, cells: { 'icol-name': 'Starbreaker', 'icol-rarity': 'rar-legendary', 'icol-type': 'it-weapon', 'icol-power': 'A+', 'icol-value': 50000, 'icol-owner': 'Tsukasa Hoshino', 'icol-desc': 'A crystalline staff that channels raw mana into devastating blasts.', 'icol-effect': 'Doubles ice spell damage. On critical hit, freezes target solid for 3 seconds.' }},
    { id: 'irow-2', section_id: 'sec-items-table', position: 1, cells: { 'icol-name': 'Oathbreaker', 'icol-rarity': 'rar-legendary', 'icol-type': 'it-weapon', 'icol-power': 'A', 'icol-value': 35000, 'icol-owner': 'Valdora Ashcrest', 'icol-desc': 'An enchanted greatsword that hums with residual oath-magic.', 'icol-effect': 'Ignores magical barriers. Wielder gains resistance to charm and fear effects.' }},
    { id: 'irow-3', section_id: 'sec-items-table', position: 2, cells: { 'icol-name': 'Veil Shard', 'icol-rarity': 'rar-mythic', 'icol-type': 'it-artifact', 'icol-power': 'S', 'icol-value': 999999, 'icol-owner': 'Eris Valkyr (lost)', 'icol-desc': 'A fragment of the dimensional barrier, pulsing with unstable energy.', 'icol-effect': 'Grants reality-warping abilities but each use risks catastrophic dimensional tears.' }},
    { id: 'irow-4', section_id: 'sec-items-table', position: 3, cells: { 'icol-name': 'Whisperwood', 'icol-rarity': 'rar-rare', 'icol-type': 'it-weapon', 'icol-power': 'A-', 'icol-value': 18000, 'icol-owner': 'Kael Nightbane', 'icol-desc': 'A living bow grown from an ancient sentinel tree.', 'icol-effect': 'Arrows never miss visible targets. Bow repairs itself overnight.' }},
    { id: 'irow-5', section_id: 'sec-items-table', position: 4, cells: { 'icol-name': 'Luminari Vestments', 'icol-rarity': 'rar-rare', 'icol-type': 'it-armor', 'icol-power': 'B+', 'icol-value': 12000, 'icol-owner': 'Saya Mizuki', 'icol-desc': 'Sacred robes of the ancient healing order.', 'icol-effect': 'Healing spells cost 50% less mana. Wearer regenerates slowly in sunlight.' }},
    { id: 'irow-6', section_id: 'sec-items-table', position: 5, cells: { 'icol-name': 'Soul Compass', 'icol-rarity': 'rar-legendary', 'icol-type': 'it-artifact', 'icol-power': 'A', 'icol-value': 40000, 'icol-owner': '', 'icol-desc': 'Points toward the strongest source of magical energy within 100 miles.', 'icol-effect': 'Can detect dimensional anomalies and soul-bound objects. Whispers warnings of danger.' }},
    { id: 'irow-7', section_id: 'sec-items-table', position: 6, cells: { 'icol-name': 'Null Prism', 'icol-rarity': 'rar-rare', 'icol-type': 'it-weapon', 'icol-power': 'A-', 'icol-value': 15000, 'icol-owner': 'Lyra Ashford', 'icol-desc': 'A crystallized logic matrix that converts raw mana into precise arcane formulas.', 'icol-effect': 'Analyzes enemy spells in real-time. Counter-spells cost 30% less mana.' }},
    { id: 'irow-8', section_id: 'sec-items-table', position: 7, cells: { 'icol-name': 'Soul-Chain Halberd', 'icol-rarity': 'rar-legendary', 'icol-type': 'it-weapon', 'icol-power': 'A+', 'icol-value': 45000, 'icol-owner': 'Commander Draven', 'icol-desc': 'A massive halberd forged with soul-binding enchantments. The chains glow when it strikes.', 'icol-effect': 'Clean hits bind the target\'s movements for 5 seconds. Wielder gains +2 to all saving throws.' }},
  ];

  // ─ Add Bonds (relation) column to Characters ─
  const colBonds = { id: 'col-bonds', section_id: 'sec-chars-table', name: 'Bonds', type: 'relation', position: 47, width: 140 };
  C.columns['sec-chars-table'].push(colBonds);

  // ─ Sample relations ─
  C.relations = {
    'row-1:col-bonds': new Set(['row-2', 'row-3', 'row-6']),   // Tsukasa → Valdora, Saya, Lyra
    'row-2:col-bonds': new Set(['row-1', 'row-4', 'row-7']),   // Valdora → Tsukasa, Kael, Draven
    'row-3:col-bonds': new Set(['row-1']),                       // Saya → Tsukasa
    'row-4:col-bonds': new Set(['row-2', 'row-5', 'row-8']),   // Kael → Valdora, Eris, Nyx
    'row-5:col-bonds': new Set(['row-4', 'row-8']),             // Eris → Kael, Nyx
    'row-6:col-bonds': new Set(['row-1']),                       // Lyra → Tsukasa (rival)
    'row-7:col-bonds': new Set(['row-2']),                       // Draven → Valdora (ex-subordinate)
    'row-8:col-bonds': new Set(['row-4', 'row-5']),             // Nyx → Kael, Eris (Veil connection)
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
