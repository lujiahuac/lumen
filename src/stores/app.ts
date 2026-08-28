import { create } from 'zustand';
import type { Document, ConversationSummary, Message, LlmConfig } from '../types';

interface AppState {
  // 导航
  currentView: 'chat' | 'documents' | 'settings';
  setView: (view: 'chat' | 'documents' | 'settings') => void;

  // 文档
  documents: Document[];
  loadingDocs: boolean;
  loadDocuments: () => Promise<void>;

  // 对话
  conversations: ConversationSummary[];
  currentConversationId: number | null;
  messages: Message[];
  sending: boolean;
  loadConversations: () => Promise<void>;
  selectConversation: (id: number) => Promise<void>;
  newConversation: () => void;
  deleteConversation: (id: number) => Promise<void>;
  renameConversation: (id: number, title: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;

  // 设置
  config: LlmConfig | null;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<LlmConfig>) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  currentView: 'chat',
  setView: (view) => set({ currentView: view }),

  documents: [],
  loadingDocs: false,
  loadDocuments: async () => {
    set({ loadingDocs: true });
    try {
      const docs = await window.lumen.listDocuments();
      set({ documents: docs });
    } finally {
      set({ loadingDocs: false });
    }
  },

  conversations: [],
  currentConversationId: null,
  messages: [],
  sending: false,

  loadConversations: async () => {
    const convs = await window.lumen.listConversations();
    set({ conversations: convs });
  },

  selectConversation: async (id) => {
    const { conversation, messages } = await window.lumen.getConversation(id);
    if (!conversation) return;
    set({
      currentConversationId: conversation.id,
      messages,
      currentView: 'chat',
    });
  },

  newConversation: () => {
    set({ currentConversationId: null, messages: [] });
  },

  deleteConversation: async (id) => {
    await window.lumen.deleteConversation(id);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      ...(s.currentConversationId === id
        ? { currentConversationId: null, messages: [] }
        : {}),
    }));
  },

  renameConversation: async (id, title) => {
    await window.lumen.renameConversation(id, title);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    }));
  },

  sendMessage: async (text) => {
    const state = get();
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: state.currentConversationId || 0,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    set({
      messages: [...state.messages, userMsg],
      sending: true,
    });

    try {
      const res = await window.lumen.sendMessage(text, state.currentConversationId);
      if (res.success && res.answer) {
        const aiMsg: Message = {
          id: Date.now() + 1,
          conversation_id: res.conversationId || 0,
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          created_at: new Date().toISOString(),
        };
        set((s) => ({
          messages: [...s.messages, aiMsg],
          currentConversationId: res.conversationId || s.currentConversationId,
          sending: false,
        }));
        get().loadConversations();
      } else {
        const errMsg: Message = {
          id: Date.now() + 1,
          conversation_id: state.currentConversationId || 0,
          role: 'assistant',
          content: `错误：${res.error || '未知错误'}`,
          created_at: new Date().toISOString(),
        };
        set((s) => ({ messages: [...s.messages, errMsg], sending: false }));
      }
    } catch (err: any) {
      const errMsg: Message = {
        id: Date.now() + 1,
        conversation_id: state.currentConversationId || 0,
        role: 'assistant',
        content: `请求失败：${err.message}`,
        created_at: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errMsg], sending: false }));
    }
  },

  config: null,
  loadConfig: async () => {
    const config = await window.lumen.getConfig();
    set({ config });
  },
  saveConfig: async (config) => {
    await window.lumen.setConfig(config);
    const newConfig = await window.lumen.getConfig();
    set({ config: newConfig });
  },
}));
