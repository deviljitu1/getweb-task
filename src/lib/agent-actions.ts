import { z } from 'zod';
import type { useData } from '@/contexts/DataContext';
import type { AuthUser, ProfileWithRole, TaskWithSessions } from '@/types';
import { TASK_CATEGORIES } from '@/types';
import { LEAD_SOURCES, LEAD_STAGES } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';
import { todayStr } from '@/lib/utils';
import { isOnline } from '@/lib/offlineSync';

type Actions = Pick<ReturnType<typeof useData>, 'addTask' | 'updateTask' | 'deleteTask' | 'startTimer' | 'pauseTimer' | 'finishTask'>;
type Context = Actions & { user: AuthUser; members: ProfileWithRole[]; tasks: TaskWithSessions[] };
const idSchema = z.string().uuid();
const title = z.string().trim().min(1).max(500);
const text = z.string().max(5000);
const amount = z.number().finite().nonnegative().max(1e9);

export async function executeAgentAction(name: string, args: Record<string, unknown>, context: Context) {
  if (!context.user.isActive) throw new Error('This account is inactive.');
  if (!isOnline()) throw new Error('Actions require a connection. No changes were made by the assistant.');
  const { user, tasks, members } = context;
  if (name === 'list_my_tasks') {
    const input = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), scope: z.enum(['mine', 'team']).default('mine') }).strict().parse(args);
    if (input.scope === 'team' && user.role !== 'admin') throw new Error('Only admins can read team task records.');
    let query = supabase.from('tasks').select('id,title,status,user_id,date,target_minutes,time_sessions(id,start_time,end_time)').order('date', { ascending: false }).limit(150);
    if (input.scope === 'mine') query = query.eq('user_id', user.userId);
    if (input.date) query = query.eq('date', input.date);
    const { data, error } = await query;
    if (error) throw error;
    return { tasks: data, limit: 150 };
  }
  if (name === 'create_task') {
    const input = z.object({ title, description: text.default(''), category: z.string().refine(v => TASK_CATEGORIES.includes(v)).default('Other'), target_minutes: z.number().positive().max(100000).optional(), assigned_to: title.optional() }).strict().parse(args);
    let userId = user.userId;
    if (input.assigned_to) {
      if (user.role !== 'admin') throw new Error('Only admins can assign tasks to other members.');
      const matches = members.filter(m => m.is_active && (m.name.toLowerCase() === input.assigned_to!.toLowerCase() || m.user_id === input.assigned_to));
      if (matches.length !== 1) throw new Error('Member name is missing or ambiguous. Ask for the exact active member name.');
      userId = matches[0].user_id;
    }
    const taskId = await context.addTask({ ...input, date: todayStr(), user_id: userId });
    return { task_id: taskId, title: input.title };
  }
  if (['update_task', 'delete_task', 'start_timer', 'pause_timer', 'finish_task'].includes(name)) {
    const id = idSchema.parse(args.task_id);
    // Re-read to support a newly created task in the same conversation and enforce permissions.
    const { data: task, error } = await supabase.from('tasks').select('id,user_id').eq('id', id).single();
    if (error || !task) throw new Error('Task was not found or is inaccessible.');
    if (user.role !== 'admin' && task.user_id !== user.userId) throw new Error('You can only manage your own tasks.');
    if (name === 'delete_task') await context.deleteTask(id);
    if (name === 'start_timer') {
      if (task.user_id !== user.userId) throw new Error('Start timers only for your own work. Assign the task owner instead.');
      if (!tasks.find(t => t.id === id)?.time_sessions?.some(s => s.end_time === null)) await context.startTimer(id);
    }
    if (name === 'pause_timer') await context.pauseTimer(id);
    if (name === 'finish_task') {
      if (!tasks.some(t => t.id === id)) throw new Error('The task was just created. Refresh before completing it.');
      const input = z.object({ task_id: idSchema, completion_notes: text.optional(), project_link: z.string().url().optional() }).strict().parse(args);
      await context.finishTask(id, input);
    }
    if (name === 'update_task') {
      const input = z.object({ task_id: idSchema, target_minutes: z.number().positive().max(100000).optional(), status: z.enum(['Not Started', 'In Progress']).optional() }).strict().parse(args);
      const { task_id: _id, ...updates } = input;
      if (!Object.keys(updates).length) throw new Error('No changes were supplied.');
      await context.updateTask(id, updates);
    }
    return { task_id: id, action: name, saved: true };
  }
  if (user.role !== 'admin') throw new Error('CRM actions require an admin account.');
  if (name === 'read_crm') {
    const responses = await Promise.all([
      supabase.from('agency_leads').select('*').order('updated_at', { ascending: false }).limit(100),
      supabase.from('clients').select('*').limit(100),
      supabase.from('projects').select('*').limit(100),
    ]);
    for (const response of responses) if (response.error) throw response.error;
    return { leads: responses[0].data, clients: responses[1].data, projects: responses[2].data, limit: 'Maximum 100 per collection; may be partial.' };
  }
  if (name === 'create_lead') {
    const input = z.object({ name: title, company: title, email: z.string().email().optional(), phone: z.string().max(80).optional(), source: z.enum(LEAD_SOURCES as [string, ...string[]]).default('Other'), monthly_value: amount.default(0), notes: text.optional() }).strict().parse(args);
    const { data, error } = await supabase.from('agency_leads').insert({ ...input, created_by: user.userId }).select('id,name,stage').single();
    if (error) throw error;
    return data;
  }
  if (name === 'update_lead') {
    const input = z.object({ lead_id: idSchema, stage: z.enum(LEAD_STAGES).optional(), next_follow_up: z.string().datetime({ offset: true }).nullable().optional(), monthly_value: amount.optional() }).strict().parse(args);
    const { lead_id, ...updates } = input;
    if (!Object.keys(updates).length) throw new Error('No changes were supplied.');
    const { data, error } = await supabase.from('agency_leads').update(updates).eq('id', lead_id).select('id,name,stage,next_follow_up').single();
    if (error) throw error;
    return data;
  }
  if (name === 'add_lead_note') {
    const input = z.object({ lead_id: idSchema, kind: z.enum(['Note', 'Call', 'Email', 'Meeting']).default('Note'), body: title }).strict().parse(args);
    const { data, error } = await supabase.from('lead_activities').insert({ ...input, created_by: user.userId }).select('id').single();
    if (error) throw error;
    return { ...data, recorded: true, message_sent: false };
  }
  if (name === 'convert_lead') {
    const input = z.object({ lead_id: idSchema }).strict().parse(args);
    const { data, error } = await supabase.rpc('convert_agency_lead', input);
    if (error) throw error;
    return { client_id: data };
  }
  throw new Error('Unsupported action. No changes were made.');
}
