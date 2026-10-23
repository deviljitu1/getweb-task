import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ToolContext } from '@lovable.dev/mcp-js';

declare const Deno: { env: { get: (name: string) => string | undefined } } | undefined;
type ToolResult = { content: Array<{ type: 'text'; text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean };
export type ToolRuntime = {
  ctx: ToolContext; userId: string; isAdmin: boolean; client: SupabaseClient;
  logDbResult: (operation: string, result: { error?: unknown }) => void;
  ok: (label: string, data: unknown, structuredContent?: Record<string, unknown>) => ToolResult;
  fail: (message: string) => ToolResult;
};
const env = (name: string) => typeof Deno !== 'undefined' ? Deno.env.get(name) : typeof process !== 'undefined' ? process.env[name] : undefined;
export const mcpBackendUrl = () => env('SUPABASE_URL') || import.meta.env?.VITE_SUPABASE_URL || 'https://jrvyhixqvncaoxvrefgu.supabase.co';
const fail = (message: string): ToolResult => ({ content: [{ type: 'text', text: message }], isError: true });

export async function runTaskAction(action: 'start' | 'stop' | 'complete', args: { task_id: string; completion_notes?: string; project_link?: string }, runtime: ToolRuntime) {
  const { task_id, ...details } = args;
  const result = await runtime.client.rpc('automate_task', { task_action: action, target_task: task_id, details });
  if (result.error) return runtime.fail(result.error.message);
  return runtime.ok('Task action completed', result.data, result.data);
}

export async function runTool<T>(toolName: string, input: T, ctx: ToolContext, handler: (input: T, runtime: ToolRuntime) => Promise<ToolResult>) {
  try {
    const token = ctx.getToken();
    if (!ctx.isAuthenticated() || !token || !ctx.getUserId()) return fail('Sign in to use workspace tools.');
    const key = env('SUPABASE_ANON_KEY') || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!key) return fail('The MCP service is not configured.');
    const client = createClient(mcpBackendUrl(), key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || data.user.id !== ctx.getUserId()) return fail('Your connection is no longer authorised. Sign in again.');
    const [profile, role] = await Promise.all([
      client.from('profiles').select('is_active').eq('user_id', data.user.id).maybeSingle(),
      client.from('user_roles').select('role').eq('user_id', data.user.id).eq('role', 'admin').maybeSingle(),
    ]);
    if (profile.error || !profile.data?.is_active) return fail('An enabled team account is required.');
    if (role.error) return fail('Account permissions could not be verified.');
    return await handler(input, {
      ctx, userId: data.user.id, isAdmin: Boolean(role.data), client,
      logDbResult: (operation, result) => { if (result.error) console.warn('[MCP] Database operation failed', { tool: toolName, operation }); },
      ok: (label, value, structuredContent) => ({ content: [{ type: 'text', text: `${label}:\n${JSON.stringify(value)}` }], structuredContent }),
      fail,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The requested action could not be completed.');
  }
}
