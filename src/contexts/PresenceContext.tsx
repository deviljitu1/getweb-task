import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PresenceStatus = 'Online' | 'Away' | 'Offline';
const PresenceContext = createContext<Record<string, PresenceStatus>>({});
export const usePresence = () => useContext(PresenceContext);
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roster, setRoster] = useState<Record<string, PresenceStatus>>({});
  useEffect(() => {
    setRoster({});
    if (!user?.userId) return;
    let connected = false;
    let lastActivity = Date.now();
    let lastStatus = '';
    const channel = supabase.channel('team-presence', { config: { private: true, presence: { key: user.userId } } });
    const update = () => {
      if (!connected) return;
      const status = document.visibilityState === 'visible' && Date.now() - lastActivity < 300000 ? 'Online' : 'Away';
      if (status !== lastStatus) { lastStatus = status; void channel.track({ status }); }
    };
    const activity = () => { lastActivity = Date.now(); update(); };
    const sync = () => {
      const next: Record<string, PresenceStatus> = {};
      for (const [id, sessions] of Object.entries(channel.presenceState<{ status: string }>())) {
        next[id] = sessions.some(session => session.status === 'Online') ? 'Online' : 'Away';
      }
      setRoster(next);
    };
    channel.on('presence', { event: 'sync' }, sync).subscribe(status => {
      connected = status === 'SUBSCRIBED';
      if (connected) { lastStatus = ''; update(); }
      else setRoster({});
    });
    document.addEventListener('visibilitychange', update);
    document.addEventListener('pointerdown', activity, { passive: true });
    document.addEventListener('keydown', activity);
    const timer = setInterval(update, 30000);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); document.removeEventListener('pointerdown', activity); document.removeEventListener('keydown', activity); void channel.untrack(); void supabase.removeChannel(channel); };
  }, [user?.userId]);
  return <PresenceContext.Provider value={roster}>{children}</PresenceContext.Provider>;
}
