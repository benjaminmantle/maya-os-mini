import s from '../../styles/StarRating.module.css';

export default function StarRating({ value = 0, max = 5, onChange }) {
  const editable = !!onChange;
  return (
    <span className={s.stars}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < (value || 0);
        return (
          <span
            key={i}
            className={`${s.star} ${filled ? s.filled : s.empty} ${editable ? s.editable : ''}`}
            onClick={editable ? () => onChange(value === i + 1 ? null : i + 1) : undefined}
          >
            ★
          </span>
        );
      })}
    </span>
  );
}
