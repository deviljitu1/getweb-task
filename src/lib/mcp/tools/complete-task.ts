import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { runTool, runTaskAction } from '../tool-runtime';

export default defineTool({
  name: 'complete_task', title: 'Complete task', description: 'Finish a task and stop its timer in one transaction. Team members submit their own work for approval; admins may complete team work.',
  inputSchema: { task_id: z.string().uuid(), completion_notes: z.string().max(5000).optional(), project_link: z.url().regex(/^https?:\/\//).max(2000).optional() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool('complete_task', input, ctx, (args, runtime) => runTaskAction('complete', args, runtime)),
});
