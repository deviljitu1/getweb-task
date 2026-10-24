import { expect, it } from 'vitest';
import { resolvePresence } from './presence';
it('shows online when any current device is active', () => {
  expect(resolvePresence([{ status: 'Away', updated_at: 90000 }, { status: 'Online', updated_at: 90000 }], 100000)).toBe('Online');
});
it('expires a ghost session instead of keeping the person online', () => {
  expect(resolvePresence([{ status: 'Online', updated_at: 1 }], 100000)).toBe('Offline');
});
it('keeps away separate from disconnected', () => {
  expect(resolvePresence([{ status: 'Away', updated_at: 90000 }], 100000)).toBe('Away');
  expect(resolvePresence([], 100000)).toBe('Offline');
});
