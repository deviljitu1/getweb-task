import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  mobileValue?: string | number;
}

const StatCard = ({ icon: Icon, label, value, mobileValue }: StatCardProps) => <>
  <Popover><PopoverTrigger asChild><button aria-label={`${label}: ${value}`} className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-2.5 shadow-sm sm:hidden"><Icon className="h-5 w-5 text-primary" /><span className="text-base font-bold tabular-nums">{mobileValue ?? value}</span></button></PopoverTrigger><PopoverContent className="w-auto max-w-64 p-3 text-sm"><p className="font-medium">{label}</p><p className="text-muted-foreground">{value}</p></PopoverContent></Popover>
  <Card className="hidden min-w-0 items-center gap-4 p-4 shadow-sm sm:flex"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tracking-tight">{value}</p></div></Card>
</>;

export default StatCard;
