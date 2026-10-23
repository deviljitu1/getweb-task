import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { runTool, runTaskAction } from '../tool-runtime';

export default defineTool({
  name: 'stop_timer', title: 'Pause timer', description: 'Pause a task timer. Team members pause their own timers; admins may pause team timers.',
  inputSchema: { task_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool('stop_timer', input, ctx, (args, runtime) => runTaskAction('stop', args, runtime)),
});
