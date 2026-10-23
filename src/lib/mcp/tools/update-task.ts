import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { runTool } from '../tool-runtime';

export default defineTool({
  name: 'update_task', title: 'Update task', description: 'Update a task title, brief, due date, category or time estimate. Team members update their own work; admins may update any team task. Use complete_task to finish work.',
  inputSchema: { task_id: z.string().uuid(), title: z.string().trim().min(1).max(500).optional(), description: z.string().max(5000).optional(), category: z.string().max(100).optional(), date: z.iso.date().optional(), target_minutes: z.number().int().positive().max(100000).optional() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool('update_task', input, ctx, async ({ task_id, ...updates }, runtime) => {
    if (!Object.values(updates).some(value => value !== undefined)) return runtime.fail('Provide at least one field to update.');
    let query = runtime.client.from('tasks').update(updates).eq('id', task_id);
    if (!runtime.isAdmin) query = query.eq('user_id', runtime.userId);
    const result = await query.select().single();
    if (result.error) return runtime.fail(result.error.message);
    return runtime.ok('Updated task', result.data, { task: result.data });
  }),
});
