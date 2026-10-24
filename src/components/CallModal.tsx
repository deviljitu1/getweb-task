import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CallManager, type CallState } from '@/lib/callService';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Bell, Phone, PhoneOff } from 'lucide-react';
import { callErrorMessage } from '@/lib/call-errors';

const GroupAudioCall = React.lazy(() => import('@/components/GroupAudioCall'));
interface CallContextType {
  isCallActive: boolean;
  startGroupCall: (groupId: string | null, name: string) => void;
  startAudioCall: (targetUserId: string, name: string) => void;
  ringMember: (targetUserId: string, name: string) => Promise<void>;
}
const CallContext = createContext<CallContextType | null>(null);
export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
type RoomCall = { groupId: string | null; peerId?: string; name: string };
export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.userId;
  const manager = useRef<CallManager>();
  const [state, setState] = useState<CallState>('idle');
  const [peer, setPeer] = useState<{ id: string; name: string }>();
  const [room, setRoom] = useState<RoomCall>();
  const roomRef = useRef(room); roomRef.current = room;
  const [ring, setRing] = useState<{ id: string; name: string }>();
  const [accepting, setAccepting] = useState(false);
  const report = (error: unknown) => toast({ title: 'Call unavailable', description: callErrorMessage(error), variant: 'destructive' });
  useEffect(() => {
    if (!userId) return;
    const calls = new CallManager(userId);
    manager.current = calls;
    calls.onStateChange = next => { setState(next); if (next === 'idle') { if (roomRef.current?.peerId) setRoom(undefined); setPeer(undefined); } };
    calls.onError = message => report(new Error(message));
    calls.onIncomingCall = incoming => {
      if (roomRef.current) { void calls.declineCall().catch(report); return; }
      setPeer({ id: incoming.callerId, name: incoming.callerName });
    };
    calls.onRing = signal => setRing({ id: signal.callerId, name: signal.callerName });
    return () => { calls.destroy(); manager.current = undefined; setRoom(undefined); setRing(undefined); };
  }, [userId]);
  useEffect(() => {
    if (!ring) return;
    const timeout = setTimeout(() => setRing(undefined), 8000);
    return () => clearTimeout(timeout);
  }, [ring]);
  const leave = () => { setRoom(undefined); void manager.current?.endCall().catch(report); };
  const busy = () => {
    if (roomRef.current || state !== 'idle') { toast({ title: 'A call is already in progress', description: 'Leave it before starting another.' }); return true; }
    return false;
  };
  const startAudioCall = async (peerId: string, name: string) => {
    if (!manager.current || busy()) return;
    setPeer({ id: peerId, name });
    try { if (await manager.current.startCall(peerId)) setRoom({ groupId: null, peerId, name }); }
    catch (error) { setPeer(undefined); report(error); }
  };
  const accept = async () => {
    if (!peer || accepting || !manager.current) return;
    setAccepting(true);
    try { if (await manager.current.acceptCall()) setRoom({ groupId: null, peerId: peer.id, name: peer.name }); }
    catch (error) { leave(); report(error); }
    finally { setAccepting(false); }
  };
  const ringMember = async (id: string, name: string) => {
    try { if (!manager.current) throw new Error('Sign in to ring a teammate.'); await manager.current.ringMember(id); toast({ title: `Rang ${name}`, description: 'They will receive a bell alert while the app is open.' }); }
    catch (error) { report(error); }
  };
  return <CallContext.Provider value={{ isCallActive: Boolean(room) || state !== 'idle', startAudioCall, ringMember, startGroupCall: (groupId, name) => { if (!busy()) setRoom({ groupId, name }); } }}>
    {children}
    {room && <React.Suspense fallback={<aside role="status" className="fixed bottom-24 right-3 z-[60] rounded-xl border bg-card p-4 text-sm shadow-xl">Preparing call…<Button variant="ghost" size="sm" onClick={leave}>Cancel</Button></aside>}><GroupAudioCall groupId={room.groupId} peerId={room.peerId} name={room.name} onLeave={leave} /></React.Suspense>}
    {!room && state !== 'idle' && <aside role="region" aria-label="Audio call invitation" className="fixed bottom-24 left-3 right-3 z-[60] rounded-2xl border bg-card p-4 shadow-xl sm:left-auto sm:w-80"><p className="truncate text-sm font-semibold">{peer?.name || 'Teammate'}</p><p role="status" className="mt-1 text-xs text-muted-foreground">{state === 'ringing' ? 'Incoming voice call' : state === 'joining' ? 'Joining call…' : 'Calling…'}</p><div className="mt-3 flex gap-2"><Button variant="destructive" size="sm" aria-label={state === 'ringing' ? 'Decline call' : 'Cancel call'} onClick={() => { if (state === 'ringing') void manager.current?.declineCall().catch(report); else leave(); }}><PhoneOff className="mr-2 h-4 w-4" />{state === 'ringing' ? 'Decline' : 'Cancel'}</Button>{state === 'ringing' && <Button size="sm" disabled={accepting} onClick={() => void accept()}><Phone className="mr-2 h-4 w-4" />Accept</Button>}</div></aside>}
    {ring && <aside role="status" className="fixed right-3 top-20 z-[60] w-[calc(100%-1.5rem)] max-w-sm rounded-xl border bg-card p-3 shadow-xl"><p className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4" />{ring.name} is ringing</p><div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={() => setRing(undefined)}>Dismiss</Button><Button size="sm" onClick={() => { setRing(undefined); void startAudioCall(ring.id, ring.name); }}>Call back</Button></div></aside>}
  </CallContext.Provider>;
};
