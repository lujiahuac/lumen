import { useState, useRef, useEffect } from 'react'
import { useStore } from '../stores/app'

export default function Sidebar() {
  const currentView = useStore((s) => s.currentView)
  const setView = useStore((s) => s.setView)
  const conversations = useStore((s) => s.conversations)
  const currentConvId = useStore((s) => s.currentConversationId)
  const selectConversation = useStore((s) => s.selectConversation)
  const newConversation = useStore((s) => s.newConversation)
  const deleteConversation = useStore((s) => s.deleteConversation)
  const renameConversation = useStore((s) => s.renameConversation)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const startRename = (id: number, title: string) => {
    setEditingId(id)
    setEditTitle(title)
  }

  const saveRename = async () => {
    if (editingId !== null) {
      const title = editTitle.trim()
      if (title) {
        await renameConversation(editingId, title)
      }
    }
    setEditingId(null)
  }

  const handleDelete = async (id: number) => {
    await deleteConversation(id)
    setConfirmDeleteId(null)
  }

  const navItems = [
    { key: 'chat' as const, label: '对话', icon: '💬' },
    { key: 'documents' as const, label: '文档库', icon: '📚' },
    { key: 'settings' as const, label: '设置', icon: '⚙️' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">💡 Lumen</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${currentView === item.key ? 'active' : ''}`}
            onClick={() => setView(item.key)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {currentView === 'chat' && (
        <div className="sidebar-conversations">
          <button className="new-chat-btn" onClick={newConversation}>
            + 新对话
          </button>
          <div className="conversation-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${currentConvId === conv.id ? 'active' : ''}`}
                onClick={() => {
                  if (editingId !== conv.id) selectConversation(conv.id)
                }}
              >
                {editingId === conv.id ? (
                  <input
                    ref={editInputRef}
                    className="conv-rename-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="conv-title" title={conv.title}>
                      {conv.title}
                    </div>
                    <div className="conv-actions">
                      <button
                        className="conv-action-btn"
                        title="重命名"
                        onClick={(e) => {
                          e.stopPropagation()
                          startRename(conv.id, conv.title)
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="conv-action-btn"
                        title="删除"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(conv.id)
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>删除对话</h3>
            <p>确定要删除这个对话吗？所有消息将被永久删除，此操作不可撤销。</p>
            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setConfirmDeleteId(null)}
              >
                取消
              </button>
              <button
                className="modal-btn modal-btn-danger"
                onClick={() => handleDelete(confirmDeleteId)}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
