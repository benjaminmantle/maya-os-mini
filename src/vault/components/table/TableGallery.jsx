import { useState } from 'react';
import RowDetailModal from './RowDetailModal.jsx';
import TagChip from '../shared/TagChip.jsx';
import StarRating from '../shared/StarRating.jsx';
import GradeBadge from '../shared/GradeBadge.jsx';
import { defaultForType } from '../../store/vaultStore.js';
import s from '../../styles/TableGallery.module.css';

export default function TableGallery({ columns, rows }) {
  const [expandedRowId, setExpandedRowId] = useState(null);

  if (!rows.length) {
    return <div className={s.empty}>No rows yet</div>;
  }

  // Use first text column as the "title" field; show all other columns as fields
  const titleCol = columns.find(c => c.type === 'text') || columns[0];
  const fieldCols = columns.filter(c => c.id !== titleCol?.id);

  const expandedRow = expandedRowId ? rows.find(r => r.id === expandedRowId) : null;

  return (
    <div className={s.gallery}>
      {rows.map(row => {
        const title = row.cells?.[titleCol?.id] ?? defaultForType(titleCol?.type);
        return (
          <div
            key={row.id}
            className={s.card}
            onClick={() => setExpandedRowId(row.id)}
          >
            <div className={s.cardTitle}>{title || 'Untitled'}</div>
            {fieldCols.map(col => {
              const val = row.cells?.[col.id] ?? defaultForType(col.type);
              // Skip empty values
              if (val === null || val === undefined || val === '' || (Array.isArray(val) && !val.length)) return null;
              return (
                <div key={col.id} className={s.field}>
                  <span className={s.fieldLabel}>{col.name}</span>
                  <span className={s.fieldValue}>
                    <FieldValue value={val} column={col} />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      {expandedRow && (
        <RowDetailModal
          row={expandedRow}
          titleCol={titleCol}
          columns={columns}
          onClose={() => setExpandedRowId(null)}
        />
      )}
    </div>
  );
}

/* ── Card field value renderer ─────────────── */
function FieldValue({ value, column }) {
  const v = value ?? defaultForType(column.type);

  switch (column.type) {
    case 'text':
    case 'rich_text':
      return v || '';

    case 'number':
      return <span className={s.cardNumber}>{v ?? ''}</span>;

    case 'checkbox':
      return <span className={s.cardCheck}>{v ? '☑' : '☐'}</span>;

    case 'select': {
      if (!v) return null;
      const opt = (column.options || []).find(o => o.id === v);
      return opt ? <TagChip label={opt.label} color={opt.color} small /> : <span>{v}</span>;
    }

    case 'multi_select': {
      const ids = Array.isArray(v) ? v : [];
      return (
        <span className={s.cardTags}>
          {ids.map(id => {
            const opt = (column.options || []).find(o => o.id === id);
            return opt ? <TagChip key={id} label={opt.label} color={opt.color} small /> : null;
          })}
        </span>
      );
    }

    case 'date':
    case 'datetime':
      return <span className={s.cardDate}>{v || ''}</span>;

    case 'url':
      return v ? <a href={v} target="_blank" rel="noopener noreferrer">{v}</a> : null;

    case 'rating':
      return <StarRating value={v} />;

    case 'image':
      return v ? <img src={v} alt="" className={s.cardImage} /> : null;

    case 'letter_grade':
      return <GradeBadge grade={v} small />;

    default:
      return typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  }
}
