import { lazy, Suspense, useState } from 'react';
import { Loader2 } from 'lucide-react';

const loadAssistant = () => import('@/components/AIAssistantWidget');
const Assistant = lazy(loadAssistant);
export default function AssistantLauncher({ avoidComposer = false }: { avoidComposer?: boolean }) {
  const position = `fixed ${avoidComposer ? 'bottom-[calc(10rem+env(safe-area-inset-bottom))] md:bottom-28' : 'bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6'} right-4 sm:right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-lg`;
  const [loaded, setLoaded] = useState(false);
  if (loaded) return <Suspense fallback={<div role="status" aria-label="Loading assistant" className={position}><Loader2 className="h-5 w-5 animate-spin" /></div>}><Assistant initialOpen launcherClassName={position} avoidComposer={avoidComposer} /></Suspense>;
  return <button className={`${position} overflow-hidden rounded-full`} onPointerEnter={() => void loadAssistant()} onFocus={() => void loadAssistant()} onClick={() => setLoaded(true)} aria-label="Open AI Assistant" title="Open Milo"><img src="/images/assistant-cat.png" alt="" className="h-full w-full object-contain" width="48" height="48" /></button>;
}

