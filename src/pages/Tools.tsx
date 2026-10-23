import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { WORKSPACE_TOOLS } from '@/lib/tool-registry';

export default function Tools() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const tools = WORKSPACE_TOOLS.filter(tool => (!tool.admin || user?.role === 'admin') && `${tool.name} ${tool.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary"><Wrench className="h-3.5 w-3.5" />Your workspace toolkit</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tools & Resources</h1><p className="mt-1 hidden text-sm text-muted-foreground sm:block">Everyday tools for your agency and product team.</p></div><div className="relative sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="bg-card pl-9" aria-label="Search tools" placeholder="Find a tool…" value={search} onChange={event => setSearch(event.target.value)} /></div></header>
    {(['Finance', 'Marketing', 'Productivity'] as const).map(category => { const group = tools.filter(tool => tool.category === category); return group.length > 0 && <section key={category} className="space-y-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h2><div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">{group.map(tool => <Link key={tool.id} to={tool.path} className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center shadow-sm sm:flex-row sm:items-start sm:gap-3 sm:p-4 sm:text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.02] focus-visible:outline-primary"><div className="flex h-9 w-9 shrink-0 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><tool.icon className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0 flex-1"><h3 className="flex items-center justify-center gap-2 text-xs font-semibold sm:justify-between sm:text-sm"><span className="sm:hidden">{{ invoices: 'Invoice', finance: 'Finance', utm: 'UTM links', brief: 'Campaign brief', calculator: 'Calculator', notes: 'Notes' }[tool.id] || tool.name}</span><span className="hidden sm:inline">{tool.name}</span><ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 sm:block text-muted-foreground group-hover:text-primary" /></h3><p className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block">{tool.description}</p></div></Link>)}</div></section>; })}
    {!tools.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No tools match your search.</p>}
  </div>;
}
