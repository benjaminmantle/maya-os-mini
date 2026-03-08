import { useState, useEffect } from 'react';
import { getState, subscribe, unsubscribe } from '../store/store.js';

export function useStore() {
  const [state, setState] = useState(getState());
  useEffect(() => {
    const handler = () => setState(getState());
    subscribe(handler);
    return () => unsubscribe(handler);
  }, []);
  return state;
}
