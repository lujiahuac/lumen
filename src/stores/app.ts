import { create } from 'zustand';
import type { Document, ConversationSummary, Message, LlmConfig, EmbedderStatus, Source } from '../types';

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
  streamingContent: string;
  loadConversations: () => Promise<void>;
  selectConversation: (id: number) => Promise<void>;
  newConversation: () => void;
  deleteConversation: (id: number) => Promise<void>;
  renameConversation: (id: number, title: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;

  // 本地模型状态
  modelStatus: EmbedderStatus;
  modelProgress?: number;
  modelMessage?: string;
  initModelListener: () => () => void;

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
  streamingContent: '',
  modelStatus: 'loading',

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
    if (state.sending) return;
    if (state.modelStatus !== 'ready') {
      // 模型未就绪时给出提示，但不硬阻止（已下载缓存时状态可能已在 ready）
      console.warn('[Lumen] Model not ready:', state.modelStatus);
    }

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
      streamingContent: '',
    });

    // 流式 chunk 监听：累积到 streamingContent
    const offChunk = window.lumen.onChatChunk(({ conversationId, delta }) => {
      const cur = get();
      // 新对话首次回包时锁定 conversationId
      if (!cur.currentConversationId && conversationId) {
        set({ currentConversationId: conversationId });
      }
      set({ streamingContent: cur.streamingContent + delta });
    });

    const offDone = window.lumen.onChatDone(({ conversationId, sources }) => {
      const finalContent = get().streamingContent;
      const aiMsg: Message = {
        id: Date.now() + 1,
        conversation_id: conversationId,
        role: 'assistant',
        content: finalContent,
        sources: sources as Source[],
        created_at: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, aiMsg],
        streamingContent: '',
        sending: false,
        currentConversationId: conversationId || s.currentConversationId,
      }));
      get().loadConversations();
    });

    const offError = window.lumen.onChatError(({ error }) => {
      const errMsg: Message = {
        id: Date.now() + 1,
        conversation_id: get().currentConversationId || 0,
        role: 'assistant',
        content: `请求失败：${error}`,
        created_at: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, errMsg],
        streamingContent: '',
        sending: false,
      }));
    });

    try {
      const res = await window.lumen.sendMessage(text, state.currentConversationId);
      if (!res.success) {
        // invoke 层失败（如未配 Key、空消息）；流中途失败由 onChatError 处理
        set((s) => {
          // 若 onChatError 已收尾则不再重复添加
          if (!s.sending && s.streamingContent === '') return {};
          const errMsg: Message = {
            id: Date.now() + 1,
            conversation_id: s.currentConversationId || 0,
            role: 'assistant',
            content: `错误：${res.error || '未知错误'}`,
            created_at: new Date().toISOString(),
          };
          return { messages: [...s.messages, errMsg], sending: false, streamingContent: '' };
        });
      }
      // 成功路径由 onChatDone 事件收尾；这里仅兜底锁定 conversationId
      if (res.success && res.conversationId && !get().currentConversationId) {
        set({ currentConversationId: res.conversationId });
      }
    } catch (err: any) {
      set((s) => {
        if (!s.sending) return {};
        const errMsg: Message = {
          id: Date.now() + 1,
          conversation_id: s.currentConversationId || 0,
          role: 'assistant',
          content: `请求失败：${err.message}`,
          created_at: new Date().toISOString(),
        };
        return { messages: [...s.messages, errMsg], sending: false, streamingContent: '' };
      });
    } finally {
      // 事件监听在流结束后稍作延迟移除，确保最后的 done/error 已收到
      setTimeout(() => {
        offChunk();
        offDone();
        offError();
      }, 500);
    }
  },

  initModelListener: () => {
    const off = window.lumen.onEmbedderStatus(({ status: modelStatus, progress, message }) => {
      set({ modelStatus: modelStatus as EmbedderStatus, modelProgress: progress, modelMessage: message });
    });
    // 主动拉一次当前状态
    window.lumen.getEmbedderStatus().then(({ status }) => {
      set((s) => (s.modelStatus === 'loading' ? { modelStatus: status as EmbedderStatus } : {}));
    });
    return off;
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
