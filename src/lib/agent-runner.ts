import type { ChatCompletionMessage, ChatCompletionResponse } from '@/lib/ai-agent';

type Request = { messages: ChatCompletionMessage[]; tools?: unknown[]; tool_choice?: 'auto' | 'none' };
export async function runAgent(
  messages: ChatCompletionMessage[],
  tools: unknown[],
  complete: (request: Request) => Promise<ChatCompletionResponse>,
  execute: (name: string, args: Record<string, unknown>) => Promise<unknown>,
) {
  const conversation = [...messages];
  const results: string[] = [];
  const seenCalls = new Set<string>();
  for (let round = 0; round <= 4; round++) {
    const response = await complete({ messages: [...conversation], tools, tool_choice: round === 4 ? 'none' : 'auto' });
    const message = response.choices[0]?.message;
    if (!message) throw new Error('The assistant returned an empty response.');
    if (!message.tool_calls?.length) return { text: message.content || 'Please try a more specific request.', results };
    if (round === 4) throw new Error('Action limit reached. Check completed actions before continuing.');
    conversation.push(message);
    for (const call of message.tool_calls) {
      let content: string;
      try {
        if (seenCalls.has(call.id)) throw new Error('Duplicate tool call was blocked.');
        seenCalls.add(call.id);
        const args: unknown = JSON.parse(call.function.arguments || '{}');
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid action parameters.');
        const result = await execute(call.function.name, args as Record<string, unknown>);
        content = JSON.stringify({ success: true, result });
        results.push(call.function.name.replace(/_/g, ' '));
      } catch (error) {
        const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
        content = JSON.stringify({ success: false, error: message });
      }
      conversation.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content });
    }
  }
  throw new Error('Action limit reached.');
}
