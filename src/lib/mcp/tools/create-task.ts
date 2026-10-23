import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../tool-runtime";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description: "Create a task for yourself. Admins may assign it to an enabled team member using their user ID from team_activity.",
  inputSchema: {
    title: z.string().trim().min(1).max(500),
    description: z.string().max(5000).optional(),
    category: z.string().max(100).optional().describe("Task category e.g. Development, Design, Video, Ads"),
    date: z.iso.date().describe("Date in YYYY-MM-DD"),
    target_minutes: z.number().int().positive().max(100000).optional(),
    assigned_user_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx: ToolContext) => runTool("create_task", input, ctx, async (args, runtime) => {
      const owner = args.assigned_user_id || runtime.userId;
      if (owner !== runtime.userId) {
        if (!runtime.isAdmin) return runtime.fail('Only admins can assign tasks to other team members.');
        const { data, error } = await runtime.client.from('profiles').select('user_id').eq('user_id', owner).eq('is_active', true).maybeSingle();
        if (error || !data) return runtime.fail('The selected team account is unavailable.');
      }
      const result = await runtime.client
        .from("tasks")
        .insert({
          user_id: owner,
          title: args.title,
          description: args.description ?? null,
          category: args.category ?? "Development",
          date: args.date,
          target_minutes: args.target_minutes ?? null,
          status: "Not Started",
        })
        .select()
        .single();
      runtime.logDbResult("create_task.insert", result);

      if (result.error) {
        return runtime.fail(result.error.message);
      }

      return runtime.ok("Created task", result.data, { task: result.data });
    }),
});
