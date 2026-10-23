import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, Handshake, FileText, Receipt, BookOpen, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';

const AddTaskDialog = lazy(() => import('@/components/AddTaskDialog'));
export default function QuickCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const actions = [
    { label: 'Task', icon: ClipboardList, color: 'bg-indigo-500/10 text-indigo-600', path: '' },
    ...(user?.role === 'admin' ? [
      { label: 'Lead', icon: Handshake, color: 'bg-emerald-500/10 text-emerald-600', path: '/crm?new=1' },
      { label: 'Invoice', icon: FileText, color: 'bg-purple-500/10 text-purple-600', path: '/tools/invoices?new=1' },
      { label: 'Expense', icon: Receipt, color: 'bg-amber-500/10 text-amber-600', path: '/tools/finance?new=expense' },
    ] : []),
    { label: 'Note', icon: BookOpen, color: 'bg-sky-500/10 text-sky-600', path: '/tools/notes' },
    { label: 'All tools', icon: Wrench, color: 'bg-muted text-foreground', path: '/tools' },
  ];
  return <><Drawer open={open} onOpenChange={setOpen}><DrawerTrigger asChild><button aria-label="Quick create" className="relative -mt-7 mx-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"><Plus className="h-7 w-7" /></button></DrawerTrigger><DrawerContent className="max-h-[75dvh] rounded-t-3xl"><div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><DrawerHeader className="px-0 pb-4 text-left"><DrawerTitle>Quick create</DrawerTitle><DrawerDescription>Start something without leaving your workspace.</DrawerDescription></DrawerHeader><div className="grid grid-cols-3 gap-3">{actions.map(action => <button key={action.label} className="flex flex-col items-center gap-2 rounded-xl border p-4 text-xs font-medium transition-colors hover:bg-muted/30" onClick={() => { setOpen(false); if (action.path) navigate(action.path); else setTimeout(() => setTaskOpen(true), 180); }}><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.color}`}><action.icon className="h-5 w-5" /></span>{action.label}</button>)}</div></div></DrawerContent></Drawer>{taskOpen && <Suspense fallback={null}><AddTaskDialog trigger={null} open={taskOpen} onOpenChange={setTaskOpen} /></Suspense>}</>;
}
