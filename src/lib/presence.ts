export type PresenceStatus = 'Online' | 'Away' | 'Offline';
export function resolvePresence(sessions: { status: string; updated_at?: number }[], now = Date.now()): PresenceStatus {
  const fresh = sessions.filter(session => session.updated_at === undefined || now - session.updated_at < 90000);
  if (fresh.some(session => session.status === 'Online')) return 'Online';
  return fresh.some(session => session.status === 'Away') ? 'Away' : 'Offline';
}
