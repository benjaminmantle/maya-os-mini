import { useState, useEffect, useMemo } from 'react';
import SectionShell from './SectionShell.jsx';
import TableGrid from '../table/TableGrid.jsx';
import TableGallery from '../table/TableGallery.jsx';
import ImportModal from '../table/ImportModal.jsx';
import RelationGraph from '../table/RelationGraph.jsx';
import ShowcaseView from '../showcase/ShowcaseView.jsx';
import { getShowcase } from '../showcase/ShowcaseRegistry.js';
import { loadColumns, loadRows, getColumns, getRows, defaultForType } from '../../store/vaultStore.js';
import { useVault } from '../../hooks/useVault.js';
import g from '../../styles/TableGallery.module.css';

export default function TableSection({ section }) {
  const vault = useVault();
  const columns = getColumns(section.id);
  const rows = getRows(section.id);
  const [view, setView] = useState('grid'); // 'grid' | 'gallery' | 'showcase' | 'graph'
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  // Check if this section has a registered showcase template
  const showcaseTemplate = section.showcase_template;
  const hasShowcase = showcaseTemplate && getShowcase(showcaseTemplate);

  // Check if any column is a relation type (enables graph view)
  const hasRelations = columns.some(c => c.type === 'relation');

  useEffect(() => {
    loadColumns(section.id);
    loadRows(section.id);
  }, [section.id]);

  // Filter rows by matching any cell value against the filter text
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const q = filterText.trim().toLowerCase();
    return rows.filter(row => {
      return columns.some(col => {
        const val = row.cells[col.id] ?? defaultForType(col.type);
        if (val == null) return false;
        if (col.type === 'select') {
          const opt = (col.options || []).find(o => o.id === val);
          return opt?.label?.toLowerCase().includes(q);
        }
        if (col.type === 'multi_select') {
          const ids = Array.isArray(val) ? val : [];
          return ids.some(id => {
            const opt = (col.options || []).find(o => o.id === id);
            return opt?.label?.toLowerCase().includes(q);
          });
        }
        if (col.type === 'checkbox') {
          return (val ? 'yes true checked' : 'no false unchecked').includes(q);
        }
        if (col.type === 'letter_grade') {
          return typeof val === 'string' && val.toLowerCase().includes(q);
        }
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [rows, columns, filterText]);

  const toolbar = (
    <div className={g.viewToggle}>
      <button
        className={g.viewBtn}
        onClick={() => setImportOpen(true)}
        title="Import CSV"
      >📥</button>
      <button
        className={`${g.viewBtn} ${filterOpen ? g.viewBtnActive : ''}`}
        onClick={() => { setFilterOpen(o => !o); if (filterOpen) setFilterText(''); }}
        title="Filter rows"
      >⚲</button>
      <button
        className={`${g.viewBtn} ${view === 'grid' ? g.viewBtnActive : ''}`}
        onClick={() => setView('grid')}
        title="Table view"
      >☰</button>
      <button
        className={`${g.viewBtn} ${view === 'gallery' ? g.viewBtnActive : ''}`}
        onClick={() => setView('gallery')}
        title="Gallery view"
      >▦</button>
      {hasShowcase && (
        <button
          className={`${g.viewBtn} ${view === 'showcase' ? g.viewBtnActive : ''}`}
          onClick={() => setView('showcase')}
          title="Showcase view"
        >⬡</button>
      )}
      {hasRelations && (
        <button
          className={`${g.viewBtn} ${view === 'graph' ? g.viewBtnActive : ''}`}
          onClick={() => setView('graph')}
          title="Relationship graph"
        >◈</button>
      )}
    </div>
  );

  const renderView = () => {
    if (view === 'graph' && hasRelations) {
      return <RelationGraph rows={filteredRows} columns={columns} sectionId={section.id} />;
    }
    if (view === 'showcase' && hasShowcase) {
      return <ShowcaseView rows={filteredRows} columns={columns} templateKey={showcaseTemplate} />;
    }
    if (view === 'gallery') {
      return <TableGallery columns={columns} rows={filteredRows} />;
    }
    return <TableGrid sectionId={section.id} columns={columns} rows={filteredRows} />;
  };

  return (
    <SectionShell section={section} toolbar={toolbar}>
      {filterOpen && (
        <div className={g.filterBar}>
          <input
            className={g.filterInput}
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter rows…"
            autoFocus
          />
          {filterText && (
            <span className={g.filterCount}>
              {filteredRows.length} / {rows.length}
            </span>
          )}
        </div>
      )}
      {renderView()}
      {importOpen && (
        <ImportModal sectionId={section.id} onClose={() => setImportOpen(false)} />
      )}
    </SectionShell>
  );
}
