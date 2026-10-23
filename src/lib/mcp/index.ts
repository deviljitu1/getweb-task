import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyTasks from "./tools/list-my-tasks";
import createTask from "./tools/create-task";
import completeTask from "./tools/complete-task";
import startTimer from "./tools/start-timer";
import stopTimer from "./tools/stop-timer";
import teamActivity from "./tools/team-activity";
import updateTask from './tools/update-task';
import { mcpBackendUrl } from './tool-runtime';

export default defineMcp({
  name: "getweb-task-mcp",
  title: "GetWeb Task",
  version: "0.2.0",
  instructions:
    "Manage tasks and timers in GetWeb. Refer to people as team members. Team members manage their own work; admins may assign, update and complete team tasks and read team activity. Start timers only for yourself. Use complete_task for completion. Each person signs in and approves their own OAuth connection. All actions respect active-account checks and database permissions.",
  auth: auth.oauth.issuer({
    issuer: `${mcpBackendUrl()}/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyTasks, createTask, updateTask, completeTask, startTimer, stopTimer, teamActivity],
});
