export interface LumenAPI {
  importDocument: (filePath: string, fileName: string) => Promise<{ success: boolean; documentId?: number; chunkCount?: number; error?: string; stack?: string }>
  listDocuments: () => Promise<Document[]>
  deleteDocument: (id: number) => Promise<{ success: boolean }>
  reindexDocument: (id: number) => Promise<{ success: boolean; chunkCount?: number; error?: string }>
  sendMessage: (message: string, conversationId?: number | null) => Promise<ChatResponse>
  listConversations: () => Promise<ConversationSummary[]>
  getConversation: (id: number) => Promise<{ conversation: Conversation | null; messages: Message[] }>
  search: (query: string, limit?: number) => Promise<{ success: boolean; results: SearchResult[]; context: string; error?: string }>
  getConfig: () => Promise<LlmConfig>
  setConfig: (config: Partial<LlmConfig>) => Promise<{ success: boolean }>
  openFiles: () => Promise<string[]>
}

export interface Document {
  id: number
  title: string
  file_path: string
  file_type: string
  file_size: number
  chunk_count: number
  status: 'pending' | 'indexing' | 'ready' | 'error'
  created_at: string
  updated_at: string
}

export interface ConversationSummary {
  id: number
  title: string
  created_at: string
  updated_at: string
  last_message?: string
}

export interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  created_at: string
}

export interface Source {
  documentId: number
  chunkIndex: number
  content: string
  distance: number
}

export interface SearchResult {
  documentId: number
  chunkIndex: number
  content: string
  distance: number
}

export interface ChatResponse {
  success: boolean
  conversationId?: number
  answer?: string
  sources?: Source[]
  error?: string
}

export interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
}

declare global {
  interface Window {
    lumen: LumenAPI
  }
}
