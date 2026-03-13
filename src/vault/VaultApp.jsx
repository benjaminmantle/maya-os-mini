import { useState, useEffect, useCallback, useRef } from 'react';
import VaultSidebar from './components/layout/VaultSidebar.jsx';
import PageView from './components/layout/PageView.jsx';
import CommandPalette from './components/layout/CommandPalette.jsx';
import { registerShowcase } from './components/showcase/ShowcaseRegistry.js';
import CharacterShowcase from './components/showcase/templates/CharacterShowcase.jsx';
import { initVault, loadPages, getSpaces } from './store/vaultStore.js';
import { useVault } from './hooks/useVault.js';
import s from './VaultApp.module.css';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 400;
const SIDEBAR_KEY = 'vault_sidebar_width';

export default function VaultApp() {
  const vault = useVault();
  const [activePageId, setActivePageId] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    return stored ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Number(stored))) : 220;
  });
  const isResizingRef = useRef(false);

  // Cmd+K / Ctrl+K to toggle command palette
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette(prev => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Sidebar resize drag listeners
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Persist
        setSidebarWidth(w => { localStorage.setItem(SIDEBAR_KEY, String(w)); return w; });
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const startResize = () => {
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePaletteNavigate = useCallback((pageId) => {
    setActivePageId(pageId);
  }, []);

  // Register showcase templates
  useEffect(() => {
    registerShowcase('endless-sky-character', CharacterShowcase);
  }, []);

  // Initialize vault (loads spaces + seeds mock data in local mode)
  useEffect(() => {
    initVault().then(() => setInitialized(true));
  }, []);

  // Once spaces are loaded, load pages for all spaces
  const spaces = getSpaces();
  useEffect(() => {
    if (initialized && spaces.length) {
      spaces.forEach(sp => loadPages(sp.id));
    }
  }, [initialized, spaces.length]);

  // Auto-select first page if none selected
  useEffect(() => {
    if (!activePageId && vault._allPages?.length) {
      // Pick first leaf page (one with content)
      const firstWithContent = vault._allPages.find(p => p.parent_id !== null) || vault._allPages[0];
      setActivePageId(firstWithContent.id);
    }
  }, [vault._allPages?.length, activePageId]);

  if (!initialized) {
    return (
      <div className={s.root}>
        <div className={s.loading}>
          <span className={s.loadingIcon}>⬡</span>
          <p className={s.loadingText}>Loading Vault…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <VaultSidebar
        activePageId={activePageId}
        onNavigate={setActivePageId}
        style={{ width: `${sidebarWidth}px` }}
      />
      <div
        className={s.resizeHandle}
        onMouseDown={startResize}
      />
      <div className={s.content}>
        <PageView pageId={activePageId} onNavigate={setActivePageId} />
      </div>
      {showPalette && (
        <CommandPalette
          onNavigate={handlePaletteNavigate}
          onClose={() => setShowPalette(false)}
        />
      )}
    </div>
  );
}
