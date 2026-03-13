import { useState, useRef, useEffect, useCallback } from 'react';
import { buildSearchIndex, searchIndex, getAllPages, getSpaces } from '../../store/vaultStore.js';
import s from '../../styles/CommandPalette.module.css';

export default function CommandPalette({ onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    buildSearchIndex();
    inputRef.current?.focus();
  }, []);

  // Search on query change
  useEffect(() => {
    if (!query.trim()) {
      // Show recent/all pages when query is empty
      const pages = getAllPages();
      const spaces = getSpaces();
      setResults(pages.slice(0, 12).map(p => {
        const space = spaces.find(sp => sp.id === p.space_id);
        return {
          type: 'page',
          id: p.id,
          name: p.name,
          breadcrumb: space ? `${space.icon || ''} ${space.name}` : '',
          icon: '📄',
        };
      }));
      setActiveIdx(0);
      return;
    }
    const hits = searchIndex(query.trim());
    setResults(hits.slice(0, 20).map(h => ({
      ...h,
      icon: h.type === 'space' ? '📁' : h.type === 'page' ? '📄' : '⊞',
    })));
    setActiveIdx(0);
  }, [query]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      activate(results[activeIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, activeIdx, onClose]);

  const activate = (result) => {
    if (result.type === 'page') {
      onNavigate(result.id);
    }
    // For rows, could open showcase in the future
    onClose();
  };

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.palette} onClick={e => e.stopPropagation()}>
        <div className={s.inputWrap}>
          <span className={s.searchIcon}>⌘</span>
          <input
            ref={inputRef}
            className={s.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, sections, rows…"
          />
        </div>
        <div className={s.results}>
          {results.length === 0 && query.trim() && (
            <div className={s.noResults}>No results</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}`}
              className={`${s.resultRow} ${i === activeIdx ? s.active : ''}`}
              onClick={() => activate(r)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className={s.resultIcon}>{r.icon}</span>
              <span className={s.resultName}>{r.name}</span>
              <span className={s.resultBreadcrumb}>{r.breadcrumb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
