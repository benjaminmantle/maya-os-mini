import { useState, useRef } from 'react';
import CellRenderer from './CellRenderer.jsx';
import CellEditor from './CellEditor.jsx';
import { setCellValue, addRow, deleteRow, addColumn, renameColumn, deleteColumn, reorderRows, defaultForType, gradeToNum } from '../../store/vaultStore.js';
import s from '../../styles/TableGrid.module.css';

export default function TableGrid({ sectionId, columns, rows }) {
  const [editingCell, setEditingCell] = useState(null); // { rowId, colId }
  const [editingColId, setEditingColId] = useState(null);
  const [colName, setColName] = useState('');
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [sort, setSort] = useState(null); // { colId, dir: 'asc' | 'desc' }
  const [dragOverRowId, setDragOverRowId] = useState(null);
  const dragSrcRef = useRef(null);

  // Sort rows if a sort is active
  const sortedRows = (() => {
    if (!sort) return rows;
    const col = columns.find(c => c.id === sort.colId);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const va = a.cells[sort.colId] ?? defaultForType(col.type);
      const vb = b.cells[sort.colId] ?? defaultForType(col.type);
      let cmp = 0;
      if (col.type === 'number' || col.type === 'rating') {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      } else if (col.type === 'letter_grade') {
        cmp = gradeToNum(va) - gradeToNum(vb);
      } else if (col.type === 'checkbox') {
        cmp = (va ? 1 : 0) - (vb ? 1 : 0);
      } else if (col.type === 'select') {
        const la = (col.options || []).find(o => o.id === va)?.label || '';
        const lb = (col.options || []).find(o => o.id === vb)?.label || '';
        cmp = la.localeCompare(lb);
      } else {
        cmp = String(va || '').localeCompare(String(vb || ''));
      }
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  })();

  const canDrag = !sort; // Disable drag when sort is active

  const toggleSort = (colId) => {
    if (!sort || sort.colId !== colId) {
      setSort({ colId, dir: 'asc' });
    } else if (sort.dir === 'asc') {
      setSort({ colId, dir: 'desc' });
    } else {
      setSort(null);
    }
  };

  const isEditing = (rowId, colId) =>
    editingCell && editingCell.rowId === rowId && editingCell.colId === colId;

  const handleCellClick = (rowId, colId, column) => {
    if (column.type === 'checkbox') {
      const row = rows.find(r => r.id === rowId);
      const cur = row?.cells[colId] ?? false;
      setCellValue(rowId, colId, !cur);
      return;
    }
    setEditingCell({ rowId, colId });
  };

  const handleSave = (rowId, colId, value) => {
    setCellValue(rowId, colId, value);
    setEditingCell(null);
  };

  const handleAddRow = () => addRow(sectionId);
  const handleDeleteRow = (rowId) => deleteRow(rowId);

  // Drag-to-reorder handlers
  const handleDragStart = (rowId) => {
    dragSrcRef.current = rowId;
  };

  const handleDragOver = (e, rowId) => {
    e.preventDefault();
    if (dragSrcRef.current && dragSrcRef.current !== rowId) {
      setDragOverRowId(rowId);
    }
  };

  const handleDrop = (e, targetRowId) => {
    e.preventDefault();
    const srcId = dragSrcRef.current;
    if (!srcId || srcId === targetRowId) { setDragOverRowId(null); return; }
    const ids = rows.map(r => r.id);
    const fromIdx = ids.indexOf(srcId);
    const toIdx = ids.indexOf(targetRowId);
    if (fromIdx === -1 || toIdx === -1) { setDragOverRowId(null); return; }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, srcId);
    reorderRows(sectionId, ids);
    setDragOverRowId(null);
    dragSrcRef.current = null;
  };

  const handleDragEnd = () => {
    dragSrcRef.current = null;
    setDragOverRowId(null);
  };

  // Column rename
  const startColRename = (col) => {
    setEditingColId(col.id);
    setColName(col.name);
  };
  const commitColRename = (colId) => {
    setEditingColId(null);
    if (colName.trim()) renameColumn(sectionId, colId, colName.trim());
  };

  // Add column
  const commitAddCol = () => {
    if (newColName.trim()) {
      addColumn(sectionId, { name: newColName.trim(), type: newColType });
    }
    setAddingCol(false);
    setNewColName('');
    setNewColType('text');
  };

  return (
    <div className={s.gridWrap}>
      <div className={s.grid} style={{ gridTemplateColumns: `32px ${columns.map(c => `${c.width || 160}px`).join(' ')} 40px` }}>
        {/* Header row */}
        <div className={`${s.headerCell} ${s.rowActions}`} />
        {columns.map(col => (
          <div key={col.id} className={s.headerCell}>
            {editingColId === col.id ? (
              <input
                className={s.colNameInput}
                value={colName}
                onChange={e => setColName(e.target.value)}
                onBlur={() => commitColRename(col.id)}
                onKeyDown={e => { if (e.key === 'Enter') commitColRename(col.id); if (e.key === 'Escape') setEditingColId(null); }}
                autoFocus
              />
            ) : (
              <span
                className={s.colName}
                onClick={() => toggleSort(col.id)}
                onDoubleClick={() => startColRename(col)}
                title={`${col.name} (${col.type}) — click to sort, double-click to rename, right-click to delete`}
                onContextMenu={e => {
                  e.preventDefault();
                  deleteColumn(sectionId, col.id);
                }}
              >
                {col.name}
                {sort?.colId === col.id && (
                  <span className={s.sortArrow}>{sort.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </span>
            )}
          </div>
        ))}
        <div className={s.headerCell}>
          <button
            className={s.addColBtn}
            onClick={() => setAddingCol(true)}
            title="Add column"
          >+</button>
        </div>

        {/* Data rows */}
        {sortedRows.map((row, ri) => (
          <Row
            key={row.id}
            row={row}
            columns={columns}
            ri={ri}
            isEditing={isEditing}
            onCellClick={handleCellClick}
            onSave={handleSave}
            onCancel={() => setEditingCell(null)}
            onDelete={() => handleDeleteRow(row.id)}
            canDrag={canDrag}
            isDragOver={dragOverRowId === row.id}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}

        {/* Add row */}
        <div className={`${s.cell} ${s.rowActions}`} />
        <div className={s.addRowCell} style={{ gridColumn: `2 / ${columns.length + 3}` }}>
          <button className={s.addRowBtn} onClick={handleAddRow}>+ add row</button>
        </div>
      </div>

      {/* Add column panel */}
      {addingCol && (
        <div className={s.addColPanel}>
          <input
            className={s.addColInput}
            value={newColName}
            onChange={e => setNewColName(e.target.value)}
            placeholder="Column name"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') commitAddCol(); if (e.key === 'Escape') setAddingCol(false); }}
          />
          <select className={s.addColSelect} value={newColType} onChange={e => setNewColType(e.target.value)}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="multi_select">Multi-Select</option>
            <option value="checkbox">Checkbox</option>
            <option value="date">Date</option>
            <option value="url">URL</option>
            <option value="rating">Rating</option>
            <option value="letter_grade">Letter Grade</option>
          </select>
          <button className={s.addColConfirm} onClick={commitAddCol}>Add</button>
          <button className={s.addColCancel} onClick={() => setAddingCol(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

function Row({ row, columns, ri, isEditing, onCellClick, onSave, onCancel, onDelete, canDrag, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  return (
    <>
      <div
        className={`${s.cell} ${s.rowActions} ${ri % 2 ? s.altRow : ''} ${isDragOver ? s.dragOver : ''}`}
        onDragOver={canDrag ? (e) => onDragOver(e, row.id) : undefined}
        onDrop={canDrag ? (e) => onDrop(e, row.id) : undefined}
      >
        {canDrag && (
          <span
            className={s.dragHandle}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.target.closest(`.${s.cell}`)?.parentElement?.querySelectorAll(`.${s.cell}`).forEach(c => { if (c.dataset.rowid === row.id) c.style.opacity = '0.3'; }); onDragStart(row.id); }}
            onDragEnd={(e) => { document.querySelectorAll(`.${s.cell}`).forEach(c => c.style.opacity = ''); onDragEnd(); }}
            title="Drag to reorder"
          >⠿</span>
        )}
        <button className={s.rowDeleteBtn} onClick={onDelete} title="Delete row">✕</button>
      </div>
      {columns.map(col => {
        const value = row.cells[col.id] ?? defaultForType(col.type);
        return (
          <div
            key={col.id}
            className={`${s.cell} ${ri % 2 ? s.altRow : ''} ${isDragOver ? s.dragOver : ''}`}
            onClick={() => !isEditing(row.id, col.id) && onCellClick(row.id, col.id, col)}
            onDragOver={canDrag ? (e) => onDragOver(e, row.id) : undefined}
            onDrop={canDrag ? (e) => onDrop(e, row.id) : undefined}
          >
            {isEditing(row.id, col.id) ? (
              <CellEditor
                value={value}
                column={col}
                onSave={val => onSave(row.id, col.id, val)}
                onCancel={onCancel}
              />
            ) : (
              <CellRenderer value={value} column={col} />
            )}
          </div>
        );
      })}
      <div
        className={`${s.cell} ${ri % 2 ? s.altRow : ''} ${isDragOver ? s.dragOver : ''}`}
        onDragOver={canDrag ? (e) => onDragOver(e, row.id) : undefined}
        onDrop={canDrag ? (e) => onDrop(e, row.id) : undefined}
      />
    </>
  );
}
