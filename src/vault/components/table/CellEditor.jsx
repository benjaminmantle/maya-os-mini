import { useState, useRef, useEffect } from 'react';
import StarRating from '../shared/StarRating.jsx';
import GradeBadge from '../shared/GradeBadge.jsx';
import { defaultForType, GRADE_SCALE, gradeColor } from '../../store/vaultStore.js';
import s from '../../styles/TableGrid.module.css';

export default function CellEditor({ value, column, onSave, onCancel }) {
  const v = value ?? defaultForType(column.type);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) inputRef.current.select();
    }
  }, []);

  const commit = (val) => { onSave(val); };

  switch (column.type) {
    case 'text':
    case 'rich_text':
      return (
        <input
          ref={inputRef}
          className={s.editInput}
          defaultValue={v}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value); if (e.key === 'Escape') onCancel(); }}
        />
      );

    case 'number':
      return (
        <input
          ref={inputRef}
          type="number"
          className={s.editInput}
          defaultValue={v ?? ''}
          onBlur={e => commit(e.target.value === '' ? null : Number(e.target.value))}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value === '' ? null : Number(e.target.value)); if (e.key === 'Escape') onCancel(); }}
        />
      );

    case 'checkbox':
      // Checkbox toggles immediately — no editor needed
      return null;

    case 'select':
      return <SelectEditor value={v} options={column.options || []} onSave={commit} onCancel={onCancel} />;

    case 'multi_select':
      return <MultiSelectEditor value={Array.isArray(v) ? v : []} options={column.options || []} onSave={commit} onCancel={onCancel} />;

    case 'date':
      return (
        <input
          ref={inputRef}
          type="date"
          className={s.editInput}
          defaultValue={v || ''}
          onBlur={e => commit(e.target.value || null)}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value || null); if (e.key === 'Escape') onCancel(); }}
        />
      );

    case 'url':
      return (
        <input
          ref={inputRef}
          type="url"
          className={s.editInput}
          defaultValue={v}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value); if (e.key === 'Escape') onCancel(); }}
        />
      );

    case 'rating':
      return <StarRating value={v} onChange={val => commit(val)} />;

    case 'letter_grade':
      return <GradeEditor value={v} onSave={commit} onCancel={onCancel} />;

    default:
      return (
        <input
          ref={inputRef}
          className={s.editInput}
          defaultValue={typeof v === 'string' ? v : ''}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value); if (e.key === 'Escape') onCancel(); }}
        />
      );
  }
}

function SelectEditor({ value, options, onSave, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  return (
    <div ref={ref} className={s.selectDropdown}>
      {options.map(opt => (
        <button
          key={opt.id}
          className={`${s.selectOption} ${value === opt.id ? s.selectActive : ''}`}
          onClick={() => onSave(value === opt.id ? null : opt.id)}
        >
          <span
            className={s.selectDot}
            style={{ background: `var(--${opt.color || 'slv'})` }}
          />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MultiSelectEditor({ value, options, onSave, onCancel }) {
  const [selected, setSelected] = useState(value);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onSave(selected);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selected, onSave, onCancel]);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(next);
  };

  return (
    <div ref={ref} className={s.selectDropdown}>
      {options.map(opt => (
        <button
          key={opt.id}
          className={`${s.selectOption} ${selected.includes(opt.id) ? s.selectActive : ''}`}
          onClick={() => toggle(opt.id)}
        >
          <span className={s.selectCheck}>{selected.includes(opt.id) ? '☑' : '☐'}</span>
          <span
            className={s.selectDot}
            style={{ background: `var(--${opt.color || 'slv'})` }}
          />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function GradeEditor({ value, onSave, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  return (
    <div ref={ref} className={s.selectDropdown}>
      {GRADE_SCALE.map(grade => (
        <button
          key={grade}
          className={`${s.selectOption} ${value === grade ? s.selectActive : ''}`}
          onClick={() => onSave(value === grade ? null : grade)}
        >
          <span
            className={s.selectDot}
            style={{ background: `var(--${gradeColor(grade)})` }}
          />
          <GradeBadge grade={grade} small />
        </button>
      ))}
    </div>
  );
}
