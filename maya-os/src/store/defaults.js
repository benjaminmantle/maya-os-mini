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
  const d = today();
  return [
    { id: uid(), name: 'Core Task 1', pts: 3, timeEstimate: '2h', isFrog: true, scheduledDate: d, createdAt: new Date().toISOString() },
    { id: uid(), name: 'Core Task 2', pts: 2, timeEstimate: '1h', isFrog: false, scheduledDate: d, createdAt: new Date().toISOString() },
    { id: uid(), name: 'Core Task 3', pts: 1, timeEstimate: '30m', isFrog: false, scheduledDate: d, createdAt: new Date().toISOString() },
    { id: uid(), name: 'Core Task 4', pts: 2, timeEstimate: null, isFrog: false, scheduledDate: d, createdAt: new Date().toISOString() },
    { id: uid(), name: 'Backlog Item 1', pts: 3, timeEstimate: null, isFrog: false, scheduledDate: null, createdAt: new Date().toISOString() },
    { id: uid(), name: 'Backlog Item 2', pts: 1, timeEstimate: null, isFrog: false, scheduledDate: null, createdAt: new Date().toISOString() },
    { id: uid(), name: 'Backlog Item 3', pts: 2, timeEstimate: '45m', isFrog: false, scheduledDate: null, createdAt: new Date().toISOString() },
  ];
}
