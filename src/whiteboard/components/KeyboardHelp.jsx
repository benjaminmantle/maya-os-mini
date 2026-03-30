import s from '../styles/KeyboardHelp.module.css';

const SHORTCUTS = [
  ['Tools', [
    ['V', 'Select'],
    ['R', 'Rectangle'],
    ['E', 'Ellipse'],
    ['L', 'Line'],
    ['A', 'Arrow'],
    ['D', 'Freehand'],
    ['T', 'Text'],
  ]],
  ['Actions', [
    ['Ctrl+Z', 'Undo'],
    ['Ctrl+Shift+Z', 'Redo'],
    ['Del / Backspace', 'Delete selected'],
    ['Ctrl+C', 'Copy'],
    ['Ctrl+V', 'Paste'],
    ['Ctrl+D', 'Duplicate'],
    ['Ctrl+A', 'Select all'],
    ['Escape', 'Deselect / cancel'],
  ]],
  ['View', [
    ['Scroll wheel', 'Zoom'],
    ['Middle-click drag', 'Pan'],
    ['Space + drag', 'Pan'],
    ['Ctrl+ +/\u2212', 'Zoom in/out'],
    ['Ctrl+1', 'Reset zoom 100%'],
    ['Ctrl+0', 'Zoom to fit'],
  ]],
  ['Arrange', [
    [']', 'Bring forward'],
    ['[', 'Send backward'],
    ['Ctrl+]', 'Bring to front'],
    ['Ctrl+[', 'Send to back'],
    ['Ctrl+G', 'Group'],
    ['Ctrl+Shift+G', 'Ungroup'],
  ]],
  ['Other', [
    ['Shift (shapes)', 'Constrain proportions'],
    ['Alt (shapes)', 'Draw from center'],
    ['Shift (lines)', 'Snap to 45\u00b0'],
    ['Ctrl+Shift+E', 'Export as PNG'],
    ['Right-click', 'Context menu'],
    ['?', 'This help'],
  ]],
];

export default function KeyboardHelp({ onClose }) {
  return (
    <>
      <div className={s.overlay} onClick={onClose} />
      <div className={s.panel}>
        <div className={s.title}>Keyboard Shortcuts</div>
        <div className={s.grid}>
          {SHORTCUTS.map(([group, items]) => (
            <div key={group} className={s.group}>
              <div className={s.groupTitle}>{group}</div>
              {items.map(([key, desc]) => (
                <div key={key} className={s.row}>
                  <kbd className={s.key}>{key}</kbd>
                  <span className={s.desc}>{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={s.footer}>Press ? or Escape to close</div>
      </div>
    </>
  );
}
