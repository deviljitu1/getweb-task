import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { runTool, runTaskAction } from '../tool-runtime';

export default defineTool({
  name: 'start_timer', title: 'Start timer', description: 'Start your own task timer. Repeating the call keeps the same running session.',
  inputSchema: { task_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool('start_timer', input, ctx, (args, runtime) => runTaskAction('start', args, runtime)),
});
