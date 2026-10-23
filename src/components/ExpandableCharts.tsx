import { lazy, Suspense, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { TaskWithSessions } from '@/types';
const Charts = lazy(() => import('@/components/DashboardCharts'));
export default function ExpandableCharts({ tasks }: { tasks: TaskWithSessions[] }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-xl border bg-card" onToggle={event => setOpen(event.currentTarget.open)}><summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold"><BarChart3 className="h-4 w-4 text-primary" />Task analytics<span className="ml-auto text-[10px] font-normal text-muted-foreground">{open ? 'Collapse' : 'Expand'}</span></summary>{open && <div className="p-3 pt-0"><Suspense fallback={<div role="status" className="h-40 animate-pulse rounded-lg bg-muted/50" />}><Charts tasks={tasks} /></Suspense></div>}</details>;
}
