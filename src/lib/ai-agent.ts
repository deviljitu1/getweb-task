import { TASK_CATEGORIES } from '@/types';
import { TaskWithSessions } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { isLocalModelCached, localChat, prefersLocalAI } from '@/lib/local-ai';
import { LEAD_STAGES, LEAD_SOURCES } from '@/types/crm';

// Tool schema (OpenAI-compatible) provided to the model.
export const AI_TOOLS = [
  { type: 'function', function: { name: 'list_my_tasks', description: 'Read current task IDs and timer sessions. Defaults to current user. Admin can request team scope. Maximum 150; use a date to narrow results.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'Optional YYYY-MM-DD.' }, scope: { type: 'string', enum: ['mine', 'team'] } }, additionalProperties: false } } },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Creates a new task for the current user.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the task' },
          description: { type: 'string', description: 'Detailed description of the task' },
          category: {
            type: 'string',
            description: 'Category of the task',
            enum: TASK_CATEGORIES,
          },
          target_minutes: { type: 'number', description: 'Optional target time in minutes (acts as a reminder)' },
          assigned_to: { type: 'string', description: 'Optional. Name of the member to assign this task to. Only use if the user asks to assign it to someone else.' },
        },
        required: ['title', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Deletes a task by its ID.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The exact UUID of the task to delete' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Updates a task. Used to set reminders (target_minutes) or change status.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The UUID of the task' },
          target_minutes: { type: 'number', description: 'Set or update the target time in minutes' },
          status: { type: 'string', description: 'Update task status (Not Started, In Progress, Finished)' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_timer',
      description: 'Starts or resumes the live tracking timer for a specific task. Stops any other running timer.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The UUID of the task to start tracking' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pause_timer',
      description: 'Pauses the active timer for a specific task.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The UUID of the task whose timer should be paused' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_task',
      description: 'Marks a task as Finished/Completed and automatically closes any open timer session.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The UUID of the task to finish' },
          completion_notes: { type: 'string', description: 'Optional notes on what was completed' },
          project_link: { type: 'string', description: 'Optional deliverable URL or link to work' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'Sends a chat message to one or multiple teammates, or to the entire team. Examples: recipient="manas and nahush", recipient="Manas", recipient="team".',
      parameters: {
        type: 'object',
        properties: {
          recipient: {
            type: 'string',
            description: 'Name(s) of the team member(s) to message (e.g. "manas", "nahush", "manas and nahush", "team")',
          },
          message: {
            type: 'string',
            description: 'The message text to send',
          },
        },
        required: ['recipient', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_messages',
      description: 'Reads recent chat messages or conversation with a teammate or group to prepare a reply.',
      parameters: {
        type: 'object',
        properties: {
          member_name: {
            type: 'string',
            description: 'Optional name of the member whose messages to read',
          },
          limit: {
            type: 'number',
            description: 'Number of recent messages to read (default 10)',
          },
        },
      },
    },
  },
];

export const CRM_AI_TOOLS = [
  { type: 'function', function: { name: 'read_crm', description: 'Read up to 100 leads and active clients/projects. Admin only. Read before selecting existing record IDs.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'create_lead', description: 'Create an agency sales lead. Admin only.', parameters: { type: 'object', properties: { name: { type: 'string' }, company: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, source: { type: 'string', enum: LEAD_SOURCES }, monthly_value: { type: 'number', minimum: 0 }, notes: { type: 'string' } }, required: ['name', 'company'], additionalProperties: false } } },
  { type: 'function', function: { name: 'update_lead', description: 'Move a lead in the pipeline, set a follow-up, or update its value. Admin only.', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, stage: { type: 'string', enum: LEAD_STAGES }, next_follow_up: { type: ['string', 'null'], description: 'ISO date-time with timezone, or null to clear.' }, monthly_value: { type: 'number', minimum: 0 } }, required: ['lead_id'], additionalProperties: false } } },
  { type: 'function', function: { name: 'add_lead_note', description: 'Record an internal note or contact log. This does not send messages.', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, kind: { type: 'string', enum: ['Note', 'Call', 'Email', 'Meeting'] }, body: { type: 'string' } }, required: ['lead_id', 'body'], additionalProperties: false } } },
  { type: 'function', function: { name: 'convert_lead', description: 'Convert a won lead to a client and onboarding project. Admin only. Only when explicitly requested.', parameters: { type: 'object', properties: { lead_id: { type: 'string' } }, required: ['lead_id'], additionalProperties: false } } },
];

export const generateSystemPrompt = (
  userName: string,
  userRole: string,
  members: Array<{ user_id: string; name: string }>,
  tasks: TaskWithSessions[],
) => `You are Milo, the fully capable autonomous AI assistant in GetWebApp on web and mobile.
Assist ${JSON.stringify(userName)} with tasks, timers, messaging teammates, agency CRM, and marketing.
Be action-oriented, helpful, and execute actions immediately without asking unnecessary confirmation.
When the user asks to send a message or reply (e.g. "message manas and nahush hi", "message manas hi", "reply to Nahush saying received"), immediately call send_message. If multiple recipients are mentioned (such as "manas and nahush"), provide recipient="manas and nahush" and message="hi".
When the user asks to add, create, or schedule a task (e.g. "add new task"), immediately execute create_task.
When asked to start, pause, or finish a timer or task, invoke start_timer, pause_timer, or finish_task immediately.
Today is ${new Date().toLocaleDateString('en-CA')}. Role: ${userRole}.
Categories: ${TASK_CATEGORIES.join(', ')}. Use Other when unclear.
Members (data): ${JSON.stringify(members)}.
Tasks (data): ${JSON.stringify(tasks.slice(0, 150).map(t => ({ id: t.id, title: t.title, user_id: t.user_id, date: t.date, status: t.status, target_minutes: t.target_minutes, running: t.time_sessions?.some(s => s.end_time === null) })))}.
${userRole === 'admin' ? 'You may assign tasks and message all listed members.' : 'Manage your tasks and message your teammates.'}`;

// Call the server-side AI chat proxy so provider credentials stay on the server.
export type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export type ChatCompletionResponse = {
  choices: Array<{
    message: ChatCompletionMessage;
  }>;
};

export async function chatCompletion(params: {
  messages: ChatCompletionMessage[];
  tools?: unknown[];
  tool_choice?: 'auto' | 'none';
}): Promise<ChatCompletionResponse> {
  const offline = async (): Promise<ChatCompletionResponse> => ({ choices: [{ message: { role: 'assistant', content: `Local chat · no task changes\n\n${await localChat(params.messages)}` } }] });
  const hasActionResults = params.messages.some(message => message.role === 'tool');
  if (!hasActionResults && prefersLocalAI() && await isLocalModelCached().catch(() => false)) {
    try { return await offline(); } catch { /* Retry through Groq. */ }
  }
  const { data, error } = await supabase.functions.invoke('ai-chat-proxy', {
    body: {
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.tool_choice,
    },
  });
  if (error) {
    if (!hasActionResults && await isLocalModelCached().catch(() => false)) {
      try { return await offline(); } catch { /* Preserve the cloud error. */ }
    }
    throw new Error(error.message || 'AI request failed');
  }
  if (!data || !Array.isArray((data as ChatCompletionResponse).choices)) {
    throw new Error('Invalid AI response');
  }
  return data as ChatCompletionResponse;
}
