import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export default function InfoHint({ title, children }: { title: string; children: React.ReactNode }) {
  return <Popover><PopoverTrigger asChild><button type="button" aria-label={`About ${title}`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Info className="h-3.5 w-3.5" /></button></PopoverTrigger><PopoverContent align="start" className="max-w-[calc(100vw-2rem)] p-3"><p className="text-xs font-semibold">{title}</p><div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</div></PopoverContent></Popover>;
}
