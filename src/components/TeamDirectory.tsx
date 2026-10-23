import { Bell, MoreVertical, Pencil, Phone, Search, Trash2, UserCheck, UserX } from 'lucide-react';
import type { ProfileWithRole } from '@/types';
import PresenceBadge from '@/components/PresenceBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = {
  members: ProfileWithRole[];
  search: string;
  onSearch: (value: string) => void;
  onCall: (member: ProfileWithRole) => void;
  onRing: (member: ProfileWithRole) => void;
  onEdit: (member: ProfileWithRole) => void;
  onToggle: (member: ProfileWithRole) => void;
  onDelete: (member: ProfileWithRole) => void;
};

export default function TeamDirectory({ members, search, onSearch, onCall, onRing, onEdit, onToggle, onDelete }: Props) {
  const actions = (member: ProfileWithRole) => <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Actions for ${member.name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem disabled={!member.is_active} onClick={() => onCall(member)}><Phone className="mr-2 h-4 w-4" />Audio call</DropdownMenuItem>
      <DropdownMenuItem disabled={!member.is_active} onClick={() => onRing(member)}><Bell className="mr-2 h-4 w-4" />Ring member</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onEdit(member)}><Pencil className="mr-2 h-4 w-4" />Edit details</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onToggle(member)}>{member.is_active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}{member.is_active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(member)}><Trash2 className="mr-2 h-4 w-4" />Delete member</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
  const avatar = (member: ProfileWithRole) => <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{member.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</AvatarFallback></Avatar>;
  const status = (member: ProfileWithRole) => <PresenceBadge userId={member.user_id} enabled={member.is_active} />;

  return <Card className="overflow-hidden shadow-sm">
    <CardHeader className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
      <div className="flex items-center gap-2"><CardTitle className="text-sm font-semibold">Team members</CardTitle><Badge variant="secondary" className="text-xs">{members.length}</Badge><span className="text-xs text-muted-foreground">{members.filter(member => member.is_active).length} enabled</span></div>
      <div className="relative sm:w-60"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input aria-label="Search team" placeholder="Search name or department…" value={search} onChange={event => onSearch(event.target.value)} className="h-9 bg-background pl-8 text-sm" /></div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="divide-y sm:hidden">{members.map(member => <div key={member.id} className="flex min-w-0 items-center gap-2.5 px-3 py-3">
        {avatar(member)}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{member.employee_type}</p></div>{status(member)}{actions(member)}
      </div>)}</div>
      <div className="hidden sm:block"><Table><TableHeader className="bg-muted/40"><TableRow><TableHead className="h-9 pl-4 text-xs">Member</TableHead><TableHead className="h-9 text-xs">Department</TableHead><TableHead className="h-9 text-xs">Status</TableHead><TableHead className="h-9 pr-4 text-right text-xs">Actions</TableHead></TableRow></TableHeader><TableBody>{members.map(member => <TableRow key={member.id}>
        <TableCell className="py-2.5 pl-4"><div className="flex items-center gap-2.5">{avatar(member)}<span className="text-sm font-medium">{member.name}</span></div></TableCell><TableCell className="py-2.5 text-xs text-muted-foreground">{member.employee_type}</TableCell><TableCell className="py-2.5">{status(member)}</TableCell><TableCell className="py-2 pr-4 text-right">{actions(member)}</TableCell>
      </TableRow>)}</TableBody></Table></div>
      {!members.length && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{search ? 'No matching team members.' : 'No team members yet. Add your first teammate above.'}</div>}
    </CardContent>
  </Card>;
}
