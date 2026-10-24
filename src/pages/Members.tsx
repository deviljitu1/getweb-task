import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { MEMBER_TYPES, MemberType, ProfileWithRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getMemberTitle } from '@/lib/utils';
import EditMemberDialog from '@/components/EditMemberDialog';
import { useCall } from '@/components/CallModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Seo from "@/components/Seo";
import TeamDirectory from "@/components/TeamDirectory";

const Members = ({ dialogOnly = false, onClose }: { dialogOnly?: boolean; onClose?: () => void }) => {
  const { user } = useAuth();
  const { members, toggleMemberActive, refreshMembers, loading, deleteMember } = useData();
  const { startAudioCall, ringMember } = useCall();
  const [open, setInternalOpen] = useState(dialogOnly);
  const setOpen = (value: boolean) => { setInternalOpen(value); if (!value && dialogOnly) onClose?.(); };
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [empType, setEmpType] = useState<MemberType>('Developer');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingMember, setEditingMember] = useState<ProfileWithRole | null>(null);
  const [deletingMember, setDeletingMember] = useState<ProfileWithRole | null>(null);

  const memberList = members
    .filter(e => user?.role === 'admin' || e.user_id === user?.userId || e.role === 'employee')
    .filter(e => (e.name + ' ' + (e.employee_type || '') + ' ' + (e.role || '')).toLowerCase().includes(searchQuery.toLowerCase()));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          employee_type: empType,
          role: 'employee',
        },
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      if (data?.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Success', description: 'Team member created successfully' });
      setName('');
      setEmail('');
      setPassword('');
      setEmpType('Developer');
      setOpen(false);
      await refreshMembers();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (profileId: string, currentActive: boolean) => {
    await toggleMemberActive(profileId, !currentActive);
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    try {
      await deleteMember(deletingMember.id, deletingMember.user_id);
      toast({ title: 'Success', description: `${deletingMember.name} deleted from database` });
      setDeletingMember(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete user from database', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!dialogOnly && <Seo title="Team Members — GetWebApp" description="Manage your team members, their roles, and access inside your GetWebApp workspace." path="/members" noindex />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div hidden={dialogOnly}>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your team members and their roles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {!dialogOnly && <DialogTrigger asChild>
            <Button className="w-fit gap-1.5">
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>}
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="emp-name">Full Name</Label>
                <Input
                  id="emp-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-password">Password</Label>
                <Input
                  id="emp-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={empType} onValueChange={v => setEmpType(v as MemberType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating...' : 'Add Team Member'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!dialogOnly && <TeamDirectory members={memberList} search={searchQuery} onSearch={setSearchQuery} onCall={member => startAudioCall(member.user_id, member.name)} onRing={member => { void ringMember(member.user_id, member.name); }} onEdit={setEditingMember} onToggle={member => { void handleToggle(member.id, member.is_active); }} onDelete={setDeletingMember} />}

      {editingMember && (
        <EditMemberDialog
          member={editingMember}
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
        />
      )}

      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user from database?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete
              <span className="font-semibold text-foreground"> {deletingMember?.name}</span> ({deletingMember?.role}) from the database along with all their tasks, timer logs, and auth records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Members;
