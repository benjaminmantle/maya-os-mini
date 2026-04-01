import s from '../WhiteboardApp.module.css';

export default function TabBar({ tabs, activeBoardId, onSwitch, onClose, onNew }) {
  return (
    <div className={s.tabBar}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={tab.id === activeBoardId ? s.tabActive : s.tab}
          onClick={() => onSwitch(tab.id)}
          title={tab.name}
        >
          <span className={s.tabName}>{tab.name}</span>
          <span
            className={s.tabClose}
            onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
          >
            ✕
          </span>
        </button>
      ))}
      <button className={s.tabNew} onClick={onNew} title="Open board">
        +
      </button>
    </div>
  );
}
