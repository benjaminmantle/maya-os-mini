import { useState, useRef, useEffect } from 'react';
import { COLOR_PALETTE } from '../core/constants.js';
import s from '../styles/ContextMenu.module.css';

export default function ColorPicker({ x, y, value, onChange, onClose }) {
  const [hex, setHex] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  const handleSelect = (color) => {
    onChange(color);
    onClose();
  };

  const handleHex = (e) => {
    const v = e.target.value;
    setHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v) || v === 'transparent') {
      onChange(v);
    }
  };

  const handleHexKey = (e) => {
    if (e.key === 'Enter') onClose();
    e.stopPropagation();
  };

  return (
    <div ref={ref} className={s.colorPicker} style={{ left: x, top: y }}>
      <div className={s.colorGrid}>
        {COLOR_PALETTE.map(c => (
          <div
            key={c}
            className={`${s.paletteSwatch} ${c === value ? s.activeSwatch : ''} ${c === 'transparent' ? s.transparentSwatch : ''}`}
            style={c !== 'transparent' ? { background: c } : undefined}
            onClick={() => handleSelect(c)}
          />
        ))}
      </div>
      <input
        className={s.hexInput}
        value={hex}
        onChange={handleHex}
        onKeyDown={handleHexKey}
        placeholder="#hex or transparent"
      />
    </div>
  );
}
