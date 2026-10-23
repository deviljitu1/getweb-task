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
    const rawTitle = typeof args.title === 'string' && args.title.trim()
      ? args.title.trim()
      : (typeof args.name === 'string' && args.name.trim() ? args.name.trim() : 'New Task');
    
    const catRaw = typeof args.category === 'string' ? args.category.trim() : 'Other';
    const matchedCategory = TASK_CATEGORIES.find(c => c.toLowerCase() === catRaw.toLowerCase()) || 'Other';
    
    const descRaw = typeof args.description === 'string' ? args.description : '';
    const targetMins = typeof args.target_minutes === 'number' && args.target_minutes > 0 ? args.target_minutes : undefined;
    
    let userId = user.userId;
    if (args.assigned_to && typeof args.assigned_to === 'string') {
      if (user.role !== 'admin') throw new Error('Only admins can assign tasks to other members.');
      const search = args.assigned_to.trim().toLowerCase();
      const match = members.find(m => m.is_active && (m.name.toLowerCase() === search || m.user_id === args.assigned_to));
      if (!match) throw new Error('Member name is missing or ambiguous. Ask for the exact active member name.');
      userId = match.user_id;
    }
    
    const taskId = await context.addTask({
      title: rawTitle,
      description: descRaw,
      category: matchedCategory,
      target_minutes: targetMins,
      date: todayStr(),
      user_id: userId,
    });
    return { task_id: taskId, title: rawTitle };
  }
  if (['update_task', 'delete_task', 'start_timer', 'pause_timer', 'finish_task'].includes(name)) {
    let id = typeof args.task_id === 'string' ? args.task_id.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const search = id.toLowerCase();
      const match = (search ? tasks.find(t => t.id === id || t.title.toLowerCase().includes(search)) : null)
        || tasks.find(t => t.time_sessions?.some(s => s.end_time === null))
        || tasks[0];
      if (match) {
        id = match.id;
      } else {
        throw new Error('Please specify which task you want to manage.');
      }
    }
    const task = tasks.find(t => t.id === id) || (await supabase.from('tasks').select('id,user_id').eq('id', id).single()).data;
    if (!task) throw new Error('Task was not found or is inaccessible.');
    if (user.role !== 'admin' && task.user_id !== user.userId) throw new Error('You can only manage your own tasks.');
    if (name === 'delete_task') await context.deleteTask(id);
    if (name === 'start_timer') {
      if (task.user_id !== user.userId) throw new Error('Start timers only for your own work.');
      if (!tasks.find(t => t.id === id)?.time_sessions?.some(s => s.end_time === null)) await context.startTimer(id);
    }
    if (name === 'pause_timer') await context.pauseTimer(id);
    if (name === 'finish_task') {
      const notes = typeof args.completion_notes === 'string' ? args.completion_notes : undefined;
      const link = typeof args.project_link === 'string' ? args.project_link : undefined;
      await context.finishTask(id, { completion_notes: notes, project_link: link });
    }
    if (name === 'update_task') {
      const updates: Record<string, unknown> = {};
      if (typeof args.target_minutes === 'number') updates.target_minutes = args.target_minutes;
      if (typeof args.status === 'string') updates.status = args.status;
      if (typeof args.title === 'string' && args.title.trim()) updates.title = args.title.trim();
      await context.updateTask(id, updates);
    }
    return { task_id: id, action: name, saved: true };
  }
  if (name === 'send_message') {
    const rawRecipient = typeof args.recipient === 'string' ? args.recipient.trim() : '';
    const content = typeof args.message === 'string' ? args.message.trim() : (typeof args.content === 'string' ? args.content.trim() : '');
    if (!content) throw new Error('Message content cannot be empty.');

    if (/^(team|all|everyone|general)$/i.test(rawRecipient)) {
      const { data: group } = await supabase.from('chat_groups').select('id, name').limit(1).maybeSingle();
      const { error } = await supabase.from('messages').insert({
        sender_id: user.userId,
        group_id: group?.id || null,
        receiver_id: null,
        content: content,
      });
      if (error) throw error;
      return { sent: true, recipient: 'Team', message: content };
    }

    const queries = rawRecipient
      .split(/\s*(?:and|&|,)\s*/i)
      .map(n => n.trim().toLowerCase())
      .filter(Boolean);

    const targetMembers: Array<{ user_id: string; name: string }> = [];

    for (const q of queries) {
      const found = members.filter(m => m.name.toLowerCase().includes(q));
      if (found.length > 0) {
        for (const f of found) {
          if (!targetMembers.some(t => t.user_id === f.user_id)) {
            targetMembers.push(f);
          }
        }
      } else {
        const { data: profileMatches } = await supabase
          .from('profiles')
          .select('user_id, name')
          .ilike('name', `%${q}%`);
        if (profileMatches) {
          for (const f of profileMatches) {
            if (!targetMembers.some(t => t.user_id === f.user_id)) {
              targetMembers.push(f);
            }
          }
        }
      }
    }

    if (targetMembers.length === 0) {
      throw new Error(`Could not find team member(s) matching "${rawRecipient}". Available members: ${members.map(m => m.name).join(', ')}`);
    }

    const sentNames: string[] = [];
    for (const target of targetMembers) {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.userId,
        receiver_id: target.user_id,
        group_id: null,
        content: content,
      });
      if (!error) {
        sentNames.push(target.name);
      }
    }

    return { sent: true, sent_to: sentNames, message: content };
  }
  if (name === 'read_messages') {
    const memberName = typeof args.member_name === 'string' ? args.member_name.trim().toLowerCase() : '';
    let targetUserId: string | null = null;
    if (memberName) {
      const match = members.find(m => m.name.toLowerCase().includes(memberName));
      if (match) targetUserId = match.user_id;
    }

    let query = supabase.from('messages').select('id, content, sender_id, receiver_id, created_at').order('created_at', { ascending: false }).limit(args.limit ? Number(args.limit) : 20);
    if (targetUserId) {
      query = query.or(`and(sender_id.eq.${user.userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.userId})`);
    }
    const { data: msgData, error } = await query;
    if (error) throw error;
    
    const formatted = (msgData || []).map(m => {
      const sender = members.find(mem => mem.user_id === m.sender_id)?.name || (m.sender_id === user.userId ? 'You' : 'Teammate');
      return { from: sender, content: m.content, created_at: m.created_at };
    });
    return { messages: formatted.reverse() };
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
