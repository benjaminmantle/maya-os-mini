import s from '../styles/Toolbar.module.css';

export default function StyleSwitcher({ renderStyle, setRenderStyle }) {
  return (
    <div className={s.styleSwitcher}>
      <button
        className={`${s.styleBtn} ${renderStyle === 'sketch' ? s.activeStyle : ''}`}
        onClick={() => setRenderStyle('sketch')}
      >
        Sketch
      </button>
      <button
        className={`${s.styleBtn} ${renderStyle === 'clean' ? s.activeStyle : ''}`}
        onClick={() => setRenderStyle('clean')}
      >
        Clean
      </button>
    </div>
  );
}
