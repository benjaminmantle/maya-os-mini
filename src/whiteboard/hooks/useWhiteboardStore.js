import { useState, useEffect } from 'react';
import { getBoardSnapshot, subscribe, unsubscribe } from '../store/whiteboardStore.js';

export function useWhiteboardStore() {
  const [state, setState] = useState(getBoardSnapshot());
  useEffect(() => {
    const handler = () => setState(getBoardSnapshot());
    subscribe(handler);
    return () => unsubscribe(handler);
  }, []);
  return state;
}
