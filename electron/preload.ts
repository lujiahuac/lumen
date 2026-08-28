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
