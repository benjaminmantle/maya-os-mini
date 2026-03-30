import { useState, useEffect, useRef } from 'react';
import ColorPicker from './ColorPicker.jsx';
import s from '../styles/ContextMenu.module.css';

export default function ContextMenu({
  x, y, elementIds, elements, onClose,
  onStyleChange, onArrange, onGroup, onUngroup, canUngroup,
  onDuplicate, onCopy, onPaste, canPaste, onDelete,
  onSelectAll, onZoomToFit, onExportSelection, onExportBoard,
}) {
  const [colorPicker, setColorPicker] = useState(null); // { x, y, prop, value }
  const menuRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasElements = elementIds && elementIds.length > 0;
  const multiSelect = elementIds && elementIds.length > 1;

  // get common style from first selected element
  const firstEl = hasElements ? elements.find(e => e.id === elementIds[0]) : null;

  const handleColorOpen = (prop, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setColorPicker({
      x: rect.right + 4,
      y: rect.top,
      prop,
      value: firstEl ? firstEl[prop] : '#ddd9d6',
    });
  };

  const handleColorChange = (color) => {
    if (colorPicker) {
      onStyleChange(colorPicker.prop, color);
    }
  };

  const Item = ({ label, shortcut, onClick, disabled }) => (
    <button className={s.menuItem} onClick={() => { onClick(); onClose(); }} disabled={disabled}>
      {label}
      {shortcut && <span className={s.shortcut}>{shortcut}</span>}
    </button>
  );

  return (
    <>
      <div className={s.overlay} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div ref={menuRef} className={s.menu} style={{ left: x, top: y }}>
        {hasElements ? (
          <>
            {/* Style controls */}
            <div className={s.styleRow}>
              <span className={s.styleLabel}>Stroke</span>
              <div
                className={s.colorSwatch}
                style={{ background: firstEl?.strokeColor || '#ddd9d6' }}
                onClick={(e) => handleColorOpen('strokeColor', e)}
              />
            </div>
            <div className={s.styleRow}>
              <span className={s.styleLabel}>Fill</span>
              <div
                className={s.colorSwatch}
                style={
                  firstEl?.fillColor === 'transparent'
                    ? { background: 'repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 50% / 8px 8px' }
                    : { background: firstEl?.fillColor || 'transparent' }
                }
                onClick={(e) => handleColorOpen('fillColor', e)}
              />
            </div>
            <div className={s.styleRow}>
              <span className={s.styleLabel}>Width</span>
              <input
                type="range"
                className={s.widthSlider}
                min={1} max={8} step={1}
                value={firstEl?.strokeWidth || 2}
                onChange={(e) => onStyleChange('strokeWidth', Number(e.target.value))}
              />
            </div>
            <div className={s.sep} />

            {/* Arrange */}
            <Item label="Bring Forward" shortcut="]" onClick={() => onArrange('forward')} />
            <Item label="Send Backward" shortcut="[" onClick={() => onArrange('backward')} />
            <Item label="Bring to Front" shortcut="Ctrl+]" onClick={() => onArrange('front')} />
            <Item label="Send to Back" shortcut="Ctrl+[" onClick={() => onArrange('back')} />
            <div className={s.sep} />

            {/* Group */}
            {multiSelect && <Item label="Group" shortcut="Ctrl+G" onClick={onGroup} />}
            {canUngroup && <Item label="Ungroup" shortcut="Ctrl+Shift+G" onClick={onUngroup} />}
            {(multiSelect || canUngroup) && <div className={s.sep} />}

            {/* Actions */}
            <Item label="Duplicate" shortcut="Ctrl+D" onClick={onDuplicate} />
            <Item label="Copy" shortcut="Ctrl+C" onClick={onCopy} />
            <Item label="Delete" shortcut="Del" onClick={onDelete} />
            <div className={s.sep} />
            <Item label="Export Selection as PNG" onClick={onExportSelection} />
            <Item label="Export Board as PNG" onClick={onExportBoard} />
          </>
        ) : (
          <>
            <Item label="Paste" shortcut="Ctrl+V" onClick={onPaste} disabled={!canPaste} />
            <div className={s.sep} />
            <Item label="Select All" shortcut="Ctrl+A" onClick={onSelectAll} />
            <Item label="Zoom to Fit" shortcut="Ctrl+0" onClick={onZoomToFit} />
            <div className={s.sep} />
            <Item label="Export Board as PNG" onClick={onExportBoard} />
          </>
        )}
      </div>

      {colorPicker && (
        <ColorPicker
          x={colorPicker.x}
          y={colorPicker.y}
          value={colorPicker.value}
          onChange={handleColorChange}
          onClose={() => setColorPicker(null)}
        />
      )}
    </>
  );
}
