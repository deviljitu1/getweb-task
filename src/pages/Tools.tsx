import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import InfoHint from '@/components/InfoHint';
import { WORKSPACE_TOOLS } from '@/lib/tool-registry';

const shortNames: Record<string, string> = { invoices: 'Invoice', finance: 'Finance', utm: 'UTM links', brief: 'Campaign brief', calculator: 'Calculator', notes: 'Notes' };
export default function Tools() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const tools = WORKSPACE_TOOLS.filter(tool => (!tool.admin || user?.role === 'admin') && `${tool.name} ${tool.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex items-center gap-1"><h1 className="text-2xl font-bold tracking-tight">Tools & Resources</h1><InfoHint title="Tools & Resources">Everyday tools for your agency and product team.</InfoHint></div><div className="relative sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="bg-card pl-9" aria-label="Search tools" placeholder="Find a tool…" value={search} onChange={event => setSearch(event.target.value)} /></div></header>
    {(['Finance', 'Marketing', 'Productivity'] as const).map(category => {
      const group = tools.filter(tool => tool.category === category);
      return group.length > 0 && <section key={category} className="space-y-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h2><div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">{group.map(tool => <article key={tool.id} className="relative rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/50 focus-within:border-primary"><Link to={tool.path} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 text-center focus-visible:outline-primary sm:min-h-24 sm:flex-row sm:justify-start sm:gap-3 sm:pr-10 sm:text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><tool.icon className="h-5 w-5" /></span><h3 className="text-xs font-semibold sm:text-sm"><span className="sm:hidden">{shortNames[tool.id] || tool.name}</span><span className="hidden sm:inline">{tool.name}</span></h3></Link><div className="absolute right-1 top-1"><InfoHint title={tool.name}>{tool.description}</InfoHint></div></article>)}</div></section>;
    })}
    {!tools.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No tools match your search.</p>}
  </div>;
}
