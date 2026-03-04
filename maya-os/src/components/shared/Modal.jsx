import styles from '../../styles/components/Modals.module.css';

export default function Modal({ children, onClose }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        {children}
      </div>
    </div>
  );
}
