import { useState, type FormEvent } from 'react';
import { useChatGroups } from '@/hooks/use-chat-groups';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ChatGroupManager({ groupId, onClose, onSelected }: { groupId: string | 'new'; onClose: () => void; onSelected: (id: string) => void }) {
  const { user } = useAuth();
  const { members } = useData();
  const query = useChatGroups();
  const queryClient = useQueryClient();
  const group = query.data?.groups.find(item => item.id === groupId);
  const membership = query.data?.membership.filter(item => item.group_id === groupId) || [];
  const [name, setName] = useState(group?.name || '');
  const [selected, setSelected] = useState<string[]>(group ? membership.map(item => item.user_id) : user ? [user.userId] : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const result = groupId === 'new' ? await supabase.rpc('create_chat_group', { group_name: name.trim(), member_ids: selected }) : await supabase.functions.invoke('livekit-token', { body: { action: 'update_group', group_id: groupId, group_name: name.trim(), member_ids: selected } });
      if (result.error) throw result.error;
      if (result.data?.error) throw new Error(result.data.error);
      await queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
      onSelected(groupId === 'new' ? result.data as string : groupId); onClose(); toast.success(groupId === 'new' ? 'Group created' : 'Group updated');
    } catch (err) { setError(err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Group could not be saved.'); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{group ? 'Manage group' : 'Create a group'}</DialogTitle><DialogDescription>Only members can read this group. Group creators manage its membership.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><Label htmlFor="chat-group-name">Group name</Label><Input id="chat-group-name" value={name} required maxLength={100} onChange={event => setName(event.target.value)} disabled={saving} /><div className="space-y-1"><p className="mb-2 text-xs text-muted-foreground">{selected.length} members selected · maximum 50</p>{members.filter(member => member.is_active || selected.includes(member.user_id)).map(member => { const isAdmin = member.user_id === user?.userId || membership.some(item => item.user_id === member.user_id && item.role === 'admin'); return <label key={member.user_id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted"><input type="checkbox" checked={selected.includes(member.user_id)} disabled={saving || isAdmin} onChange={event => setSelected(previous => event.target.checked ? [...previous, member.user_id] : previous.filter(id => id !== member.user_id))} className="h-4 w-4 accent-primary" /><span className="min-w-0 flex-1 truncate text-sm">{member.name}</span><span className="text-[10px] text-muted-foreground">{isAdmin ? 'Group owner' : member.employee_type}</span></label>; })}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={saving || !name.trim() || selected.length > 50}>{saving ? 'Saving…' : group ? 'Save group' : 'Create group'}</Button></form></DialogContent></Dialog>;
}

