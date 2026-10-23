import { describe, expect, it, vi } from 'vitest';
import { runAgent } from './agent-runner';
import type { ChatCompletionResponse } from './ai-agent';

const call = (id: string, name: string, args = '{}'): ChatCompletionResponse => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: args } }] } }] });
const answer: ChatCompletionResponse = { choices: [{ message: { role: 'assistant', content: 'Done.' } }] };

describe('unified agent', () => {
  it('feeds a created ID back so the assistant can start its timer next', async () => {
    const complete = vi.fn().mockResolvedValueOnce(call('one', 'create_task')).mockResolvedValueOnce(call('two', 'start_timer', '{"task_id":"new-id"}')).mockResolvedValueOnce(answer);
    const execute = vi.fn().mockResolvedValueOnce({ task_id: 'new-id' }).mockResolvedValueOnce({ saved: true });
    const result = await runAgent([{ role: 'user', content: 'Create a task and start it' }], [], complete, execute);
    expect(execute.mock.calls).toEqual([['create_task', {}], ['start_timer', { task_id: 'new-id' }]]);
    expect(complete.mock.calls[1][0].messages.at(-1)?.content).toContain('new-id');
    expect(result.text).toBe('Done.');
  });
  it('returns database errors to the model without claiming a successful action', async () => {
    const complete = vi.fn().mockResolvedValueOnce(call('one', 'update_lead')).mockResolvedValueOnce(answer);
    const execute = vi.fn().mockRejectedValue({ message: 'Permission denied' });
    const result = await runAgent([], [], complete, execute);
    expect(result.results).toEqual([]);
    expect(complete.mock.calls[1][0].messages.at(-1)?.content).toContain('"success":false');
    expect(complete.mock.calls[1][0].messages.at(-1)?.content).toContain('Permission denied');
  });
  it('blocks a replayed call ID and bounds action rounds', async () => {
    const complete = vi.fn().mockResolvedValue(call('same-id', 'create_task'));
    const execute = vi.fn().mockResolvedValue({ saved: true });
    await expect(runAgent([], [], complete, execute)).rejects.toThrow('Action limit');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[4][0].tool_choice).toBe('none');
  });
});
