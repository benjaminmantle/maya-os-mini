import styles from '../../styles/components/Sidebar.module.css';
import tStyles from '../../styles/components/TaskCard.module.css';

export default function DailyItem({ daily, index, total, done, color, onToggle, onEdit, onDelete, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd }) {
  return (
    <div
      className={`${styles.dailyItem} ${done ? styles.dailyItemDone : ''}`}
      draggable="true"
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(daily.id); e.target.style.opacity = '0.3'; }}
      onDragEnd={(e) => { e.target.style.opacity = ''; onDragEnd(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(daily.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(daily.id); }}
      onContextMenu={onContextMenu}
    >
      <span
        className={styles.dDot}
        style={{ background: color, boxShadow: `0 0 5px ${color}88` }}
        onClick={onToggle}
      />
      <span className={`${styles.dName} ${done ? styles.dailyItemDoneName : ''}`} onClick={onToggle}>
        {daily.name}
      </span>
      {done && <span className={styles.dChk}>✓</span>}
      <span className={styles.dActions}>
        <button className={tStyles.iconBtn} onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">✎</button>
        <button className={`${tStyles.iconBtn} ${tStyles.del}`} onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">✕</button>
      </span>
    </div>
  );
}
