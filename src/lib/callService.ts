import { supabase } from '@/integrations/supabase/client';
import { getNotificationPrefs } from '@/lib/notifications';

let audioContext: AudioContext | undefined;
export function playBellChime() {
  if (!getNotificationPrefs().soundEnabled) return;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    [880, 1320].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator(), gain = audioContext!.createGain();
      const time = audioContext!.currentTime + index * 0.15;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);
      oscillator.connect(gain).connect(audioContext!.destination);
      oscillator.start(time); oscillator.stop(time + 0.7);
    });
  } catch { /* Sound is optional until the browser allows playback. */ }
}

export type CallState = 'idle' | 'calling' | 'ringing' | 'joining';
export type CallSignal = { type: 'call-invite' | 'call-accepted' | 'call-declined' | 'call-ended' | 'ring-alert'; callId: string; callerId: string; callerName: string; recipientId: string; sentAt: number };

// Realtime carries authenticated invitations only. LiveKit carries all audio.
export class CallManager {
  private channel;
  private active: { callId: string; peerId: string } | null = null;
  private timeout?: ReturnType<typeof setTimeout>;
  private ringtone?: ReturnType<typeof setInterval>;
  private subscribed = false;
  private cancelled = new Set<string>();
  public onStateChange?: (state: CallState) => void;
  public onIncomingCall?: (call: { callId: string; callerId: string; callerName: string }) => void;
  public onRing?: (signal: CallSignal) => void;
  public onError?: (message: string) => void;

  constructor(private currentUserId: string) {
    this.channel = supabase.channel(`team-calls:user:${currentUserId}`, { config: { private: true } })
      .on('broadcast', { event: 'call-signal' }, ({ payload }: { payload: CallSignal }) => this.receive(payload))
      .subscribe(status => { this.subscribed = status === 'SUBSCRIBED'; });
  }
  private receive(signal: CallSignal) {
    if (signal.recipientId !== this.currentUserId || !signal.callId || !signal.callerId || !Number.isFinite(signal.sentAt) || Math.abs(Date.now() - signal.sentAt) > 60000) return;
    if (signal.type === 'ring-alert') { playBellChime(); this.onRing?.(signal); return; }
    if (signal.type === 'call-ended' || signal.type === 'call-declined') {
      this.cancelled.add(signal.callId);
      if (this.cancelled.size > 50) this.cancelled.delete(this.cancelled.values().next().value!);
    }
    if (signal.type === 'call-invite') {
      if (this.cancelled.has(signal.callId) || this.active?.callId === signal.callId) return;
      if (this.active) { void this.signal(signal.callerId, 'call-declined', signal.callId).catch(() => undefined); return; }
      this.active = { callId: signal.callId, peerId: signal.callerId };
      this.startRinging(); this.onStateChange?.('ringing'); this.onIncomingCall?.(signal); if (this.active) this.expire();
      return;
    }
    if (this.active?.callId !== signal.callId || this.active.peerId !== signal.callerId) return;
    if (signal.type === 'call-accepted') { this.stopRinging(); clearTimeout(this.timeout); this.onStateChange?.('joining'); }
    if (signal.type === 'call-ended' || signal.type === 'call-declined') {
      if (signal.type === 'call-declined') this.onError?.('Your teammate could not take the call. Try again later.');
      this.cleanup();
    }
  }
  private async signal(peerId: string, signal: CallSignal['type'], callId: string) {
    const result = await supabase.functions.invoke('livekit-token', { body: { action: 'signal', peer_id: peerId, signal, call_id: callId } });
    if (result.error || !result.data?.success) throw new Error(result.data?.error || 'Call service unavailable. Check your connection and try again.');
  }
  private startRinging() { this.stopRinging(); playBellChime(); this.ringtone = setInterval(playBellChime, 2500); }
  private stopRinging() { clearInterval(this.ringtone); }
  private expire() {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => { this.onError?.('No answer. Your teammate may be offline.'); void this.endCall().catch(() => undefined); }, 45000);
  }
  public async startCall(peerId: string) {
    if (!this.subscribed) throw new Error('Call invitations are reconnecting. Wait a moment and try again.');
    if (this.active) throw new Error('Leave the current call first.');
    const callId = crypto.randomUUID();
    this.active = { callId, peerId };
    this.onStateChange?.('calling'); this.startRinging(); this.expire();
    try { await this.signal(peerId, 'call-invite', callId); }
    catch (error) { if (this.active?.callId === callId) this.cleanup(); throw error; }
    return this.active?.callId === callId ? callId : null;
  }
  public async acceptCall() {
    if (!this.active) return false;
    const { peerId, callId } = this.active;
    this.stopRinging(); clearTimeout(this.timeout); this.onStateChange?.('joining');
    await this.signal(peerId, 'call-accepted', callId);
    return this.active?.callId === callId;
  }
  public async declineCall() {
    const active = this.active; this.cleanup();
    if (active) await this.signal(active.peerId, 'call-declined', active.callId);
  }
  public async endCall() {
    const active = this.active; this.cleanup();
    if (active) await this.signal(active.peerId, 'call-ended', active.callId);
  }
  public ringMember(peerId: string) { return this.signal(peerId, 'ring-alert', crypto.randomUUID()); }
  public cleanup() { this.stopRinging(); clearTimeout(this.timeout); this.active = null; this.onStateChange?.('idle'); }
  public destroy() { this.cleanup(); void supabase.removeChannel(this.channel); }
}
