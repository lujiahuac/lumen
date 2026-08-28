// LanceDB 向量存储：存储 chunk 向量并提供相似度检索
// 注意：@lancedb/lancedb 是纯 ESM 包，必须用动态 import()
import path from 'path';
import { app } from 'electron';
import { EMBEDDING_DIM } from './embedder';

// 类型定义
export interface ChunkRecord {
  id: string;           // `${documentId}-${chunkIndex}`
  document_id: number;
  chunk_index: number;
  content: string;
  token_count: number;
  vector: number[];
}

export interface RetrievalResult {
  id: string;
  document_id: number;
  chunk_index: number;
  content: string;
  distance: number;     // LanceDB 返回的距离值，越小越相似
}

// 延迟加载 lancedb 模块
let lancedbModule: typeof import('@lancedb/lancedb') | null = null;

async function getLancedb() {
  if (!lancedbModule) {
    lancedbModule = await import('@lancedb/lancedb');
  }
  return lancedbModule;
}

// 表连接缓存
let tableInstance: any = null;

async function getDbPath(): Promise<string> {
  const userData = app.getPath('userData');
  return path.join(userData, 'lancedb');
}

async function getTable(): Promise<any> {
  if (tableInstance) return tableInstance;

  const lancedb = await getLancedb();
  const dbPath = await getDbPath();
  const db = await lancedb.connect(dbPath);

  const tableNames = await db.tableNames();
  if (tableNames.includes('chunks')) {
    tableInstance = await db.openTable('chunks');
  } else {
    // 空表建表需要一条占位数据
    const placeholder: ChunkRecord = {
      id: '__placeholder__',
      document_id: -1,
      chunk_index: -1,
      content: '',
      token_count: 0,
      vector: new Array(EMBEDDING_DIM).fill(0),
    };
    tableInstance = await db.createTable('chunks', [placeholder as unknown as Record<string, unknown>]);
    await tableInstance.delete("id = '__placeholder__'");
  }
  return tableInstance;
}

export async function addChunks(records: ChunkRecord[]): Promise<void> {
  if (records.length === 0) return;
  const t = await getTable();
  await t.add(records as unknown as Record<string, unknown>[]);
}

export async function deleteChunksByDocument(documentId: number): Promise<void> {
  const t = await getTable();
  // documentId 是 number 类型，不存在注入风险
  await t.delete(`document_id = ${documentId}`);
}

export async function searchSimilar(
  queryVector: number[],
  limit: number = 8
): Promise<RetrievalResult[]> {
  const t = await getTable();
  const results = await t
    .search(queryVector)
    .limit(limit)
    .toArray();

  return results
    .filter((r: any) => r.id !== '__placeholder__')
    .map((r: any) => ({
      id: r.id,
      document_id: r.document_id,
      chunk_index: r.chunk_index,
      content: r.content,
      distance: r._distance ?? 0,
    }));
}
