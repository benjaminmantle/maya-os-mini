import { gradeColor } from '../../store/vaultStore.js';
import s from '../../styles/GradeBadge.module.css';

export default function GradeBadge({ grade, small }) {
  if (!grade) return null;
  const color = gradeColor(grade);
  return (
    <span
      className={`${s.badge} ${small ? s.small : ''}`}
      style={{
        background: `color-mix(in srgb, var(--${color}) 18%, transparent)`,
        border: `1px solid color-mix(in srgb, var(--${color}) 45%, transparent)`,
        color: `var(--${color})`,
      }}
    >
      {grade}
    </span>
  );
}
