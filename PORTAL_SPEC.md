# Maya OS — Portal Shell Spec

## Overview

A thin shell layer that wraps the entire project, enabling multiple self-contained apps to coexist. A small "portal bubble" in the upper-left corner is the only persistent UI — clicking it opens a compact app launcher. The active app fills the full viewport. Each app is invisible when not active.

The guiding principle: **zero noise between apps**. When you're in Maya, the Vault doesn't exist visually. When you're in the Vault, Maya doesn't exist. The bubble is the only seam.

---

## File Structure Changes

The shell is introduced at the root level. `main.jsx` changes from rendering `<App />` to rendering `<Shell />`.

```
src/
├── Shell.jsx                  ← root wrapper; owns active-app state + bubble
├── App.jsx                    ← rendered by Shell as the "maya" app
├── vault/
│   └── VaultApp.jsx           ← Vault root component
├── whiteboard/
│   └── WhiteboardApp.jsx      ← CosmiCanvas root component
└── styles/
    └── components/
        └── Shell.module.css   ← bubble + launcher styles
```

---

## Shell Component (`Shell.jsx`)

### Responsibilities
- Reads/writes active app to `localStorage.maya_active_shell_app` (default: `'maya'`)
- Renders the portal bubble (always visible, fixed position)
- Conditionally renders the active app's root component
- Passes an `onNavigate(appId)` callback down if needed (usually not — apps don't need to cross-launch)

### App Registry
```js
const APPS = [
  { id: 'maya',  label: 'Maya OS',      icon: '◆', component: App,            wrap: 'center' },
  { id: 'vault', label: 'Vault',        icon: '⬡', component: VaultApp,       wrap: 'full'   },
  { id: 'board', label: 'CosmiCanvas',  icon: '▦', component: WhiteboardApp,  wrap: 'full'   },
];
```

### State
```js
const [activeApp, setActiveApp] = useState(() =>
  localStorage.getItem('maya_active_shell_app') || 'maya'
);
const [launcherOpen, setLauncherOpen] = useState(false);
```

Switching apps:
```js
function switchApp(id) {
  localStorage.setItem('maya_active_shell_app', id);
  setActiveApp(id);
  setLauncherOpen(false);
}
```

### Render structure
```jsx
<div className={s.shell}>
  {/* Portal bubble — always rendered, always on top */}
  <div className={s.bubble} onClick={() => setLauncherOpen(o => !o)}>
    ◆
  </div>

  {/* Launcher panel — floats near the bubble when open */}
  {launcherOpen && (
    <div className={s.launcher}>
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

  {/* Active app — full viewport */}
  <div className={s.appStage}>
    {APPS.find(a => a.id === activeApp)?.component}
  </div>
</div>
```

Close launcher on outside click (use a `useEffect` with a document mousedown listener; remove listener on cleanup).

---

## Shell CSS (`Shell.module.css`)

### Layout
```
.shell       — position: relative; width: 100vw; height: 100vh; overflow: hidden
.appStage    — position: absolute; inset: 0; (full viewport, no offset)
```

### Bubble
```
.bubble
  position: fixed
  top: 8px
  left: 8px
  z-index: 9999
  width: 1em          ← scales with root font size; stays ≤ one capital letter tall
  height: 1em
  border-radius: 50%
  background: var(--s2)
  border: 1px solid var(--gold)
  color: var(--gold)
  font-size: 0.6rem   ← small but not microscopic; icon centered inside
  display: flex; align-items: center; justify-content: center
  cursor: pointer
  opacity: 0.4
  transition: opacity 0.15s, box-shadow 0.15s
  user-select: none

.bubble:hover
  opacity: 1
  box-shadow: 0 0 6px var(--gold)
```

The bubble is intentionally dim at rest (opacity 0.4) so it doesn't compete with any app's UI. It brightens on hover.

### Launcher panel
```
.launcher
  position: fixed
  top: 24px        ← just below the bubble
  left: 8px
  z-index: 9999
  background: var(--s2)
  border: 1px solid var(--b1)
  border-radius: 4px
  padding: 4px
  display: flex
  flex-direction: column
  gap: 2px
  min-width: 110px
  box-shadow: 0 4px 16px rgba(0,0,0,0.5)

.appBtn
  display: flex; align-items: center; gap: 8px
  padding: 5px 8px
  border-radius: 3px
  background: transparent
  border: none
  color: var(--s3)
  font-family: var(--f)
  font-size: 0.78rem
  cursor: pointer
  text-align: left
  transition: background 0.1s, color 0.1s

.appBtn:hover
  background: var(--s1)
  color: var(--text)

.appBtn.active
  color: var(--gold)

.appIcon
  font-size: 0.7rem
  width: 14px
  text-align: center
  flex-shrink: 0

.appLabel
  letter-spacing: 0.04em
```

---

## `main.jsx` Change

```jsx
// Before:
root.render(<ToastProvider><App /></ToastProvider>)

// After:
root.render(<ToastProvider><Shell /></ToastProvider>)
```

`ToastProvider` stays at root so toasts work in any app.

---

## Integration Rules

- **Shell owns zero data.** It only knows which app is active.
- **Apps are fully self-contained.** They never import from each other.
- **Maya-OS is untouched internally.** `App.jsx` and everything under it changes zero lines.
- **Each app manages its own z-index context.** The bubble and launcher are z-index 9999 — apps must not use z-indexes above 9000 in their own layers (Maya-OS currently uses up to ~1000, fine).
- **No shared router.** Shell uses its own simple state switch, not React Router. Apps that need internal routing can use their own state-based router.
- **Future apps** are registered in `APPS` in Shell.jsx. No other file needs to change.

---

## Known Traps

- `ToastProvider` context only reaches components rendered inside it. Since Shell is a child of ToastProvider in main.jsx, all apps can use `useToast()` — do not move ToastProvider inside Shell.
- **Implementation note:** The bubble is `position: absolute` inside the per-app wrapper (`.appWrapCenter` / `.appWrapFull`), not `position: fixed` as originally spec'd. Both wrappers have `position: relative`. Shell.module.css overrides topbar/nav `padding-left` from 18px to 31px to make room (9px + 13px bubble + 9px). See CLAUDE.md for full positioning details.
- Close-on-outside-click: the mousedown listener must call `e.stopPropagation()` on the launcher itself, not on the document handler. Pattern: check `!launcherRef.current.contains(e.target) && !bubbleRef.current.contains(e.target)`.
