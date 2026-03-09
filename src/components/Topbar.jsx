import { useState, useRef, useEffect } from 'react';
import styles from '../styles/components/Topbar.module.css';
import { TITLES } from '../utils/scoring.js';

const THEMES = [
  { id: 'dark',    label: 'Dark',     dot: '#191817' },
  { id: 'dim',     label: 'Dim',      dot: '#2a2825' },
  { id: 'light',   label: 'Lavender', dot: '#ece8f8' },
  { id: 'vanilla', label: 'Vanilla',  dot: '#f3ede0' },
  { id: 'white',   label: 'White',    dot: '#f6f5f3' },
];

export default function Topbar({ profile, theme, onThemeSet }) {
  const level = profile.level || 1;
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)];
  const momentum = profile.momentum || 'stable';
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

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
      <div className={styles.themePicker} ref={pickerRef}>
        <button className={styles.themeBtn} onClick={() => setOpen(o => !o)}>
          SKIN
        </button>
        {open && (
          <div className={styles.themeMenu}>
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`${styles.themeOpt}${theme === t.id ? ' ' + styles.themeOptActive : ''}`}
                onClick={() => { onThemeSet(t.id); setOpen(false); }}
              >
                <span className={styles.themeDot} style={{ background: t.dot }} />
                <span>{t.label}</span>
                {theme === t.id && <span className={styles.themeCheck}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
