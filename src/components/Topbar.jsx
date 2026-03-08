import styles from '../styles/components/Topbar.module.css';
import { TITLES } from '../utils/scoring.js';

export default function Topbar({ profile, theme, onThemeToggle }) {
  const level = profile.level || 1;
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)];
  const momentum = profile.momentum || 'stable';

  return (
    <div className={styles.topbar}>
      <div className={styles.logo}>Maya <em className={styles.logoAccent}>OS</em> Mini</div>
      <div className={styles.spacer} />
      <div className={`${styles.chip} ${styles.momentumChip}`}>
        <span className={`${styles.chipDot} ${styles[momentum]}`} />
        <span>{momentum[0].toUpperCase() + momentum.slice(1)}</span>
      </div>
      <div className={styles.chip}>
        <span>🔥</span>
        <span>{profile.streak || 0}</span>
      </div>
      <div className={styles.chip}>
        <span className={styles.lvBadge}>{level}</span>
        <span className={styles.lvTitle}>{title}</span>
      </div>
      <button
        className={styles.themeBtn}
        onClick={onThemeToggle}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  );
}
