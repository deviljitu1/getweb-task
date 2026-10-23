import type { MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';
import { Capacitor } from '@capacitor/core';

export const LOCAL_MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const preferenceKey = 'worktracker-local-first';
const downloadedKey = 'worktracker-qwen-downloaded';
let enginePromise: Promise<MLCEngineInterface> | undefined;
let generationQueue: Promise<unknown> = Promise.resolve();
export const supportsLocalAI = () => !Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && 'gpu' in navigator && window.isSecureContext;
export const prefersLocalAI = () => localStorage.getItem(preferenceKey) === 'true';
export const setPrefersLocalAI = (enabled: boolean) => localStorage.setItem(preferenceKey, String(enabled));
export async function isLocalModelCached() {
  if (!supportsLocalAI() || localStorage.getItem(downloadedKey) !== 'true') return false;
  const { hasModelInCache } = await import('@mlc-ai/web-llm');
  return hasModelInCache(LOCAL_MODEL).catch(() => false);
}
export async function loadLocalModel(onProgress?: (progress: InitProgressReport) => void) {
  if (!supportsLocalAI()) throw new Error('Local AI needs a browser with WebGPU support. Groq remains available.');
  if (!enginePromise) {
    enginePromise = (async () => {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
      const worker = new Worker(new URL('../workers/webllm.ts', import.meta.url), { type: 'module' });
      try { const engine = await CreateWebWorkerMLCEngine(worker, LOCAL_MODEL, { initProgressCallback: onProgress }); localStorage.setItem(downloadedKey, 'true'); return engine; }
      catch (error) { worker.terminate(); throw error; }
    })().catch(error => { enginePromise = undefined; throw error; });
  }
  return enginePromise;
}
export async function localChat(messages: Array<{ role: string; content: string | null }>) {
  const run = async () => {
    // Background fallback may only use weights the user already downloaded.
    if (!await isLocalModelCached()) throw new Error('Download the local model first from AI settings.');
    const engine = await loadLocalModel();
    const history = messages.filter(message => ['user', 'assistant'].includes(message.role) && message.content).slice(-6);
    while (history.length && history[0].role !== 'user') history.shift();
    const response = await engine.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a concise digital marketing agency assistant. Answer general questions and help draft ideas. You are offline and have no tools or access to live business records. You cannot create, change, delete, or view tasks, leads, clients, or timers. For any such request explain that the user must switch to Groq agent mode. Never claim an action was completed.' }, ...history.map(message => ({ role: message.role as 'user' | 'assistant', content: message.content!.slice(0, 1200) }))],
      max_tokens: 256, temperature: 0.6,
    });
    return response.choices[0]?.message.content || 'Please try a shorter question.';
  };
  const result = generationQueue.then(run, run);
  generationQueue = result.catch(() => undefined);
  return result;
}
