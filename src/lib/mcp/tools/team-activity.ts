import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { runTool } from "../tool-runtime";

export default defineTool({
  name: "team_activity",
  title: "Team activity snapshot",
  description: "Get the current team activity snapshot (admin only). Returns each member's active task and today's todo/progress/completed lists.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx: ToolContext) => runTool("team_activity", input, ctx, async (_, runtime) => {
      if (!runtime.isAdmin) return runtime.fail('Only admins can read the team activity tool.');
      const result = await runtime.client.rpc("get_team_activity");
      runtime.logDbResult("team_activity.rpc", result);
      
      if (result.error) {
        return runtime.fail(result.error.message);
      }

      return runtime.ok("Team activity", result.data ?? [], { activity: result.data ?? [] });
    }),
});
