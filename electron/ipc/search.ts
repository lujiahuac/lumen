// 搜索 IPC：语义搜索
import { ipcMain } from 'electron';
import { retrieve } from '../rag/retriever';

export function registerSearchHandlers() {
  ipcMain.handle('search:query', async (_event, { query, limit = 10 }) => {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Invalid query' };
    }
    const { results, context } = await retrieve(query, limit);
    return {
      success: true,
      results: results.map((r) => ({
        documentId: r.document_id,
        chunkIndex: r.chunk_index,
        content: r.content,
        distance: r.distance,
      })),
      context,
    };
  });
}
