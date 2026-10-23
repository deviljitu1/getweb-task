import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import InfoHint from '@/components/InfoHint';
export default function ToolHeader({ title, description }: { title: string; description: string }) {
  return <header className="space-y-2"><Link to="/tools" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" />Tools & Resources</Link><div className="flex items-center gap-1"><h1 className="text-2xl font-bold tracking-tight">{title}</h1><InfoHint title={title}>{description}</InfoHint></div></header>;
}
