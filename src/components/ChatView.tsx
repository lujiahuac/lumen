import { useState, useRef, useEffect, useMemo } from 'react'
import { marked } from 'marked'
import { useStore } from '../stores/app'
import type { Message } from '../types'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

function MessageBubble({ msg }: { msg: Message }) {
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
  const sendMessage = useStore((s) => s.sendMessage)
  const currentConvId = useStore((s) => s.currentConversationId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="empty-icon">💡</div>
            <p>导入文档后，随时向我提问</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {sending && (
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
