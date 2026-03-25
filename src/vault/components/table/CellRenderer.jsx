import TagChip from '../shared/TagChip.jsx';
import StarRating from '../shared/StarRating.jsx';
import GradeBadge from '../shared/GradeBadge.jsx';
import { defaultForType, getRelationsSync, getRowName } from '../../store/vaultStore.js';
import s from '../../styles/TableGrid.module.css';

export default function CellRenderer({ value, column, rowId, sectionId }) {
  const v = value ?? defaultForType(column.type);

  switch (column.type) {
    case 'text':
    case 'rich_text':
      return <span className={s.cellText}>{v || ''}</span>;

    case 'number':
      return <span className={s.cellNumber}>{v ?? ''}</span>;

    case 'checkbox':
      return <span className={s.cellCheck}>{v ? '☑' : '☐'}</span>;

    case 'select': {
      if (!v) return null;
      const opt = (column.options || []).find(o => o.id === v);
      return opt ? <TagChip label={opt.label} color={opt.color} small /> : <span>{v}</span>;
    }

    case 'multi_select': {
      const ids = Array.isArray(v) ? v : [];
      return (
        <span className={s.cellTags}>
          {ids.map(id => {
            const opt = (column.options || []).find(o => o.id === id);
            return opt ? <TagChip key={id} label={opt.label} color={opt.color} small /> : null;
          })}
        </span>
      );
    }

    case 'date':
    case 'datetime':
      return <span className={s.cellDate}>{v || ''}</span>;

    case 'url':
      return v ? <a href={v} target="_blank" rel="noopener noreferrer" className={s.cellUrl}>{v}</a> : null;

    case 'rating':
      return <StarRating value={v} />;

    case 'image':
      return v ? <img src={v} alt="" className={s.cellImage} /> : null;

    case 'letter_grade':
      return <GradeBadge grade={v} small />;

    case 'relation': {
      if (!rowId) return null;
      const targetIds = getRelationsSync(rowId, column.id);
      if (!targetIds.length) return <span className={s.cellText} style={{ color: 'var(--t3)', fontSize: '0.75rem' }}>—</span>;
      return (
        <span className={s.cellTags}>
          {targetIds.map(tid => (
            <TagChip key={tid} label={getRowName(tid)} color="slv" small />
          ))}
        </span>
      );
    }

    default:
      return <span>{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}</span>;
  }
}
