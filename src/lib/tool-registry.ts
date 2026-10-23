import { FileText, Wallet, Link2, ClipboardList, Calculator, BookOpen, type LucideIcon } from 'lucide-react';
export type Tool = { id: string; name: string; description: string; category: 'Finance' | 'Marketing' | 'Productivity'; icon: LucideIcon; path: string; admin?: boolean };
export const WORKSPACE_TOOLS: Tool[] = [
  { id: 'invoices', name: 'Invoice studio', description: 'Create invoices, request advances, record payments and export PDFs.', category: 'Finance', icon: FileText, path: '/tools/invoices', admin: true },
  { id: 'finance', name: 'Finance workspace', description: 'Expenses, subscriptions, assets, team settlements and investment records.', category: 'Finance', icon: Wallet, path: '/tools/finance', admin: true },
  { id: 'utm', name: 'Campaign link builder', description: 'Build consistent UTM links for ads, email and social campaigns.', category: 'Marketing', icon: Link2, path: '/tools/utm' },
  { id: 'brief', name: 'Campaign brief', description: 'Turn a client objective into a reusable team brief and checklist.', category: 'Marketing', icon: ClipboardList, path: '/tools/brief' },
  { id: 'calculator', name: 'Agency calculator', description: 'Estimate campaign ROAS, acquisition cost and project margin.', category: 'Productivity', icon: Calculator, path: '/tools/calculator' },
  { id: 'notes', name: 'Quick notes & checklists', description: 'Keep private working notes and daily checklists on this device.', category: 'Productivity', icon: BookOpen, path: '/tools/notes' },
];
