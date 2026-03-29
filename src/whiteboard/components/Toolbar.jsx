import { TOOL_IDS } from '../core/constants.js';
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

export default function Toolbar({ activeTool, setActiveTool, onUndo, onRedo }) {
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
    </div>
  );
}
