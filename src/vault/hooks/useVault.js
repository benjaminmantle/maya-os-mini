import { useState, useEffect } from 'react';
import { getVaultSnapshot, subscribe, unsubscribe } from '../store/vaultStore.js';

export function useVault() {
  const [state, setState] = useState(getVaultSnapshot());
  useEffect(() => {
    const handler = () => setState(getVaultSnapshot());
    subscribe(handler);
    return () => unsubscribe(handler);
  }, []);
  return state;
}
