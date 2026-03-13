import { useState, useEffect, useRef } from 'react';
import SectionShell from './SectionShell.jsx';
import { loadListItems, getListItems, addListItem, updateListItem, deleteListItem, clearCheckedListItems, reorderListItems } from '../../store/vaultStore.js';
import { useVault } from '../../hooks/useVault.js';
import s from '../../styles/ListSection.module.css';

export default function ListSection({ section }) {
  const vault = useVault();
  const items = getListItems(section.id);
  const [addText, setAddText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [dragOverId, setDragOverId] = useState(null);
  const dragSrcRef = useRef(null);

  useEffect(() => { loadListItems(section.id); }, [section.id]);

  const hasChecked = items.some(i => i.checked);

  const handleAdd = () => {
    if (!addText.trim()) return;
    addListItem(section.id, addText.trim());
    setAddText('');
  };

  const handleCheck = (item) => {
    updateListItem(item.id, { checked: !item.checked });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const commitEdit = (itemId) => {
    setEditingId(null);
    if (editText.trim()) {
      updateListItem(itemId, { text: editText.trim() });
    }
  };

  const handleDelete = (e, itemId) => {
    e.preventDefault();
    deleteListItem(itemId);
  };

  // Drag-to-reorder
  const handleDragStart = (itemId) => {
    dragSrcRef.current = itemId;
  };

  const handleDragOver = (e, itemId) => {
    e.preventDefault();
    if (dragSrcRef.current && dragSrcRef.current !== itemId) {
      setDragOverId(itemId);
    }
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const srcId = dragSrcRef.current;
    if (!srcId || srcId === targetId) { setDragOverId(null); return; }
    const ids = items.map(i => i.id);
    const fromIdx = ids.indexOf(srcId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragOverId(null); return; }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, srcId);
    reorderListItems(section.id, ids);
    setDragOverId(null);
    dragSrcRef.current = null;
  };

  const handleDragEnd = () => {
    dragSrcRef.current = null;
    setDragOverId(null);
  };

  return (
    <SectionShell section={section}>
      <div className={s.list}>
        {items.map(item => (
          <div
            key={item.id}
            className={`${s.item} ${item.checked ? s.checked : ''} ${dragOverId === item.id ? s.dragOver : ''}`}
            onContextMenu={e => handleDelete(e, item.id)}
            onDragOver={e => handleDragOver(e, item.id)}
            onDrop={e => handleDrop(e, item.id)}
          >
            <span
              className={s.dragHandle}
              draggable
              onDragStart={() => handleDragStart(item.id)}
              onDragEnd={handleDragEnd}
              title="Drag to reorder"
            >⠿</span>
            <button className={s.checkbox} onClick={() => handleCheck(item)}>
              {item.checked ? '☑' : '☐'}
            </button>
            {editingId === item.id ? (
              <input
                className={s.editInput}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={() => commitEdit(item.id)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(item.id); if (e.key === 'Escape') setEditingId(null); }}
                autoFocus
              />
            ) : (
              <span className={s.text} onClick={() => startEdit(item)}>
                {item.text}
              </span>
            )}
          </div>
        ))}
        <div className={s.addRow}>
          <input
            className={s.addInput}
            value={addText}
            onChange={e => setAddText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder=""
          />
          <button className={s.addBtn} onClick={handleAdd}>+</button>
        </div>
        {hasChecked && (
          <button className={s.clearBtn} onClick={() => clearCheckedListItems(section.id)}>
            Clear checked
          </button>
        )}
      </div>
    </SectionShell>
  );
}
