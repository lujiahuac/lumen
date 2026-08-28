import { useStore } from '../stores/app'

export default function Sidebar() {
  const currentView = useStore((s) => s.currentView)
  const setView = useStore((s) => s.setView)
  const conversations = useStore((s) => s.conversations)
  const currentConvId = useStore((s) => s.currentConversationId)
  const selectConversation = useStore((s) => s.selectConversation)
  const newConversation = useStore((s) => s.newConversation)

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
                onClick={() => selectConversation(conv.id)}
              >
                <div className="conv-title">{conv.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
