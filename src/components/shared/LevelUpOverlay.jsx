import styles from '../../styles/components/Modals.module.css';
import { TITLES } from '../../utils/scoring.js';

export default function LevelUpOverlay({ level, onDismiss }) {
  if (!level) return null;
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)];

  return (
    <div className={styles.lvlOverlay} onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}>
      <div className={styles.lvlCard}>
        <div className={styles.lvlGlyph}>✦ ✦ ✦</div>
        <div className={styles.lvlTag}>Level Up</div>
        <div className={styles.lvlNum}>{level}</div>
        <div className={styles.lvlTitleTxt}>{title}</div>
        <div className={styles.lvlDismiss} onClick={onDismiss}>tap to continue</div>
      </div>
    </div>
  );
}
