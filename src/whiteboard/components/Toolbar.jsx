import { useState } from 'react';
import { TOOL_IDS, COLOR_PALETTE } from '../core/constants.js';
import { canUndo, canRedo } from '../core/history.js';
import s from '../styles/Toolbar.module.css';

const TOOLS = [
  { id: TOOL_IDS.SELECT,   icon: '↖', key: 'V', label: 'Select' },
  { id: TOOL_IDS.RECT,     icon: '□', key: 'R', label: 'Rectangle' },
  { id: TOOL_IDS.ELLIPSE,  icon: '○', key: 'E', label: 'Ellipse' },
  { id: TOOL_IDS.LINE,     icon: '╱', key: 'L', label: 'Line' },
  { id: TOOL_IDS.ARROW,    icon: '→', key: 'A', label: 'Arrow' },
  { id: TOOL_IDS.FREEHAND, icon: '✎', key: 'D', label: 'Freehand' },
  { id: TOOL_IDS.TEXT,     icon: 'T', key: 'T', label: 'Text' },
];

export default function Toolbar({
  activeTool, setActiveTool, onUndo, onRedo,
  strokeColor, fillColor, strokeWidth, onStrokeChange, onFillChange, onStrokeWidthChange,
  onClearBoard,
}) {
  const [strokeOpen, setStrokeOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);

  return (
    <div className={s.toolbar}>
      {TOOLS.map(t => (
        <button
          key={t.id}
          className={`${s.toolBtn} ${activeTool === t.id ? s.active : ''}`}
          onClick={() => setActiveTool(t.id)}
          title={`${t.label} (${t.key})`}
        >
          {t.icon}
          <span className={s.hint}>{t.label} ({t.key})</span>
        </button>
      ))}

      <div className={s.sep} />

      {/* Stroke color */}
      <div className={s.colorRow}>
        <div
          className={s.swatchBtn}
          style={{ background: strokeColor || '#ddd9d6' }}
          title="Stroke color"
          onClick={() => { setStrokeOpen(o => !o); setFillOpen(false); }}
        />
        {/* Fill color */}
        <div
          className={`${s.swatchBtn} ${(!fillColor || fillColor === 'transparent') ? s.swatchTransparent : ''}`}
          style={fillColor && fillColor !== 'transparent' ? { background: fillColor } : undefined}
          title="Fill color"
          onClick={() => { setFillOpen(o => !o); setStrokeOpen(false); }}
        />
      </div>

      {/* Stroke width */}
      <div className={s.widthRow}>
        <input
          type="range"
          className={s.widthSlider}
          min={1} max={12} step={1}
          value={strokeWidth || 2}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          title={`Stroke width: ${strokeWidth || 2}px`}
        />
      </div>

      {/* Inline palette dropdown */}
      {strokeOpen && (
        <div className={s.paletteDropdown}>
          {COLOR_PALETTE.filter(c => c !== 'transparent').map(c => (
            <div
              key={c}
              className={`${s.palDot} ${c === strokeColor ? s.palDotActive : ''}`}
              style={{ background: c }}
              onClick={() => { onStrokeChange(c); setStrokeOpen(false); }}
            />
          ))}
        </div>
      )}
      {fillOpen && (
        <div className={s.paletteDropdown}>
          {COLOR_PALETTE.map(c => (
            <div
              key={c}
              className={`${s.palDot} ${c === fillColor ? s.palDotActive : ''} ${c === 'transparent' ? s.palDotTransparent : ''}`}
              style={c !== 'transparent' ? { background: c } : undefined}
              title={c === 'transparent' ? 'No fill' : c}
              onClick={() => { onFillChange(c); setFillOpen(false); }}
            />
          ))}
        </div>
      )}

      <div className={s.sep} />

      <button
        className={s.toolBtn}
        onClick={onUndo}
        disabled={!canUndo()}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        className={s.toolBtn}
        onClick={onRedo}
        disabled={!canRedo()}
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪
      </button>

      <div className={s.sep} />

      <button
        className={s.toolBtn}
        onClick={onClearBoard}
        title="Clear board"
        style={{ fontSize: 13 }}
      >
        🗑
      </button>
    </div>
  );
}
