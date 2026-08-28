// 对话 IPC：发送消息、检索上下文、调用 LLM、返回回答
import { ipcMain } from 'electron';
import { getDb } from '../db';
import { retrieve } from '../rag/retriever';
import { buildMessages } from '../rag/prompt';
import { getLlmConfig } from '../config';

// 规范化 Base URL：去除末尾斜杠
function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

// 调用 OpenAI 兼容 API
async function callLlm(
  messages: { role: string; content: string }[],
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<string> {
  const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
        stream: false,
      }),
    });
  } catch (err: any) {
    // fetch 层面的网络错误
    const cause = err.cause?.message || err.message || '';
    if (cause.includes('ENOTFOUND') || cause.includes('ECONNREFUSED') || cause.includes('fetch failed')) {
      throw new Error(
        `无法连接到 API 服务器（${baseUrl}）。请检查：\n` +
        `1. Base URL 是否正确\n` +
        `2. 网络是否正常（国内访问 OpenAI 需要代理）\n` +
        `3. 防火墙是否拦截`
      );
    }
    if (cause.includes('CERT') || cause.includes('certificate')) {
      throw new Error('SSL 证书验证失败，请检查网络环境或 API 地址');
    }
    throw new Error(`网络请求失败: ${cause}`);
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errBody = await response.json();
      errorDetail = errBody.error?.message || JSON.stringify(errBody);
    } catch {
      errorDetail = await response.text().catch(() => '');
    }

    if (response.status === 401) {
      throw new Error('API Key 无效或已过期，请检查设置中的 API Key');
    }
    if (response.status === 404) {
      throw new Error(`API 地址返回 404，请检查 Base URL 和模型名称是否正确（当前模型: ${model}）`);
    }
    if (response.status === 429) {
      throw new Error('请求过于频繁或额度已用完，请稍后再试或检查账户余额');
    }
    throw new Error(`API 返回错误 ${response.status}: ${errorDetail}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('API 返回了空回复，请检查模型名称是否正确');
  }
  return content;
}

export function registerChatHandlers() {
  // 获取对话列表
  ipcMain.handle('chat:list', async () => {
    const db = getDb();
    return db
      .prepare(
        `SELECT c.id, c.title, c.created_at, c.updated_at,
                (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
         FROM conversations c ORDER BY c.updated_at DESC`
      )
      .all();
  });

  // 获取单个对话的消息
  ipcMain.handle('chat:get', async (_event, { id }) => {
    const db = getDb();
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conversation) {
      return { conversation: null, messages: [] };
    }
    const messages = db
      .prepare('SELECT id, role, content, sources, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(id);
    return { conversation, messages };
  });

  // 发送消息（核心）
  ipcMain.handle('chat:send', async (_event, { message, conversationId }) => {
    const db = getDb();
    const config = getLlmConfig();

    if (!config.apiKey) {
      return { success: false, error: '请先在设置中配置 API Key' };
    }

    if (!message || !message.trim()) {
      return { success: false, error: '消息不能为空' };
    }

    // 获取或创建对话
    let convId = conversationId;
    if (!convId) {
      const title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
      const result = db
        .prepare('INSERT INTO conversations (title) VALUES (?)')
        .run(title);
      convId = Number(result.lastInsertRowid);
    }

    // 保存用户消息
    db.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    ).run(convId, 'user', message);

    try {
      // 检索相关文档
      const { results, context } = await retrieve(message, 6);

      // 获取历史消息
      const history = db
        .prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 10')
        .all(convId) as { role: string; content: string }[];
      history.reverse();

      // 构建 prompt
      const messages = buildMessages(message, context, history);

      // 调用 LLM
      const answer = await callLlm(
        messages,
        config.apiKey,
        config.baseUrl,
        config.model
      );

      // 保存 AI 回复
      const sources = results.map((r) => ({
        documentId: r.document_id,
        chunkIndex: r.chunk_index,
        content: r.content.slice(0, 100),
        distance: r.distance,
      }));

      db.prepare(
        'INSERT INTO messages (conversation_id, role, content, sources) VALUES (?, ?, ?, ?)'
      ).run(convId, 'assistant', answer, JSON.stringify(sources));

      // 更新对话时间
      db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);

      return {
        success: true,
        conversationId: convId,
        answer,
        sources,
      };
    } catch (err: any) {
      console.error('[Lumen] Chat failed:', err);
      return { success: false, error: err.message };
    }
  });
}
