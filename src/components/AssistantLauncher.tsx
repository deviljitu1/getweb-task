import { lazy, Suspense, useState } from 'react';
import { Loader2 } from 'lucide-react';

const Assistant = lazy(() => import('@/components/AIAssistantWidget'));
const position = 'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-lg sm:bottom-6 sm:right-6';

export default function AssistantLauncher() {
  const [loaded, setLoaded] = useState(false);
  if (loaded) return <Suspense fallback={<div role="status" aria-label="Loading assistant" className={position}><Loader2 className="h-5 w-5 animate-spin" /></div>}><Assistant initialOpen /></Suspense>;
  return <button className={`${position} overflow-hidden rounded-full`} onClick={() => setLoaded(true)} aria-label="Open AI Assistant" title="Open Milo"><img src="/images/assistant-cat.png" alt="" className="h-full w-full object-contain" width="48" height="48" /></button>;
}

