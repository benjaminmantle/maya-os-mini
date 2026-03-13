import { useState, useEffect } from 'react';
import TableSection from '../sections/TableSection.jsx';
import ListSection from '../sections/ListSection.jsx';
import TextSection from '../sections/TextSection.jsx';
import { getSections, loadSections, saveSection, savePage, getAllPages, getSpaces } from '../../store/vaultStore.js';
import { useVault } from '../../hooks/useVault.js';
import s from '../../styles/PageView.module.css';

export default function PageView({ pageId, onNavigate }) {
  const vault = useVault();
  const sections = getSections(pageId);
  const allPages = getAllPages();
  const spaces = getSpaces();
  const [addingSection, setAddingSection] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const page = allPages.find(p => p.id === pageId);

  useEffect(() => {
    loadSections(pageId);
    setEditingTitle(false);
    setAddingSection(false);
  }, [pageId]);

  if (!page) {
    return (
      <div className={s.empty}>
        <span className={s.emptyIcon}>⬡</span>
        <p className={s.emptyText}>Select a page from the sidebar</p>
      </div>
    );
  }

  // Build breadcrumb
  const crumbs = [];
  let cur = page;
  while (cur) {
    crumbs.unshift(cur);
    cur = cur.parent_id ? allPages.find(p => p.id === cur.parent_id) : null;
  }
  const space = spaces.find(sp => sp.id === page.space_id);

  const startTitleEdit = () => {
    setTitleDraft(page.name);
    setEditingTitle(true);
  };

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== page.name) {
      savePage({ ...page, name: trimmed });
    }
  };

  const handleAddSection = (type) => {
    saveSection({ page_id: pageId, name: type === 'text' ? '' : 'Untitled', type });
    setAddingSection(false);
  };

  const renderSection = (section) => {
    switch (section.type) {
      case 'table': return <TableSection key={section.id} section={section} />;
      case 'list':  return <ListSection key={section.id} section={section} />;
      case 'text':  return <TextSection key={section.id} section={section} />;
      default: return null;
    }
  };

  return (
    <div className={s.pageView}>
      {/* Breadcrumb */}
      <div className={s.breadcrumb}>
        {space && (
          <>
            <span className={s.crumbSpace}>{space.name}</span>
            <span className={s.crumbSep}>›</span>
          </>
        )}
        {crumbs.map((c, i) => (
          <span key={c.id}>
            {i > 0 && <span className={s.crumbSep}>›</span>}
            <span
              className={`${s.crumbPage} ${c.id === pageId ? s.crumbActive : ''}`}
              onClick={() => c.id !== pageId && onNavigate(c.id)}
            >
              {c.name}
            </span>
          </span>
        ))}
      </div>

      {/* Page title */}
      {editingTitle ? (
        <input
          className={s.pageTitleInput}
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
          autoFocus
        />
      ) : (
        <h1 className={s.pageTitle} onDoubleClick={startTitleEdit}>{page.name}</h1>
      )}

      {/* Sections */}
      <div className={s.sections}>
        {sections.length === 0 && (
          <div className={s.emptySections}>
            <span className={s.emptySectionsIcon}>⬡</span>
            <p className={s.emptySectionsText}>This page is empty</p>
            <p className={s.emptySectionsHint}>Add a table, list, or text section below</p>
          </div>
        )}
        {sections.map(sec => renderSection(sec))}
      </div>

      {/* Add section */}
      <div className={s.addSection}>
        {addingSection ? (
          <div className={s.sectionPicker}>
            <button className={s.pickerBtn} onClick={() => handleAddSection('table')}>
              <span className={s.pickerIcon}>⊞</span> Table
            </button>
            <button className={s.pickerBtn} onClick={() => handleAddSection('list')}>
              <span className={s.pickerIcon}>☰</span> List
            </button>
            <button className={s.pickerBtn} onClick={() => handleAddSection('text')}>
              <span className={s.pickerIcon}>¶</span> Text
            </button>
            <button className={s.pickerCancel} onClick={() => setAddingSection(false)}>✕</button>
          </div>
        ) : (
          <button className={s.addBtn} onClick={() => setAddingSection(true)}>
            + Add section
          </button>
        )}
      </div>
    </div>
  );
}
