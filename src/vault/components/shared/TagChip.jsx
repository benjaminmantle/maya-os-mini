import s from '../../styles/TagChip.module.css';

export default function TagChip({ label, color = 'slv', onClick, small }) {
  return (
    <span
      className={`${s.chip} ${small ? s.small : ''}`}
      style={{
        background: `color-mix(in srgb, var(--${color}) 18%, transparent)`,
        border: `1px solid color-mix(in srgb, var(--${color}) 45%, transparent)`,
        color: `var(--${color})`,
      }}
      onClick={onClick}
    >
      {label}
    </span>
  );
}
