import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isOnline, subscribeNetworkStatus } from '@/lib/offlineSync';
import { resolvePresence, type PresenceStatus } from '@/lib/presence';

const PresenceContext = createContext<{ roster: Record<string, PresenceStatus>; ready: boolean; online: boolean; selfId?: string }>({ roster: {}, ready: false, online: true });
export const usePresence = () => useContext(PresenceContext);
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roster, setRoster] = useState<Record<string, PresenceStatus>>({});
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(isOnline);
  const userId = user?.userId;
  useEffect(() => {
    setRoster({});
    setReady(false);
    if (!userId) return;
    let connected = false;
    let networkOnline = isOnline();
    let lastActivity = Date.now();
    let lastStatus = '';
    let lastPublishedAt = 0;
    let disposed = false;
    const channel = supabase.channel('team-presence', { config: { private: true, presence: { key: userId } } });
    const update = () => {
      if (!connected || !networkOnline || disposed) return;
      const status = document.visibilityState === 'visible' && Date.now() - lastActivity < 300000 ? 'Online' : 'Away';
      if (status !== lastStatus || Date.now() - lastPublishedAt >= 25000) {
        lastStatus = status; lastPublishedAt = Date.now();
        void channel.track({ status, updated_at: lastPublishedAt }).then(result => { if (result !== 'ok') lastStatus = ''; }).catch(() => { lastStatus = ''; });
      }
    };
    const activity = () => { lastActivity = Date.now(); update(); };
    const sync = () => {
      if (disposed || !connected || !networkOnline) return;
      const next: Record<string, PresenceStatus> = {};
      for (const [id, sessions] of Object.entries(channel.presenceState<{ status: string; updated_at?: number }>())) {
        next[id] = resolvePresence(sessions);
      }
      setRoster(next);
      setReady(true);
    };
    channel.on('presence', { event: 'sync' }, sync).subscribe(status => {
      connected = status === 'SUBSCRIBED';
      if (connected) { lastStatus = ''; update(); }
      else { setRoster({}); setReady(false); }
    });
    const visibility = () => { if (document.visibilityState === 'visible') lastActivity = Date.now(); update(); };
    const stopNetwork = subscribeNetworkStatus(value => { networkOnline = value; setOnline(value); if (value) { lastStatus = ''; update(); } else { setRoster({}); setReady(false); } });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', activity);
    document.addEventListener('pointerdown', activity, { passive: true });
    document.addEventListener('keydown', activity);
    const timer = setInterval(() => { update(); sync(); }, 30000);
    return () => { disposed = true; stopNetwork(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('focus', activity); document.removeEventListener('pointerdown', activity); document.removeEventListener('keydown', activity); void channel.untrack(); void supabase.removeChannel(channel); };
  }, [userId]);
  return <PresenceContext.Provider value={{ roster, ready, online, selfId: userId }}>{children}</PresenceContext.Provider>;
}
