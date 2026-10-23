import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../tool-runtime";

export default defineTool({
  name: "list_my_tasks",
  title: "List my tasks",
  description: "List tasks belonging to the signed-in user. Optional filters by date (YYYY-MM-DD) or status.",
  inputSchema: {
    date: z.iso.date().optional().describe("Filter by date (YYYY-MM-DD)"),
    status: z.enum(["Not Started", "In Progress", "Finished"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx: ToolContext) => runTool("list_my_tasks", input, ctx, async ({ date, status, limit }, runtime) => {
      let q = runtime.client
        .from("tasks")
        .select("*")
        .eq("user_id", runtime.userId)
        .order("created_at", { ascending: false })
        .limit(limit ?? 50);
      if (date) q = q.eq("date", date);
      if (status) q = q.eq("status", status);
      const result = await q;
      runtime.logDbResult("list_my_tasks.select", result);

      if (result.error) {
        return runtime.fail(result.error.message);
      }

      return runtime.ok("Tasks", result.data ?? [], { tasks: result.data ?? [] });
    }),
});
