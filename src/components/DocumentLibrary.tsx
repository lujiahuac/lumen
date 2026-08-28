import { useState } from 'react'
import { useStore } from '../stores/app'

export default function DocumentLibrary() {
  const documents = useStore((s) => s.documents)
  const loadDocuments = useStore((s) => s.loadDocuments)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')

  const handleImport = async () => {
    const filePaths = await window.lumen.openFiles()
    if (!filePaths || filePaths.length === 0) return

    setImporting(true)
    try {
      for (const filePath of filePaths) {
        const fileName = filePath.split(/[\\/]/).pop() || filePath
        setProgress(`正在处理: ${fileName}`)
        const res = await window.lumen.importDocument(filePath, fileName)
        if (!res.success) {
          console.error('Import failed:', res.error, res.stack)
          setProgress(`导入失败 [${fileName}]: ${res.error}`)
          // 给用户时间看到错误
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
      await loadDocuments()
    } finally {
      setImporting(false)
      setProgress('')
    }
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`确定要删除「${title}」吗？\n此操作不可恢复。`)) return
    await window.lumen.deleteDocument(id)
    await loadDocuments()
  }

  const handleReindex = async (id: number) => {
    await window.lumen.reindexDocument(id)
    await loadDocuments()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const statusLabel: Record<string, string> = {
    pending: '等待中',
    indexing: '索引中...',
    ready: '就绪',
    error: '错误',
  }

  return (
    <div className="doc-view">
      <div className="doc-header">
        <h2>文档库</h2>
        <button className="import-btn" onClick={handleImport} disabled={importing}>
          {importing ? progress || '处理中...' : '+ 导入文档'}
        </button>
      </div>

      <div className="doc-list">
        {documents.length === 0 ? (
          <div className="doc-empty">
            <p>还没有文档，点击右上角导入</p>
            <p className="hint">支持 TXT、Markdown、PDF、Word 格式（单文件最大 50MB）</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="doc-item">
              <div className="doc-info">
                <div className="doc-title">{doc.title}</div>
                <div className="doc-meta">
                  <span>{doc.file_type.toUpperCase()}</span>
                  <span>{formatSize(doc.file_size)}</span>
                  <span>{doc.chunk_count} 个片段</span>
                  <span className={`status status-${doc.status}`}>
                    {statusLabel[doc.status] || doc.status}
                  </span>
                </div>
              </div>
              <div className="doc-actions">
                <button onClick={() => handleReindex(doc.id)} title="重建索引">
                  🔄
                </button>
                <button onClick={() => handleDelete(doc.id, doc.title)} title="删除">
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
