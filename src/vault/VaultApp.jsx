import s from './VaultApp.module.css';

export default function VaultApp() {
  return (
    <div className={s.root}>
      <div className={s.placeholder}>
        <span className={s.icon}>⬡</span>
        <h1 className={s.title}>Vault</h1>
        <p className={s.sub}>Coming soon</p>
      </div>
    </div>
  );
}
