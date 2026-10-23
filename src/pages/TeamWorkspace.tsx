import { lazy, Suspense } from 'react';
const Chat = lazy(() => import('@/pages/Chat'));
export default function TeamWorkspace() {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading team workspace…</p>}><Chat /></Suspense>;
}
