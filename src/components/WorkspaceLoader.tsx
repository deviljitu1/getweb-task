export default function WorkspaceLoader({ compact = false }: { compact?: boolean }) {
  return <div role="status" aria-label="Loading workspace" className={`flex items-center justify-center bg-background ${compact ? 'min-h-48 rounded-xl' : 'min-h-dvh'}`}><div className="flex flex-col items-center gap-3"><img src="/images/getweb-loader.svg" alt="" width={128} height={128} className="h-28 w-28 object-contain motion-safe:animate-[getweb-loader_1.8s_ease-in-out_infinite] sm:h-32 sm:w-32" /><span className="text-xs text-muted-foreground">Loading workspace…</span></div></div>;
}
