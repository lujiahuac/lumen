// Prompt 构建：将检索上下文与用户问题组合成发给 LLM 的 prompt

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildSystemPrompt(context: string): string {
  return `你是 Lumen，一个本地知识库助手。请基于以下检索到的文档片段回答用户问题。

要求：
1. 答案必须严格基于提供的上下文，不要编造信息。
2. 如果上下文中没有相关信息，直接说明"根据已有文档无法回答该问题"。
3. 回答要清晰、准确、有条理。
4. 可以引用来源编号，如 [1]、[2]。

检索到的文档片段：
${context || '（无相关文档）'}
`;
}

export function buildMessages(
  query: string,
  context: string,
  history: { role: string; content: string }[] = []
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
  ];

  // 只保留最近 6 条历史
  const recent = history.slice(-6);
  for (const msg of recent) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: query });
  return messages;
}
