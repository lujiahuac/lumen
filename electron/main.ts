import { app, BrowserWindow } from 'electron'
import path from 'path'
import { initDb, closeDb } from './db'
import { registerDocumentHandlers } from './ipc/documents'
import { registerSearchHandlers } from './ipc/search'
import { registerChatHandlers } from './ipc/chat'
import { registerConfigHandlers } from './ipc/config'
import { registerDialogHandlers } from './ipc/dialog'
import { warmupEmbedder } from './rag/embedder'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lumen',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  // 初始化数据库
  initDb()

  // 注册所有 IPC 处理器
  registerConfigHandlers()
  registerDialogHandlers()
  registerDocumentHandlers()
  registerSearchHandlers()
  registerChatHandlers()

  createWindow()

  // 后台预热 embedding 模型（不阻塞窗口显示）
  warmupEmbedder().catch((err) => {
    console.warn('[Lumen] Embedding model warmup failed:', err.message)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
