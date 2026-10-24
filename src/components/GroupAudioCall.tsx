import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import { Loader2, Mic, MicOff, PhoneOff, Volume2, Users, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { callErrorMessage } from '@/lib/call-errors';

type Participant = { id: string; name: string; muted: boolean; speaking: boolean; quality: string };
export default function GroupAudioCall({ groupId, peerId, name, onLeave }: { groupId: string | null; peerId?: string; name: string; onLeave: () => void }) {
  const { user } = useAuth();
  const userId = user?.userId;
  const roomRef = useRef<Room>();
  const audioRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState('');
  const [people, setPeople] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(true);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [changingMic, setChangingMic] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const audioContainer = audioRef.current;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let room: Room | undefined;
    setStatus('Connecting…'); setError(''); setPeople([]); setConnected(false); setMuted(true);
    async function connect() {
      try {
        const result = await supabase.functions.invoke('livekit-token', { body: { group_id: groupId, ...(peerId ? { peer_id: peerId } : {}) } });
        if (result.error) {
          let detail = result.data?.error;
          try { detail ||= (await result.error.context?.clone().json())?.error; } catch { /* A network error may have no JSON response. */ }
          throw new Error(detail || 'Call service unavailable. Check your connection and try again.');
        }
        if (!result.data?.configured) throw new Error(result.data?.error || 'The workspace call service needs to be configured.');
        if (peerId && result.data.room !== `getweb-dm-${[userId!, peerId].sort().join('-')}`) throw new Error('The call service needs an update before private calls can connect. Contact your workspace administrator.');
        if (cancelled) return;
        const { Room: LiveRoom, RoomEvent, Track, AudioPresets } = await import('livekit-client');
        if (cancelled) return;
        room = new LiveRoom({ audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, publishDefaults: { audioPreset: AudioPresets.speech, dtx: true, red: true, forceStereo: false }, disconnectOnPageLeave: true });
        const currentRoom = room;
        roomRef.current = room;
        const refresh = () => {
          if (cancelled) return;
          setPeople([currentRoom.localParticipant, ...currentRoom.remoteParticipants.values()].map(person => ({ id: person.identity, name: person.name || 'Teammate', muted: !person.isMicrophoneEnabled, speaking: person.isSpeaking, quality: String(person.connectionQuality) })));
          setMuted(!currentRoom.localParticipant.isMicrophoneEnabled);
          if (currentRoom.state === 'connected') setStatus(peerId && !currentRoom.remoteParticipants.size ? 'Waiting for your teammate…' : 'Connected');
        };
        room.on(RoomEvent.TrackSubscribed, track => { if (!cancelled && track.kind === Track.Kind.Audio) audioContainer?.appendChild(track.attach()); refresh(); });
        room.on(RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(element => element.remove()); refresh(); });
        room.on(RoomEvent.ParticipantConnected, refresh).on(RoomEvent.ParticipantDisconnected, refresh).on(RoomEvent.ActiveSpeakersChanged, refresh).on(RoomEvent.TrackMuted, refresh).on(RoomEvent.TrackUnmuted, refresh).on(RoomEvent.LocalTrackPublished, refresh).on(RoomEvent.LocalTrackUnpublished, refresh).on(RoomEvent.ConnectionQualityChanged, refresh);
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!cancelled) setPlaybackBlocked(!currentRoom.canPlaybackAudio); });
        room.on(RoomEvent.Reconnecting, () => { if (!cancelled) { setStatus('Reconnecting…'); setConnected(false); } });
        room.on(RoomEvent.Reconnected, () => { if (!cancelled) { setConnected(true); refresh(); } });
        room.on(RoomEvent.Disconnected, () => { if (!cancelled) { setStatus('Disconnected'); setConnected(false); setPeople([]); setError('The call disconnected. Check your network and retry.'); } });
        await room.connect(result.data.url, result.data.token);
        if (cancelled) { await room.disconnect(); return; }
        setConnected(true); refresh();
        try { await room.localParticipant.setMicrophoneEnabled(true); }
        catch (err) { if (!cancelled) { setMuted(true); setError(callErrorMessage(err)); } }
        if (cancelled) { await room.disconnect(); return; }
        setPlaybackBlocked(!room.canPlaybackAudio); refresh();
        let accessFailures = 0;
        interval = setInterval(async () => {
          const access = await supabase.functions.invoke('livekit-token', { body: { group_id: groupId, ...(peerId ? { peer_id: peerId } : {}), check_access: true } });
          if (cancelled) return;
          if (!access.error && access.data?.allowed) { accessFailures = 0; return; }
          if (++accessFailures < 2 && access.error?.context?.status !== 403) return;
          await currentRoom.disconnect();
          if (!cancelled) setError('Call access could not be renewed. Check your connection and group membership, then retry.');
          clearInterval(interval);
        }, 60000);
      } catch (err) {
        if (!cancelled) { await room?.disconnect(); setError(callErrorMessage(err)); setStatus('Not connected'); setConnected(false); setPeople([]); }
      }
    }
    void connect();
    return () => { cancelled = true; clearInterval(interval); void room?.disconnect(); if (roomRef.current === room) roomRef.current = undefined; audioContainer?.replaceChildren(); };
  }, [groupId, peerId, userId, attempt]);

  async function toggleMute() {
    const room = roomRef.current;
    if (!room || !connected || changingMic) return;
    setChangingMic(true);
    try { await room.localParticipant.setMicrophoneEnabled(muted); setMuted(!room.localParticipant.isMicrophoneEnabled); setError(''); }
    catch (err) { setError(callErrorMessage(err)); }
    finally { setChangingMic(false); }
  }
  return <section role="region" aria-label={peerId ? 'Voice call' : 'Group voice call'} className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[60] max-h-[min(65dvh,440px)] overflow-y-auto rounded-2xl border bg-card p-3 shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-96">
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{name}</span></h2><p role="status" className="mt-1 text-xs text-muted-foreground">{status}{people.length > 0 && !peerId && ` · ${people.length} participants`}</p></div><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={collapsed ? 'Expand call' : 'Minimize call'} onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><Button variant="destructive" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={onLeave} aria-label="Leave call"><PhoneOff className="h-4 w-4" /></Button></div>
    {!collapsed && <>{!people.length && !error && <Loader2 aria-label="Connecting" className="mx-auto my-4 h-5 w-5 animate-spin text-primary" />}{error && <p role="alert" className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs leading-relaxed text-destructive">{error}</p>}<div className={`mt-3 grid gap-2 ${peerId ? 'grid-cols-2' : 'grid-cols-3'}`}>{people.map(person => <div key={person.id} className={`min-w-0 rounded-xl border p-2 text-center ${person.speaking ? 'border-emerald-500 bg-emerald-500/5' : 'bg-muted/20'}`}><p className="truncate text-xs font-medium">{person.name}{person.id === user?.userId && ' (you)'}</p><p className="mt-1 text-[10px] text-muted-foreground">{person.muted ? 'Muted' : person.speaking ? 'Speaking' : person.quality === 'poor' ? 'Weak network' : 'Listening'}</p></div>)}</div></>}
    <div className="mt-3 flex flex-wrap justify-center gap-2">{connected && <Button size="sm" variant={muted ? 'secondary' : 'outline'} disabled={changingMic} onClick={() => void toggleMute()}>{muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}{changingMic ? 'Please wait…' : muted ? 'Unmute' : 'Mute'}</Button>}{connected && playbackBlocked && <Button size="sm" onClick={() => { void roomRef.current?.startAudio().catch(err => setError(callErrorMessage(err))); }}><Volume2 className="mr-2 h-4 w-4" />Enable audio</Button>}{!connected && error && <Button size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}><RotateCcw className="mr-2 h-4 w-4" />Retry connection</Button>}</div>
    <div ref={audioRef} className="hidden" />
  </section>;
}
