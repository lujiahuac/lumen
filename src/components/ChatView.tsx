import { useState, useRef, useEffect, useMemo } from 'react'
import { marked } from 'marked'
import { useStore } from '../stores/app'
import type { Message } from '../types'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

function MessageBubble({ msg, streaming }: { msg: Message; streaming?: boolean }) {
  const isUser = msg.role === 'user'
  const html = useMemo(
    () => isUser ? msg.content : (marked.parse(msg.content, { async: false }) as string),
    [msg.content, isUser]
  )

  return (
    <div className={`message ${msg.role}`}>
      <div className="message-avatar">
        {isUser ? '你' : 'AI'}
      </div>
      <div className="message-bubble">
        {isUser ? (
          <div className="message-content">{msg.content}</div>
        ) : (
          <div
            className="message-content markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {streaming && <span className="stream-cursor" />}
        {Array.isArray(msg.sources) && msg.sources.length > 0 && (
          <div className="message-sources">
            <div className="sources-label">引用来源：</div>
            {msg.sources.map((src, i) => (
              <span key={i} className="source-tag" title={src.content}>
                文档{src.documentId} #{src.chunkIndex}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatView() {
  const [input, setInput] = useState('')
  const messages = useStore((s) => s.messages)
  const sending = useStore((s) => s.sending)
  const streamingContent = useStore((s) => s.streamingContent)
  const sendMessage = useStore((s) => s.sendMessage)
  const currentConvId = useStore((s) => s.currentConversationId)
  const modelStatus = useStore((s) => s.modelStatus)
  const modelProgress = useStore((s) => s.modelProgress)
  const modelMessage = useStore((s) => s.modelMessage)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>{currentConvId ? '' : '新对话'}</h2>
      </div>

      {modelStatus !== 'ready' && (
        <div className={`model-status-bar model-${modelStatus}`}>
          {modelStatus === 'downloading' && (
            <span>
              ⬇️ {modelMessage || '正在下载本地模型'}
              {typeof modelProgress === 'number' ? ` ${modelProgress}%` : ''}
              <span className="model-progress">
                <span className="model-progress-fill" style={{ width: `${modelProgress || 0}%` }} />
              </span>
            </span>
          )}
          {modelStatus === 'loading' && <span>⏳ {modelMessage || '正在加载本地模型...'}</span>}
          {modelStatus === 'error' && (
            <span>⚠️ 本地模型加载失败，文档检索不可用，请重启应用或检查网络（{modelMessage}）</span>
          )}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && !streamingContent && (
          <div className="chat-empty">
            <div className="empty-icon">💡</div>
            <p>导入文档后，随时向我提问</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {sending && streamingContent && (
          <MessageBubble
            msg={{
              id: -1,
              conversation_id: currentConvId || 0,
              role: 'assistant',
              content: streamingContent,
              created_at: new Date().toISOString(),
            }}
            streaming
          />
        )}
        {sending && !streamingContent && (
          <div className="message assistant">
            <div className="message-avatar">AI</div>
            <div className="message-bubble">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="输入问题...（Enter 发送，Shift+Enter 换行）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!input.trim() || sending}
        >
          发送
        </button>
      </div>
    </div>
  )
}
