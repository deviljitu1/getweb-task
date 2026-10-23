import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { MEMBER_TYPES, MemberType, ProfileWithRole } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatJoinDate, getMemberTitle, getTenure } from '@/lib/utils';
import { CalendarDays, Clock, ShieldCheck, Key } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EditMemberDialogProps {
    member: ProfileWithRole;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const EditMemberDialog = ({ member, open, onOpenChange }: EditMemberDialogProps) => {
    const { updateMember, updateMemberPassword } = useData();
    const [name, setName] = useState(member.name);
    const [newPassword, setNewPassword] = useState('');
    const [empType, setEmpType] = useState<MemberType>(member.employee_type);
    const [createdDate, setCreatedDate] = useState(() => {
        // Assuming created_at is date string or timestamp string
        if (member.created_at) {
            return new Date(member.created_at).toISOString().split('T')[0];
        }
        return '';
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setName(member.name);
            setEmpType(member.employee_type);
            if (member.created_at) {
                setCreatedDate(new Date(member.created_at).toISOString().split('T')[0]);
            }
            setNewPassword('');
        }
    }, [open, member]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
            await updateMember(member.id, {
                name: name.trim(),
                employee_type: empType,
                created_at: createdDate ? new Date(createdDate).toISOString() : member.created_at,
            });

            if (newPassword.trim()) {
                const passRes = await updateMemberPassword(member.user_id, newPassword.trim());
                if (passRes.success) {
                    toast({ title: 'Success', description: 'Password updated successfully.' });
                } else {
                    toast({ title: 'Error', description: passRes.error, variant: 'destructive' });
                    return;
                }
            }

            onOpenChange(false);
        } catch {
            toast({ title: 'Could not save profile', description: 'Please try again.', variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    const calculatedTitle = getMemberTitle(empType, createdDate); // Use local state for preview
    const tenure = getTenure(createdDate); // Use local state for preview
    const joinDate = formatJoinDate(createdDate); // Use local state for preview

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] glass-card border-none">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Edit Team Member</DialogTitle>
                </DialogHeader>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3 mb-4 border border-border/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span>Joined: <span className="text-foreground font-medium">{joinDate}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>Tenure: <span className="text-foreground font-medium">{tenure}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Current Title: <span className="text-primary font-bold">{calculatedTitle}</span></span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Full Name</Label>
                        <Input
                            id="edit-name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="John Doe"
                            required
                            maxLength={100}
                            className="bg-background/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Position</Label>
                        <Select value={empType} onValueChange={v => setEmpType(v as MemberType)}>
                            <SelectTrigger className="bg-background/50">
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
                        <p className="text-xs text-muted-foreground mt-1">
                            Changing position will update their calculated title.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-date">Joined Date</Label>
                        <Input
                            id="edit-date"
                            type="date"
                            value={createdDate}
                            onChange={e => setCreatedDate(e.target.value)}
                            required
                            className="bg-background/50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Used to calculate tenure and seniority (e.g. Senior title).
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-password">New Password (Optional)</Label>
                        <Input
                            id="edit-password"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Leave blank to keep current password"
                            className="bg-background/50"
                        />
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting} className="shadow-lg shadow-primary/20">
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EditMemberDialog;
