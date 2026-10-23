import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import { Loader2, Mic, MicOff, PhoneOff, Volume2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

type Participant = { id: string; name: string; muted: boolean; speaking: boolean; quality: string };
export default function GroupAudioCall({ groupId, name, onLeave }: { groupId: string | null; name: string; onLeave: () => void }) {
  const { user } = useAuth();
  const roomRef = useRef<Room>();
  const audioRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState('');
  const [people, setPeople] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  useEffect(() => {
    const audioContainer = audioRef.current;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    async function connect() {
      try {
        const result = await supabase.functions.invoke('livekit-token', { body: { group_id: groupId } });
        if (result.error) throw new Error('The group call service is not available yet. Contact the workspace administrator.');
        if (!result.data?.configured) throw new Error(result.data?.error || 'Group calls need LiveKit configuration.');
        if (cancelled) return;
        const { Room: LiveRoom, RoomEvent, Track, AudioPresets } = await import('livekit-client');
        if (cancelled) return;
        const room = new LiveRoom({ audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, publishDefaults: { audioPreset: AudioPresets.speech, dtx: true, red: true, forceStereo: false }, disconnectOnPageLeave: true });
        roomRef.current = room;
        const refresh = () => setPeople([room.localParticipant, ...room.remoteParticipants.values()].map(person => ({ id: person.identity, name: person.name || 'Teammate', muted: !person.isMicrophoneEnabled, speaking: person.isSpeaking, quality: String(person.connectionQuality) })));
        room.on(RoomEvent.TrackSubscribed, track => { if (track.kind === Track.Kind.Audio) audioContainer?.appendChild(track.attach()); refresh(); });
        room.on(RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(element => element.remove()); refresh(); });
        room.on(RoomEvent.ParticipantConnected, refresh).on(RoomEvent.ParticipantDisconnected, refresh).on(RoomEvent.ActiveSpeakersChanged, refresh).on(RoomEvent.TrackMuted, refresh).on(RoomEvent.TrackUnmuted, refresh).on(RoomEvent.ConnectionQualityChanged, refresh);
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => setPlaybackBlocked(!room.canPlaybackAudio));
        room.on(RoomEvent.Reconnecting, () => setStatus('Reconnecting…'));
        room.on(RoomEvent.Reconnected, () => { setStatus('Connected'); refresh(); });
        room.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus('Disconnected'); });
        await room.connect(result.data.url, result.data.token);
        if (cancelled) { await room.disconnect(); return; }
        try { await room.localParticipant.setMicrophoneEnabled(true); }
        catch { setMuted(true); setError('Your microphone is unavailable. You can listen to this call and try Unmute when it is ready.'); }
        if (cancelled) { await room.disconnect(); return; }
        setStatus('Connected'); refresh();
        interval = setInterval(async () => {
          const access = await supabase.functions.invoke('livekit-token', { body: { group_id: groupId, check_access: true } });
          if (cancelled) return;
          if (access.error || !access.data?.allowed) { await room.disconnect(); setError('Call access could not be renewed. Rejoin after checking your connection and group membership.'); }
        }, 60000);
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'Could not join the call.'); setStatus('Not connected'); await roomRef.current?.disconnect(); }
      }
    }
    void connect();
    return () => { cancelled = true; clearInterval(interval); void roomRef.current?.disconnect(); roomRef.current = undefined; audioContainer?.replaceChildren(); };
  }, [groupId, user?.userId]);
  async function toggleMute() {
    try { await roomRef.current?.localParticipant.setMicrophoneEnabled(muted); setMuted(value => !value); setError(''); }
    catch { setError('Microphone permission or device is unavailable.'); }
  }
  return <section role="region" aria-label="Group voice call" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[60] max-h-[65dvh] overflow-y-auto rounded-2xl border bg-card p-4 shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-96"><div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />{name}</h2><p className="mt-1 text-xs text-muted-foreground">{status}{people.length > 0 && ` · ${people.length} participants`}</p></div><Button variant="destructive" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={onLeave} aria-label="Leave group call"><PhoneOff className="h-4 w-4" /></Button></div>{!people.length && !error && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-primary" />}{error && <p role="alert" className="mt-4 rounded-lg bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">{error}</p>}<div className="mt-4 grid grid-cols-3 gap-2">{people.map(person => <div key={person.id} className={`rounded-xl border p-3 text-center ${person.speaking ? 'border-emerald-500 bg-emerald-500/5' : 'bg-muted/20'}`}><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{person.name[0]}</span><p className="mt-2 truncate text-[11px] font-medium">{person.name}{person.id === user?.userId && ' (you)'}</p><p className="mt-1 text-[10px] text-muted-foreground">{person.muted ? 'Muted' : person.speaking ? 'Speaking' : person.quality === 'poor' ? 'Weak network' : 'Listening'}</p></div>)}</div>{status === 'Connected' && <div className="mt-4 flex justify-center gap-2"><Button variant={muted ? 'secondary' : 'outline'} onClick={toggleMute}>{muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}{muted ? 'Unmute' : 'Mute'}</Button>{playbackBlocked && <Button onClick={() => { void roomRef.current?.startAudio(); }}><Volume2 className="mr-2 h-4 w-4" />Enable audio</Button>}</div>}<div ref={audioRef} className="hidden" /></section>;
}
