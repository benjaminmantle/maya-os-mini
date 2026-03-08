import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import styles from '../../styles/components/Modals.module.css';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((text) => {
    setMsg(text);
    setVisible(true);
    setTimeout(() => setVisible(false), 2400);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`${styles.toast} ${visible ? styles.toastShow : ''}`}>
        {msg}
      </div>
    </ToastContext.Provider>
  );
}
