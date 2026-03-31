import { useEffect, useLayoutEffect, useRef } from 'react';
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

  // Clamp to viewport so the menu is never cut off at edges or bottom
  useLayoutEffect(() => {
    if (!visible || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pad = 8;
    if (rect.right > window.innerWidth - pad)
      ref.current.style.left = Math.max(pad, window.innerWidth - rect.width - pad) + 'px';
    if (rect.bottom > window.innerHeight - pad)
      ref.current.style.top = Math.max(pad, window.innerHeight - rect.height - pad) + 'px';
  }, [visible, x, y]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className={styles.ctxMenu}
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className={styles.ctxSep} />;
        if (item.render) return <div key={i} className={styles.ctxCustom}>{item.render(onClose)}</div>;
        return (
          <button
            key={i}
            className={[
              styles.ctxItem,
              item.start ? styles.ctxItemStart : '',
              item.danger ? styles.ctxItemDanger : '',
              item.active ? styles.ctxItemActive : '',
            ].filter(Boolean).join(' ')}
            onClick={() => { item.action(); if (!item.noClose) onClose(); }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
