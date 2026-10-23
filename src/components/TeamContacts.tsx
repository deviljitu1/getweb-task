import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoreVertical, Phone, Bell, Pencil, UserX, UserCheck, Info } from 'lucide-react';
import type { ProfileWithRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useCall } from '@/components/CallModal';
import { supabase } from '@/integrations/supabase/client';
import PresenceBadge from '@/components/PresenceBadge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
const EditMemberDialog = lazy(() => import('@/components/EditMemberDialog'));
type Activity = { user_id: string; current_task_title: string | null; task_description: string | null; todo_tasks: { title: string }[] | null; progress_tasks: { title: string }[] | null; completed_tasks: { title: string }[] | null };

export default function TeamContacts({ members, selected, unread, onSelect }: { members: ProfileWithRole[]; selected: string | null; unread: Record<string, number>; onSelect: (id: string) => void }) {
  const { user } = useAuth();
  const { toggleMemberActive } = useData();
  const { startAudioCall, ringMember } = useCall();
  const [detail, setDetail] = useState<ProfileWithRole | null>(null);
  const [editing, setEditing] = useState<ProfileWithRole | null>(null);
  const activity = useQuery({ queryKey: ['team-contact-activity', user?.userId], enabled: !!user, refetchInterval: 60000, queryFn: async () => { const { data, error } = await supabase.rpc('get_team_activity'); if (error) throw error; return data as Activity[]; } });
  const current = activity.data?.find(item => item.user_id === detail?.user_id);
  async function toggle(member: ProfileWithRole) { try { await toggleMemberActive(member.id, !member.is_active); toast.success(member.is_active ? 'Account disabled' : 'Account enabled'); } catch { toast.error('Account access could not be changed.'); } }
  return <>{members.map(member => { const work = activity.data?.find(item => item.user_id === member.user_id); return <div key={member.user_id} className={`flex items-center gap-1 rounded-xl ${selected === member.user_id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}><button className="flex min-w-0 flex-1 items-center gap-2.5 p-3 text-left" onClick={() => onSelect(member.user_id)}><Avatar className="h-10 w-10 shrink-0"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{member.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{member.name}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{work?.current_task_title || member.employee_type}</span><span className="mt-1 block"><PresenceBadge userId={member.user_id} enabled={member.is_active} /></span></span>{unread[member.user_id] > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{unread[member.user_id]}</span>}</button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="mr-1 h-8 w-8 shrink-0" aria-label={`Actions for ${member.name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setDetail(member)}><Info className="mr-2 h-4 w-4" />Profile & activity</DropdownMenuItem><DropdownMenuItem disabled={!member.is_active} onClick={() => startAudioCall(member.user_id, member.name)}><Phone className="mr-2 h-4 w-4" />Audio call</DropdownMenuItem><DropdownMenuItem disabled={!member.is_active} onClick={() => { void ringMember(member.user_id, member.name); }}><Bell className="mr-2 h-4 w-4" />Ring member</DropdownMenuItem>{user?.role === 'admin' && <><DropdownMenuItem onClick={() => setEditing(member)}><Pencil className="mr-2 h-4 w-4" />Edit details & access</DropdownMenuItem><DropdownMenuItem onClick={() => { void toggle(member); }}>{member.is_active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}{member.is_active ? 'Disable account' : 'Enable account'}</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div>; })}
    <Sheet open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{detail?.name}</SheetTitle><SheetDescription>{detail?.employee_type}</SheetDescription></SheetHeader>{detail && <div className="mt-5 space-y-5"><PresenceBadge userId={detail.user_id} enabled={detail.is_active} /><p className="text-xs text-muted-foreground">Account access: {detail.is_active ? 'Enabled' : 'Disabled'}</p><section><h3 className="text-sm font-semibold">Current work</h3><p className="mt-2 text-sm text-muted-foreground">{current?.current_task_title || 'No running task'}</p>{current?.task_description && <p className="mt-1 text-xs text-muted-foreground">{current.task_description}</p>}</section>{([['To do',current?.todo_tasks],['In progress',current?.progress_tasks],['Completed today',current?.completed_tasks]] as const).map(([label, tasks]) => <section key={label}><h3 className="text-sm font-semibold">{label} <span className="text-muted-foreground">{tasks?.length || 0}</span></h3><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{tasks?.map((task, index) => <li key={index} className="rounded-lg bg-muted/50 p-2">{task.title}</li>)}</ul></section>)}{activity.error && <p role="alert" className="text-xs text-destructive">Activity could not be loaded.</p>}</div>}</SheetContent></Sheet>
    {editing && <Suspense fallback={null}><EditMemberDialog member={editing} open onOpenChange={open => { if (!open) setEditing(null); }} /></Suspense>}
  </>;
}
