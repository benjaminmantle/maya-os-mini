import { uid, today } from '../utils/dates.js';

export const DEFAULT_DAILIES = [
  { id: uid(), name: 'Wake by 8:00 am', type: 'general' },
  { id: uid(), name: 'Back-load all rewards', type: 'focus' },
  { id: uid(), name: 'Go outside', type: 'exercise' },
  { id: uid(), name: 'BKL review', type: 'focus' },
  { id: uid(), name: 'Calisthenics 5m #1', type: 'exercise' },
  { id: uid(), name: 'Calisthenics 5m #2', type: 'exercise' },
  { id: uid(), name: '4,000 steps', type: 'exercise' },
  { id: uid(), name: 'Wind down by 11pm', type: 'general' },
  { id: uid(), name: 'Sleep by 12:00 am', type: 'health' },
];

export function seedTasks() {
  return [];
}
