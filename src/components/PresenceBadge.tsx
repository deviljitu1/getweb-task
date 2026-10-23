import { usePresence } from '@/contexts/PresenceContext';
export default function PresenceBadge({ userId, enabled = true }: { userId: string; enabled?: boolean }) {
  const roster = usePresence();
  const status = enabled ? roster[userId] || 'Offline' : 'Disabled';
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${status === 'Online' ? 'bg-emerald-500/10 text-emerald-700' : status === 'Away' ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'Online' ? 'bg-emerald-500' : status === 'Away' ? 'bg-amber-500' : 'bg-muted-foreground/50'}`} />{status}</span>;
}
