// 文档 IPC：导入、列表、删除、重建索引
import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { getDb } from '../db';
import { parseFile } from '../parsers';
import { chunkText } from '../rag/chunker';
import { embedTexts } from '../rag/embedder';
import { addChunks, deleteChunksByDocument, type ChunkRecord } from '../rag/vectorStore';

const BATCH_SIZE = 8;

// 共享索引逻辑：解析 → 分块 → embedding → 存 SQLite + LanceDB → 更新状态
async function indexDocument(documentId: number, filePath: string): Promise<number> {
  const db = getDb();

  // 解析文件
  const text = await parseFile(filePath);
  if (!text || !text.trim()) {
    throw new Error('文件内容为空，无法建立索引');
  }

  // 分块
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error('文档分块结果为空');
  }

  // 批量 embedding
  const records: ChunkRecord[] = [];
  const insertChunk = db.prepare(
    `INSERT INTO chunks (document_id, content, chunk_index, token_count)
     VALUES (?, ?, ?, ?)`
  );

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const vectors = await embedTexts(batch.map((c) => c.content));

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      insertChunk.run(documentId, chunk.content, chunk.chunkIndex, chunk.tokenCount);

      records.push({
        id: `${documentId}-${chunk.chunkIndex}`,
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        token_count: chunk.tokenCount,
        vector: vectors[j],
      });
    }
  }

  // 存入 LanceDB
  await addChunks(records);

  // 更新文档状态
  db.prepare(
    `UPDATE documents SET status = 'ready', chunk_count = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(chunks.length, documentId);

  return chunks.length;
}

export function registerDocumentHandlers() {
  // 导入文件
  ipcMain.handle('document:import', async (_event, { filePath, fileName }) => {
    const db = getDb();

    // 验证文件存在
    try {
      await fs.access(filePath);
    } catch {
      return { success: false, error: `文件不存在或无法访问: ${filePath}` };
    }

    const stat = await fs.stat(filePath);
    if (stat.size === 0) {
      return { success: false, error: '文件为空（0 字节）' };
    }
    if (stat.size > 50 * 1024 * 1024) {
      return { success: false, error: '文件过大，请上传 50MB 以内的文件' };
    }

    const fileType = path.extname(filePath).toLowerCase().slice(1);
    if (!['txt', 'md', 'markdown', 'pdf', 'docx'].includes(fileType)) {
      return { success: false, error: `不支持的文件格式: .${fileType}` };
    }

    // 插入文档记录
    const result = db
      .prepare(
        `INSERT INTO documents (title, file_path, file_type, file_size, status)
         VALUES (?, ?, ?, ?, 'indexing')`
      )
      .run(fileName, filePath, fileType, stat.size);

    const documentId = Number(result.lastInsertRowid);

    try {
      const chunkCount = await indexDocument(documentId, filePath);
      return { success: true, documentId, chunkCount };
    } catch (err: any) {
      console.error('[Lumen] Document import failed:', err);
      db.prepare(
        `UPDATE documents SET status = 'error', updated_at = datetime('now') WHERE id = ?`
      ).run(documentId);
      return { success: false, error: err.message, stack: err.stack };
    }
  });

  // 文档列表
  ipcMain.handle('document:list', async () => {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, title, file_type, file_size, chunk_count, status, created_at, updated_at
         FROM documents ORDER BY created_at DESC`
      )
      .all();
  });

  // 删除文档
  ipcMain.handle('document:delete', async (_event, { id }) => {
    const db = getDb();
    db.prepare('DELETE FROM chunks WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    await deleteChunksByDocument(id);
    return { success: true };
  });

  // 重建索引
  ipcMain.handle('document:reindex', async (_event, { id }) => {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    if (!doc) return { success: false, error: '文档不存在' };

    // 检查原文件是否还在
    try {
      await fs.access(doc.file_path);
    } catch {
      db.prepare("UPDATE documents SET status = 'error' WHERE id = ?").run(id);
      return { success: false, error: '原始文件已被移动或删除，无法重建索引' };
    }

    // 清除旧数据
    db.prepare('DELETE FROM chunks WHERE document_id = ?').run(id);
    await deleteChunksByDocument(id);
    db.prepare("UPDATE documents SET status = 'indexing', chunk_count = 0 WHERE id = ?").run(id);

    try {
      const chunkCount = await indexDocument(id, doc.file_path);
      return { success: true, chunkCount };
    } catch (err: any) {
      console.error('[Lumen] Reindex failed:', err);
      db.prepare("UPDATE documents SET status = 'error' WHERE id = ?").run(id);
      return { success: false, error: err.message };
    }
  });
}
