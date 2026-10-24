import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CallManager, type CallSignal } from './callService';
const mocks = vi.hoisted(() => ({ receive: (_signal: { payload: CallSignal }) => {}, invoke: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ getNotificationPrefs: () => ({ soundEnabled: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: () => { const channel = { on: (_type: string, _filter: unknown, callback: typeof mocks.receive) => { mocks.receive = callback; return channel; }, subscribe: (callback: (status: string) => void) => { callback('SUBSCRIBED'); return channel; } }; return channel; },
  functions: { invoke: mocks.invoke }, removeChannel: mocks.remove,
} }));
const invite = (type: CallSignal['type'] = 'call-invite', callId = 'session') => ({ type, callId, callerId: 'peer', callerName: 'Teammate', recipientId: 'me', sentAt: Date.now() });
describe('private call lifecycle', () => {
  let manager: CallManager;
  beforeEach(() => { vi.useFakeTimers(); mocks.invoke.mockReset().mockResolvedValue({ data: { success: true } }); manager = new CallManager('me'); });
  afterEach(() => { manager.destroy(); vi.useRealTimers(); });
  it('never reports audio connected just because the invitation was accepted', async () => {
    const state = vi.fn(); manager.onStateChange = state;
    const id = await manager.startCall('peer');
    mocks.receive({ payload: invite('call-accepted', id!) });
    expect(state.mock.calls.map(([value]) => value)).toEqual(['calling', 'joining']);
    expect(mocks.invoke).toHaveBeenCalledWith('livekit-token', { body: { action: 'signal', peer_id: 'peer', signal: 'call-invite', call_id: id } });
  });
  it('ignores stale and misdirected invitations', () => {
    const incoming = vi.fn(); manager.onIncomingCall = incoming;
    mocks.receive({ payload: { ...invite(), recipientId: 'other' } });
    mocks.receive({ payload: { ...invite(), sentAt: Date.now() - 120000 } });
    expect(incoming).not.toHaveBeenCalled();
  });
  it('does not let unrelated hangups end the current call', async () => {
    const state = vi.fn(); manager.onStateChange = state;
    await manager.startCall('peer');
    mocks.receive({ payload: invite('call-ended', 'other-session') });
    expect(state).not.toHaveBeenCalledWith('idle');
  });
  it('stops a missed call and notifies the peer after the timeout', async () => {
    const state = vi.fn(), error = vi.fn(); manager.onStateChange = state; manager.onError = error;
    await manager.startCall('peer'); await vi.advanceTimersByTimeAsync(45000);
    expect(state).toHaveBeenLastCalledWith('idle'); expect(error).toHaveBeenCalledWith(expect.stringContaining('No answer'));
    expect(mocks.invoke.mock.calls.at(-1)?.[1].body.signal).toBe('call-ended');
  });
  it('cleans up failed invitations so another call can start', async () => {
    mocks.invoke.mockResolvedValueOnce({ error: new Error('Offline') });
    await expect(manager.startCall('peer')).rejects.toThrow('Call service unavailable');
    await expect(manager.startCall('peer')).resolves.toBeTruthy();
  });
  it('does not reopen a cancelled call when accept finishes late', async () => {
    mocks.receive({ payload: invite() });
    let resolve!: (value: unknown) => void;
    mocks.invoke.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const accepting = manager.acceptCall();
    mocks.receive({ payload: invite('call-ended') });
    resolve({ data: { success: true } });
    await expect(accepting).resolves.toBe(false);
  });
});
