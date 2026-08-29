// 对话 IPC：发送消息、检索上下文、调用 LLM（流式）、返回回答
import { ipcMain, BrowserWindow } from 'electron';
import { getDb } from '../db';
import { retrieve } from '../rag/retriever';
import { buildMessages } from '../rag/prompt';
import { getLlmConfig } from '../config';
import { getEmbedderStatus } from '../rag/embedder';

// 规范化 Base URL：去除末尾斜杠
function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

// 流式调用：解析 SSE，通过 onChunk 回调逐段吐出文本
async function callLlmStream(
  messages: { role: string; content: string }[],
  apiKey: string,
  baseUrl: string,
  model: string,
  onChunk: (delta: string) => void
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
        stream: true,
      }),
    });
  } catch (err: any) {
    const cause = err.cause?.message || err.message || '';
    if (cause.includes('ENOTFOUND') || cause.includes('ECONNREFUSED') || cause.includes('fetch failed')) {
      throw new Error(
        `无法连接到 API 服务器（${baseUrl}）。请检查网络或 Base URL 配置`
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
    if (response.status === 401) throw new Error('API Key 无效或已过期，请检查设置中的 API Key');
    if (response.status === 404) throw new Error(`API 地址返回 404，请检查 Base URL 和模型名称（当前模型: ${model}）`);
    if (response.status === 429) throw new Error('请求过于频繁或额度已用完，请稍后再试或检查账户余额');
    throw new Error(`API 返回错误 ${response.status}: ${errorDetail}`);
  }

  if (!response.body) {
    // 端点不支持流式，降级为非流式
    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (content) onChunk(content);
    return content;
  }

  // 解析 SSE 流：data: {...}\n\n 分行，[DONE] 结束
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // 非 JSON 行（如 keep-alive 注释）忽略
      }
    }
  }

  if (!full) {
    throw new Error('API 返回了空回复，请检查模型名称是否正确');
  }
  return full;
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
    const rows = db
      .prepare('SELECT id, conversation_id, role, content, sources, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(id) as any[];
    const messages = rows.map((row) => ({
      ...row,
      sources: row.sources ? JSON.parse(row.sources) : null,
    }));
    return { conversation, messages };
  });

  // 删除对话
  ipcMain.handle('chat:delete', async (_event, { id }) => {
    const db = getDb();
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    return { success: true };
  });

  // 重命名对话
  ipcMain.handle('chat:rename', async (_event, { id, title }) => {
    const db = getDb();
    db.prepare('UPDATE conversations SET title = ?, updated_at = datetime(\'now\') WHERE id = ?').run(title, id);
    return { success: true };
  });

  // 发送消息（流式）
  ipcMain.handle('chat:send', async (event, { message, conversationId }) => {
    const db = getDb();
    const config = getLlmConfig();
    const win = BrowserWindow.fromWebContents(event.sender);

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

    const sendChunk = (delta: string) => {
      win?.webContents.send('chat:chunk', { conversationId: convId, delta });
    };

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

      // 流式调用 LLM
      const answer = await callLlmStream(
        messages,
        config.apiKey,
        config.baseUrl,
        config.model,
        sendChunk
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

      // 通知前端流结束
      win?.webContents.send('chat:done', {
        conversationId: convId,
        sources,
      });

      return {
        success: true,
        conversationId: convId,
        answer,
        sources,
      };
    } catch (err: any) {
      console.error('[Lumen] Chat failed:', err);
      win?.webContents.send('chat:error', {
        conversationId: convId,
        error: err.message,
      });
      return { success: false, error: err.message, conversationId: convId };
    }
  });

  // 获取本地模型状态
  ipcMain.handle('embedder:status', async () => {
    return { status: getEmbedderStatus() };
  });
}
