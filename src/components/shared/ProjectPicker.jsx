import { useState, useRef, useEffect } from 'react';
import { getProjects, addProject, editProject, deleteProject, setProjectColor } from '../../store/store.js';
import { applyEmDash } from '../../utils/parsing.js';

// Row 1 L→R: red → warm pinks → purple  |  Row 2 reversed (snake R←L): indigo → blues → greens → lime  |  Row 3 L→R: yellow → orange → warm neutrals
const PICKER_COLORS = [
  'red','hot','crl','pnk','lpnk','mgn','pri-maya','pur',
  'lim','lgrn','grn','pri-idea','tel','blu','pri-ai','ind',
  'yel','gold','pri-md','ora','ora2','brn','gry','slv',
];

/**
 * Universal project picker dropdown.
 * Shows all projects, allows select/edit/delete/color-change/create-new.
 *
 * Props:
 *   current    — current project name (string|null)
 *   onSelect   — (projectName|null) => void
 *   onClose    — () => void
 *   anchorRect — { left, top, bottom, right } from getBoundingClientRect(), used for positioning
 */
export default function ProjectPicker({ current, onSelect, onClose, anchorRect }) {
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editVal, setEditVal] = useState('');
  const [colorPickIdx, setColorPickIdx] = useState(-1);
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('slv');
  const [newColorOpen, setNewColorOpen] = useState(false);
  const ref = useRef(null);

  const projects = getProjects();

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function handleSelect(name) {
    onSelect(name === current ? null : name);
    onClose();
  }

  function handleNone() {
    onSelect(null);
    onClose();
  }

  function handleEditStart(idx) {
    setEditingIdx(idx);
    setEditVal(projects[idx].name);
    setColorPickIdx(-1);
  }

  function handleEditSave() {
    if (editingIdx === -1) return;
    const oldName = projects[editingIdx].name;
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== oldName) editProject(oldName, trimmed);
    setEditingIdx(-1);
  }

  function handleDelete(idx) {
    const name = projects[idx].name;
    deleteProject(name);
    if (current && current.toLowerCase() === name.toLowerCase()) onSelect(null);
    setEditingIdx(-1);
    setColorPickIdx(-1);
  }

  function handleColorSelect(name, c) {
    setProjectColor(name, c);
    setColorPickIdx(-1);
  }

  function handleCreateNew() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (addProject(trimmed, newColor)) {
      onSelect(trimmed);
      onClose();
    }
    setNewName('');
    setNewColor('slv');
    setNewMode(false);
    setNewColorOpen(false);
  }

  // Position: below anchor, clamped to viewport
  const style = {};
  if (anchorRect) {
    style.position = 'fixed';
    style.left = Math.min(anchorRect.left, window.innerWidth - 180);
    style.top = Math.min(anchorRect.bottom + 2, window.innerHeight - 300);
  } else {
    style.position = 'absolute';
    style.top = '100%';
    style.left = 0;
  }

  const dropStyle = {
    ...style,
    zIndex: 200,
    minWidth: 160,
    maxHeight: 280,
    overflowY: 'auto',
    background: 'var(--s1)',
    border: '1px solid var(--b2)',
    borderRadius: 'var(--rs)',
    boxShadow: '0 4px 16px rgba(0,0,0,.35)',
    padding: '4px 0',
    fontSize: 11,
    fontFamily: 'var(--f)',
  };

  const itemStyle = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 8px', cursor: 'pointer',
    transition: 'background 100ms ease',
    flexWrap: 'wrap',
  };

  const dotStyle = (color) => ({
    width: 8, height: 8, borderRadius: 2, flexShrink: 0,
    background: `var(--${color || 'slv'})`, cursor: 'pointer',
  });

  const chipBg = (color) => `color-mix(in srgb, var(--${color || 'slv'}) 72%, #000)`;

  return (
    <div ref={ref} style={dropStyle} onClick={e => e.stopPropagation()}>
      {/* None option */}
      {current && (
        <div
          style={{ ...itemStyle, color: 'var(--t3)', fontStyle: 'italic' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
          onMouseLeave={e => e.currentTarget.style.background = ''}
          onClick={handleNone}
        >
          None
        </div>
      )}

      {/* Project list */}
      {projects.map((p, idx) => (
        <div key={p.name}>
          <div
            style={{
              ...itemStyle,
              background: current && current.toLowerCase() === p.name.toLowerCase() ? 'var(--s2)' : '',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
            onMouseLeave={e => e.currentTarget.style.background = current && current.toLowerCase() === p.name.toLowerCase() ? 'var(--s2)' : ''}
          >
            {editingIdx === idx ? (
              <input
                style={{ flex: 1, fontSize: 11, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--s2)', border: '1px solid var(--gold)', borderRadius: 2, padding: '2px 6px', outline: 'none' }}
                value={editVal}
                onChange={e => setEditVal(applyEmDash(e.target.value))}
                onBlur={handleEditSave}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEditSave(); } if (e.key === 'Escape') setEditingIdx(-1); }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <span style={dotStyle(p.color)} onClick={e => { e.stopPropagation(); setColorPickIdx(colorPickIdx === idx ? -1 : idx); }} title="Change color" />
                <span
                  style={{ flex: 1, color: '#fff', padding: '1px 6px', borderRadius: 2, background: chipBg(p.color), cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '.3px' }}
                  onClick={() => handleSelect(p.name)}
                >
                  {p.name}
                </span>
                <span style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 12, padding: '1px 3px' }} onClick={e => { e.stopPropagation(); handleEditStart(idx); }} title="Edit">&#9998;</button>
                  <button style={{ background: 'transparent', border: 'none', color: 'rgba(255,48,96,.6)', cursor: 'pointer', fontSize: 14, padding: '1px 3px' }} onClick={e => { e.stopPropagation(); handleDelete(idx); }} title="Delete">&times;</button>
                </span>
              </>
            )}
          </div>
          {colorPickIdx === idx && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 14px)', gap: 3, padding: '4px 8px 4px 22px' }}>
              {PICKER_COLORS.map(c => (
                <span
                  key={c}
                  style={{
                    width: 14, height: 14, borderRadius: p.color === c ? 3 : 2,
                    cursor: 'pointer', background: `var(--${c})`,
                    outline: p.color === c ? '2px solid var(--gold)' : 'none',
                    outlineOffset: 1,
                    boxShadow: p.color === c ? '0 0 8px var(--gold)' : 'none',
                    transition: 'transform 100ms ease',
                  }}
                  onMouseEnter={e => { if (p.color !== c) e.target.style.transform = 'scale(1.3)'; }}
                  onMouseLeave={e => { e.target.style.transform = ''; }}
                  onClick={e => { e.stopPropagation(); handleColorSelect(p.name, c); }}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--b1)', margin: '4px 0' }} />

      {/* Create new */}
      {newMode ? (
        <div style={{ padding: '6px 8px' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ position: 'relative', flexShrink: 0 }}>
              <span
                style={{ width: 14, height: 14, borderRadius: 2, background: `var(--${newColor})`, cursor: 'pointer', display: 'block', border: '1px solid rgba(255,255,255,.15)' }}
                onClick={() => setNewColorOpen(o => !o)}
                title="Pick color"
              />
              {newColorOpen && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 300, background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 'var(--rs)', padding: 5, display: 'grid', gridTemplateColumns: 'repeat(8, 14px)', gap: 3, boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}>
                  {PICKER_COLORS.map(c => (
                    <span
                      key={c}
                      style={{
                        width: 14, height: 14, borderRadius: newColor === c ? 3 : 2,
                        cursor: 'pointer', background: `var(--${c})`,
                        outline: newColor === c ? '2px solid var(--gold)' : 'none',
                        outlineOffset: 1,
                        transition: 'transform 100ms ease',
                      }}
                      onMouseEnter={e => { if (newColor !== c) e.target.style.transform = 'scale(1.3)'; }}
                      onMouseLeave={e => { e.target.style.transform = ''; }}
                      onClick={() => { setNewColor(c); setNewColorOpen(false); }}
                    />
                  ))}
                </div>
              )}
            </span>
            <input
              style={{ flex: 1, fontSize: 11, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 2, padding: '3px 6px', outline: 'none' }}
              value={newName}
              onChange={e => setNewName(applyEmDash(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateNew(); if (e.key === 'Escape') { setNewMode(false); setNewColorOpen(false); } }}
              placeholder="New project..."
              autoFocus
            />
            <button
              style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--fd)', padding: '3px 8px', borderRadius: 2, background: 'var(--s3)', border: '1px solid var(--b2)', color: 'var(--text)', cursor: 'pointer' }}
              onClick={handleCreateNew}
            >Add</button>
          </div>
        </div>
      ) : (
        <div
          style={{ ...itemStyle, color: 'var(--t3)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
          onMouseLeave={e => e.currentTarget.style.background = ''}
          onClick={() => setNewMode(true)}
        >
          + New project
        </div>
      )}
    </div>
  );
}
