import { useEffect, useRef } from 'react';
import styles from '../../styles/components/Modals.module.css';

export default function ContextMenu({ visible, x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className={styles.ctxMenu}
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className={styles.ctxSep} />;
        return (
          <button
            key={i}
            className={[
              styles.ctxItem,
              item.start ? styles.ctxItemStart : '',
              item.danger ? styles.ctxItemDanger : '',
              item.active ? styles.ctxItemActive : '',
            ].filter(Boolean).join(' ')}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
