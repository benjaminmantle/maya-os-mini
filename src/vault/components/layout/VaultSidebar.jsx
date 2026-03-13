import { useState, useEffect, useRef } from 'react';
import { getSpaces, getPages, savePage, saveSpace, deletePage, deleteSpace } from '../../store/vaultStore.js';
import { useVault } from '../../hooks/useVault.js';
import s from '../../styles/VaultSidebar.module.css';

const SPACE_COLORS = ['gold', 'hot', 'grn', 'pur', 'blu', 'ora', 'tel', 'slv', 'pnk', 'lim', 'ind', 'brn', 'crl', 'yel'];

export default function VaultSidebar({ activePageId, onNavigate, style }) {
  const vault = useVault();
  const spaces = getSpaces();
  const [expanded, setExpanded] = useState(() => {
    // Expand all spaces by default
    const map = {};
    spaces.forEach(sp => map[sp.id] = true);
    return map;
  });
  const [expandedPages, setExpandedPages] = useState({});
  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [colorPickerSpaceId, setColorPickerSpaceId] = useState(null);
  const colorPickerRef = useRef(null);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerSpaceId) return;
    const handleClick = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setColorPickerSpaceId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPickerSpaceId]);

  // Re-expand new spaces
  useEffect(() => {
    setExpanded(prev => {
      const next = { ...prev };
      spaces.forEach(sp => { if (!(sp.id in next)) next[sp.id] = true; });
      return next;
    });
  }, [spaces.length]);

  const toggleSpace = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePage = (id) => {
    setExpandedPages(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Add space
  const commitAddSpace = () => {
    if (newSpaceName.trim()) {
      saveSpace({ name: newSpaceName.trim(), color: 'slv' });
    }
    setAddingSpace(false);
    setNewSpaceName('');
  };

  // Add page to space
  const handleAddPage = (spaceId, parentId = null) => {
    savePage({ space_id: spaceId, parent_id: parentId, name: 'Untitled' });
  };

  // Rename
  const startRename = (id, currentName) => {
    setRenamingId(id);
    setRenameVal(currentName);
  };

  const commitRename = (item, type) => {
    setRenamingId(null);
    const trimmed = renameVal.trim();
    if (!trimmed || trimmed === item.name) return;
    if (type === 'space') saveSpace({ ...item, name: trimmed });
    else savePage({ ...item, name: trimmed });
  };

  // Build page tree for a space
  const buildTree = (pages) => {
    const map = {};
    const roots = [];
    pages.forEach(p => map[p.id] = { ...p, children: [] });
    pages.forEach(p => {
      if (p.parent_id && map[p.parent_id]) map[p.parent_id].children.push(map[p.id]);
      else roots.push(map[p.id]);
    });
    // sort by position
    const sortByPos = (arr) => { arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)); arr.forEach(n => sortByPos(n.children)); };
    sortByPos(roots);
    return roots;
  };

  const renderPageNode = (node, spaceId, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedPages[node.id] ?? true;
    const isActive = node.id === activePageId;

    return (
      <div key={node.id}>
        <div
          className={`${s.pageRow} ${isActive ? s.activePage : ''}`}
          style={{ paddingLeft: `${16 + depth * 16}px` }}
        >
          {hasChildren ? (
            <button className={s.expandBtn} onClick={() => togglePage(node.id)}>
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className={s.leafDot}>·</span>
          )}
          {renamingId === node.id ? (
            <input
              className={s.renameInput}
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={() => commitRename(node, 'page')}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(node, 'page'); if (e.key === 'Escape') setRenamingId(null); }}
              autoFocus
            />
          ) : (
            <span
              className={s.pageName}
              onClick={() => onNavigate(node.id)}
              onDoubleClick={() => startRename(node.id, node.name)}
            >
              {node.name}
            </span>
          )}
          <span className={s.pageActions}>
            <button onClick={() => handleAddPage(spaceId, node.id)} title="Add child page">+</button>
            <button onClick={() => deletePage(node.id)} title="Delete page">✕</button>
          </span>
        </div>
        {hasChildren && isExpanded && node.children.map(child => renderPageNode(child, spaceId, depth + 1))}
      </div>
    );
  };

  return (
    <div className={s.sidebar} style={style}>
      <div className={s.tree}>
        {spaces.map(sp => {
          const pages = getPages(sp.id);
          const tree = buildTree(pages);
          const isExpanded = expanded[sp.id] ?? true;

          return (
            <div key={sp.id} className={s.spaceGroup}>
              <div className={s.spaceRow}>
                <button className={s.expandBtn} onClick={() => toggleSpace(sp.id)}>
                  {isExpanded ? '▾' : '▸'}
                </button>
                <div className={s.dotWrap} ref={colorPickerSpaceId === sp.id ? colorPickerRef : null}>
                  <button
                    className={s.spaceDot}
                    style={{ background: `var(--${sp.color || 'slv'})` }}
                    onClick={(e) => { e.stopPropagation(); setColorPickerSpaceId(prev => prev === sp.id ? null : sp.id); }}
                    title="Change color"
                  />
                  {colorPickerSpaceId === sp.id && (
                    <div className={s.colorPicker}>
                      {SPACE_COLORS.map(c => (
                        <button
                          key={c}
                          className={`${s.colorSwatch} ${sp.color === c ? s.colorSwatchActive : ''}`}
                          style={{ background: `var(--${c})` }}
                          onClick={(e) => { e.stopPropagation(); saveSpace({ ...sp, color: c }); setColorPickerSpaceId(null); }}
                          title={c}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {renamingId === sp.id ? (
                  <input
                    className={s.renameInput}
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(sp, 'space')}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(sp, 'space'); if (e.key === 'Escape') setRenamingId(null); }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={s.spaceName}
                    onDoubleClick={() => startRename(sp.id, sp.name)}
                  >
                    {sp.name}
                  </span>
                )}
                <span className={s.spaceActions}>
                  <button onClick={() => handleAddPage(sp.id)} title="Add page">+</button>
                  <button onClick={() => deleteSpace(sp.id)} title="Delete space">✕</button>
                </span>
              </div>
              {isExpanded && (
                <div className={s.pageList}>
                  {tree.map(node => renderPageNode(node, sp.id))}
                  <button className={s.addPageBtn} onClick={() => handleAddPage(sp.id)}>
                    + page
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={s.bottomActions}>
        {addingSpace ? (
          <div className={s.addSpaceRow}>
            <input
              className={s.addSpaceInput}
              value={newSpaceName}
              onChange={e => setNewSpaceName(e.target.value)}
              onBlur={commitAddSpace}
              onKeyDown={e => { if (e.key === 'Enter') commitAddSpace(); if (e.key === 'Escape') { setAddingSpace(false); setNewSpaceName(''); } }}
              autoFocus
            />
          </div>
        ) : (
          <button className={s.newSpaceBtn} onClick={() => setAddingSpace(true)}>
            + New Space
          </button>
        )}
        <div className={s.shortcutHint}>
          <kbd className={s.kbd}>⌘K</kbd>
          <span>Search</span>
        </div>
      </div>
    </div>
  );
}
