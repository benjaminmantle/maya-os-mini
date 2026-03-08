import { useState, useEffect, useCallback } from 'react';

export function useContextMenu() {
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, data: null });

  const show = useCallback((x, y, data) => {
    setMenu({
      visible: true,
      x: Math.min(x, window.innerWidth - 150),
      y: Math.min(y, window.innerHeight - 120),
      data,
    });
  }, []);

  const hide = useCallback(() => {
    setMenu(m => ({ ...m, visible: false, data: null }));
  }, []);

  useEffect(() => {
    const handler = () => hide();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [hide]);

  return { menu, show, hide };
}
