import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { enqueueOfflineAction, getOfflineQueue, processOfflineQueue, setOfflineUser } from './offlineSync';
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock('@capacitor/network', () => ({ Network: { getStatus: async () => ({ connected: true }), addListener: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  mocks.insert.mockReset(); setOfflineUser('test-user');
});
afterEach(() => { setOfflineUser(null); vi.unstubAllGlobals(); });
const add = (id: string) => enqueueOfflineAction('ADD_TASK', { taskId: id, userId: 'test-user', taskInput: { title: id, category: 'Other', date: '2026-10-24' } });
it('preserves and syncs an action added during an in-flight request', async () => {
  let finish!: (value: { error: null }) => void;
  mocks.insert.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue({ error: null });
  add('first');
  const sync = processOfflineQueue();
  add('second'); finish({ error: null });
  expect(await sync).toEqual({ synced: 2, remaining: 0 });
  expect(mocks.insert).toHaveBeenCalledTimes(2);
  expect(getOfflineQueue()).toEqual([]);
});
it('retains failed changes and keeps queues isolated by account', async () => {
  mocks.insert.mockResolvedValue({ error: { message: 'Network unavailable' } });
  add('pending');
  expect(await processOfflineQueue()).toEqual({ synced: 0, remaining: 1 });
  setOfflineUser(null); expect(getOfflineQueue()).toEqual([]);
  setOfflineUser('different-user'); expect(getOfflineQueue()).toEqual([]);
});
