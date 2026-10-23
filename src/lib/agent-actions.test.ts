import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAgentAction } from './agent-actions';
import type { AuthUser, ProfileWithRole } from '@/types';

vi.mock('@/lib/offlineSync', () => ({ isOnline: () => true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
const user: AuthUser = { id: 'profile', userId: 'user', name: 'Test', email: 'test@example.com', memberType: 'Other', isActive: true, role: 'employee' };
const actions = { addTask: vi.fn().mockResolvedValue('new-task'), updateTask: vi.fn(), deleteTask: vi.fn(), startTimer: vi.fn(), pauseTimer: vi.fn(), finishTask: vi.fn() };
const context = { ...actions, user, members: [] as ProfileWithRole[], tasks: [] };

describe('agent action permissions and assignment', () => {
  beforeEach(() => vi.clearAllMocks());
  it('denies CRM tools for employees', async () => {
    await expect(executeAgentAction('read_crm', {}, context)).rejects.toThrow('admin');
  });
  it('does not silently self-assign a task when another member cannot be resolved', async () => {
    await expect(executeAgentAction('create_task', { title: 'Design', assigned_to: 'Missing' }, { ...context, user: { ...user, role: 'admin' } })).rejects.toThrow('ambiguous');
    expect(actions.addTask).not.toHaveBeenCalled();
  });
  it('rejects assignment by an employee before creating anything', async () => {
    await expect(executeAgentAction('create_task', { title: 'Design', assigned_to: 'Other' }, context)).rejects.toThrow('Only admins');
    expect(actions.addTask).not.toHaveBeenCalled();
  });
  it('returns the newly created ID and uses the signed-in owner', async () => {
    const result = await executeAgentAction('create_task', { title: 'Design', category: 'Design' }, context);
    expect(result).toEqual({ task_id: 'new-task', title: 'Design' });
    expect(actions.addTask).toHaveBeenCalledWith(expect.objectContaining({ user_id: user.userId }));
  });
  it('rejects an inactive account', async () => {
    await expect(executeAgentAction('create_task', { title: 'Design' }, { ...context, user: { ...user, isActive: false } })).rejects.toThrow('inactive');
    expect(actions.addTask).not.toHaveBeenCalled();
  });
});
