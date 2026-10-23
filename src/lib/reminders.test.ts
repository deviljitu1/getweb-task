import { expect, it } from 'vitest';
import { crossedReminder } from './reminders';
it('does not replay reminders when opening an already overdue task', () => {
  expect(crossedReminder(undefined, -20)).toBeNull();
  expect(crossedReminder(-20, -21)).toBeNull();
});
it('emits one reminder for the threshold just crossed', () => {
  expect(crossedReminder(11, 9)).toBe(10);
  expect(crossedReminder(6, 4)).toBe(5);
  expect(crossedReminder(12, -1)).toBe(0);
  expect(crossedReminder(4, 3)).toBeNull();
});
