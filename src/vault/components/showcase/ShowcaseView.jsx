import { useState } from 'react';
import { getShowcase } from './ShowcaseRegistry.js';
import { defaultForType } from '../../store/vaultStore.js';
import s from '../../styles/ShowcaseView.module.css';

export default function ShowcaseView({ rows, columns, templateKey }) {
  const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id || null);
  const Template = getShowcase(templateKey);

  if (!Template) return <div className={s.empty}>Template not found: {templateKey}</div>;

  // Find the first text column for names
  const nameCol = columns.find(c => c.type === 'text') || columns[0];
  const selectedRow = rows.find(r => r.id === selectedRowId) || rows[0];

  return (
    <div className={s.showcaseLayout}>
      <div className={s.nameList}>
        {rows.map(row => {
          const name = row.cells?.[nameCol?.id] ?? defaultForType(nameCol?.type);
          return (
            <button
              key={row.id}
              className={`${s.nameItem} ${row.id === selectedRowId ? s.nameItemActive : ''}`}
              onClick={() => setSelectedRowId(row.id)}
            >
              {name || 'Untitled'}
            </button>
          );
        })}
      </div>
      <div className={s.showcaseContent}>
        {selectedRow ? (
          <Template row={selectedRow} columns={columns} />
        ) : (
          <div className={s.empty}>Select a character</div>
        )}
      </div>
    </div>
  );
}
