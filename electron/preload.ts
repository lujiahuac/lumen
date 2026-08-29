import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // 文档相关
  importDocument: (filePath: string, fileName: string) =>
    ipcRenderer.invoke('document:import', { filePath, fileName }),
  listDocuments: () => ipcRenderer.invoke('document:list'),
  deleteDocument: (id: number) => ipcRenderer.invoke('document:delete', { id }),
  reindexDocument: (id: number) => ipcRenderer.invoke('document:reindex', { id }),

  // 对话相关
  sendMessage: (message: string, conversationId?: number | null) =>
    ipcRenderer.invoke('chat:send', { message, conversationId }),
  listConversations: () => ipcRenderer.invoke('chat:list'),
  getConversation: (id: number) => ipcRenderer.invoke('chat:get', { id }),
  deleteConversation: (id: number) => ipcRenderer.invoke('chat:delete', { id }),
  renameConversation: (id: number, title: string) => ipcRenderer.invoke('chat:rename', { id, title }),

  // 流式回复事件
  onChatChunk: (cb: (data: { conversationId: number; delta: string }) => void) => {
    const handler = (_e: unknown, data: { conversationId: number; delta: string }) => cb(data)
    ipcRenderer.on('chat:chunk', handler)
    return () => ipcRenderer.removeListener('chat:chunk', handler)
  },
  onChatDone: (cb: (data: { conversationId: number; sources: unknown[] }) => void) => {
    const handler = (_e: unknown, data: { conversationId: number; sources: unknown[] }) => cb(data)
    ipcRenderer.on('chat:done', handler)
    return () => ipcRenderer.removeListener('chat:done', handler)
  },
  onChatError: (cb: (data: { conversationId: number; error: string }) => void) => {
    const handler = (_e: unknown, data: { conversationId: number; error: string }) => cb(data)
    ipcRenderer.on('chat:error', handler)
    return () => ipcRenderer.removeListener('chat:error', handler)
  },

  // 本地模型状态
  getEmbedderStatus: () => ipcRenderer.invoke('embedder:status'),
  onEmbedderStatus: (cb: (data: { status: string; progress?: number; message?: string }) => void) => {
    const handler = (_e: unknown, data: { status: string; progress?: number; message?: string }) => cb(data)
    ipcRenderer.on('embedder:status', handler)
    return () => ipcRenderer.removeListener('embedder:status', handler)
  },

  // 搜索
  search: (query: string, limit?: number) =>
    ipcRenderer.invoke('search:query', { query, limit }),

  // 设置
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: Record<string, string>) => ipcRenderer.invoke('config:set', config),

  // 文件对话框
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
}

contextBridge.exposeInMainWorld('lumen', api)
