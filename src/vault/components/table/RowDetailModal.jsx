import { useState, useEffect, useRef } from 'react';
import CellEditor from './CellEditor.jsx';
import CellRenderer from './CellRenderer.jsx';
import { defaultForType, setCellValue } from '../../store/vaultStore.js';
import s from '../../styles/RowDetailModal.module.css';

export default function RowDetailModal({ row, titleCol, columns, onClose }) {
  const [editingColId, setEditingColId] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = (colId, value) => {
    setCellValue(row.id, colId, value);
    setEditingColId(null);
  };

  const handleCellClick = (colId, column) => {
    if (column.type === 'checkbox') {
      const cur = row.cells[colId] ?? false;
      setCellValue(row.id, colId, !cur);
      return;
    }
    setEditingColId(colId);
  };

  const title = row.cells?.[titleCol?.id] ?? defaultForType(titleCol?.type);
  const fieldCols = columns.filter(c => c.id !== titleCol?.id);

  return (
    <div className={s.detailOverlay} onMouseDown={(e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }}>
      <div className={s.detailPanel} ref={panelRef}>
        <button className={s.detailClose} onClick={onClose} title="Close">✕</button>

        <div className={s.detailTitleWrap}>
          {editingColId === titleCol?.id ? (
            <input
              className={s.detailTitleInput}
              defaultValue={title}
              autoFocus
              onBlur={e => handleSave(titleCol.id, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave(titleCol.id, e.target.value);
                if (e.key === 'Escape') setEditingColId(null);
              }}
            />
          ) : (
            <h2
              className={s.detailTitle}
              onClick={() => titleCol && setEditingColId(titleCol.id)}
            >
              {title || 'Untitled'}
            </h2>
          )}
        </div>

        <div className={s.detailFields}>
          {fieldCols.map(col => {
            const val = row.cells?.[col.id] ?? defaultForType(col.type);
            return (
              <div key={col.id} className={s.detailField}>
                <span className={s.detailFieldLabel}>{col.name}</span>
                <div
                  className={s.detailFieldValue}
                  onClick={() => !editingColId && handleCellClick(col.id, col)}
                >
                  {editingColId === col.id ? (
                    <CellEditor
                      value={val}
                      column={col}
                      onSave={v => handleSave(col.id, v)}
                      onCancel={() => setEditingColId(null)}
                    />
                  ) : (
                    <CellRenderer value={val} column={col} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
