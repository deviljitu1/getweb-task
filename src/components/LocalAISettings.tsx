import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isLocalModelCached, loadLocalModel, prefersLocalAI, setPrefersLocalAI, supportsLocalAI } from '@/lib/local-ai';

export default function LocalAISettings() {
  return Capacitor.isNativePlatform() ? null : <BrowserAISettings />;
}

function BrowserAISettings() {
  const [cached, setCached] = useState(false);
  const [enabled, setEnabled] = useState(prefersLocalAI);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void isLocalModelCached().then(value => { if (active) setCached(value); }).catch(() => undefined); return () => { active = false; }; }, []);
  async function download() {
    setLoading(true); setError('');
    try { await loadLocalModel(report => setProgress(report.text)); setCached(true); }
    catch (error) { setError(error instanceof Error ? error.message : 'Download failed. Please try again.'); }
    finally { setLoading(false); }
  }
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Milo settings"><Settings2 className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent align="end" className="max-h-[65dvh] w-72 overflow-y-auto rounded-xl text-xs"><div className="mt-3 space-y-3 pb-1"><p className="leading-relaxed text-muted-foreground">Optional on-device chat. Download around 290 MB once in a compatible browser.</p>{!supportsLocalAI() ? <p className="text-muted-foreground">On-device chat is unavailable in this browser.</p> : <><Button size="sm" variant="outline" className="w-full text-xs" disabled={loading || cached} onClick={download}>{loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}{loading ? 'Preparing local model…' : cached ? 'Qwen downloaded on this device' : 'Download Qwen for offline chat'}</Button>{loading && <p role="status" className="break-words text-muted-foreground">{progress}</p>}<label className="flex cursor-pointer items-center justify-between gap-3"><span>Prefer on-device chat<span className="mt-0.5 block text-[10px] text-muted-foreground">Chat only; switch off for task actions.</span></span><Switch aria-label="Prefer local chat" checked={enabled} disabled={!cached || loading} onCheckedChange={value => { setEnabled(value); setPrefersLocalAI(value); }} /></label></>}{error && <p role="alert" className="break-words text-destructive">{error}</p>}</div></PopoverContent></Popover>;
}

