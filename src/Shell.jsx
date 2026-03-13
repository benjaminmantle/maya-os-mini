import { useState, useRef, useEffect } from 'react';
import App from './App.jsx';
import VaultApp from './vault/VaultApp.jsx';
import s from './styles/components/Shell.module.css';

const APPS = [
  { id: 'maya',  label: 'Maya OS', icon: '◆', component: App,      wrap: 'center' },
  { id: 'vault', label: 'Vault',   icon: '⬡', component: VaultApp, wrap: 'full' },
];

export default function Shell() {
  const [activeApp, setActiveApp] = useState(() =>
    localStorage.getItem('maya_active_shell_app') || 'maya'
  );
  const [launcherOpen, setLauncherOpen] = useState(false);

  const bubbleRef = useRef(null);
  const launcherRef = useRef(null);

  function switchApp(id) {
    localStorage.setItem('maya_active_shell_app', id);
    setActiveApp(id);
    setLauncherOpen(false);
  }

  // Close launcher on outside click
  useEffect(() => {
    if (!launcherOpen) return;
    function onMouseDown(e) {
      if (
        launcherRef.current && !launcherRef.current.contains(e.target) &&
        bubbleRef.current && !bubbleRef.current.contains(e.target)
      ) {
        setLauncherOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [launcherOpen]);

  const activeEntry = APPS.find(a => a.id === activeApp) || APPS[0];
  const ActiveComponent = activeEntry.component;
  const wrapClass = activeEntry.wrap === 'center' ? s.appWrapCenter : s.appWrapFull;

  return (
    <div className={s.shell}>
      {/* Active app — full viewport, wrapped per-app */}
      <div className={s.appStage}>
        <div className={wrapClass}>
          {/* Portal bubble — inside wrapper so it tracks the right edge */}
          <div
            ref={bubbleRef}
            className={s.bubble}
            onClick={() => setLauncherOpen(o => !o)}
          />

          {/* Launcher panel — drops down from bubble */}
          {launcherOpen && (
            <div ref={launcherRef} className={s.launcher}>
              {APPS.map(app => (
                <button
                  key={app.id}
                  className={`${s.appBtn} ${activeApp === app.id ? s.active : ''}`}
                  onClick={() => switchApp(app.id)}
                >
                  <span className={s.appIcon}>{app.icon}</span>
                  <span className={s.appLabel}>{app.label}</span>
                </button>
              ))}
            </div>
          )}

          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
