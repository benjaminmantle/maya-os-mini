import { useState } from 'react';
import { toggleSectionCollapsed, saveSection, deleteSection } from '../../store/vaultStore.js';
import s from '../../styles/SectionShell.module.css';

export default function SectionShell({ section, children, toolbar }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name || '');

  const toggle = () => toggleSectionCollapsed(section.id);

  const commitName = () => {
    setEditing(false);
    if (name !== section.name) {
      saveSection({ ...section, name });
    }
  };

  const handleDelete = () => {
    deleteSection(section.id);
  };

  return (
    <div className={s.shell}>
      <div className={s.header}>
        <button className={s.collapseBtn} onClick={toggle}>
          {section.collapsed ? '▸' : '▾'}
        </button>
        {editing ? (
          <input
            className={s.nameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(section.name || ''); setEditing(false); } }}
            autoFocus
          />
        ) : (
          <span
            className={s.name}
            onDoubleClick={() => setEditing(true)}
          >
            {section.name || 'Untitled'}
          </span>
        )}
        {toolbar}
        <button className={s.deleteBtn} onClick={handleDelete} title="Delete section">✕</button>
      </div>
      {!section.collapsed && (
        <div className={s.body}>
          {children}
        </div>
      )}
    </div>
  );
}
