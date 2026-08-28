import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import DocumentLibrary from './components/DocumentLibrary'
import Settings from './components/Settings'
import { useStore } from './stores/app'

function App() {
  const currentView = useStore((s) => s.currentView)
  const loadConversations = useStore((s) => s.loadConversations)
  const loadDocuments = useStore((s) => s.loadDocuments)
  const loadConfig = useStore((s) => s.loadConfig)

  useEffect(() => {
    loadConversations()
    loadDocuments()
    loadConfig()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {currentView === 'chat' && <ChatView />}
        {currentView === 'documents' && <DocumentLibrary />}
        {currentView === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default App
