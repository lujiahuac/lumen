import { app, BrowserWindow } from 'electron'
import path from 'path'
import { initDb, closeDb, getDb } from './db'
import { registerDocumentHandlers } from './ipc/documents'
import { registerSearchHandlers } from './ipc/search'
import { registerChatHandlers } from './ipc/chat'
import { registerConfigHandlers } from './ipc/config'
import { registerDialogHandlers } from './ipc/dialog'
import { warmupEmbedder, onEmbedderStatus } from './rag/embedder'

let mainWindow: BrowserWindow | null = null

const WIN_STATE_KEY = 'window_state'

function loadWindowState(): { x?: number; y?: number; width: number; height: number } | null {
  try {
    const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(WIN_STATE_KEY) as { value: string } | undefined
    return row ? JSON.parse(row.value) : null
  } catch {
    return null
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    const bounds = win.getBounds()
    getDb().prepare(
      'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(WIN_STATE_KEY, JSON.stringify(bounds))
  } catch {
    // 退出阶段数据库可能已关闭，忽略
  }
}

function createWindow() {
  const saved = loadWindowState()
  mainWindow = new BrowserWindow({
    width: saved?.width || 1200,
    height: saved?.height || 800,
    x: saved?.x,
    y: saved?.y,
    minWidth: 800,
    minHeight: 600,
    title: 'Lumen',
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 保存窗口位置与大小
  const persist = () => mainWindow && saveWindowState(mainWindow)
  mainWindow.on('resize', persist)
  mainWindow.on('move', persist)

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

  // 模型状态变化时推送给前端
  onEmbedderStatus((modelStatus, progress, message) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('embedder:status', { status: modelStatus, progress, message })
    })
  })

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
  if (mainWindow) saveWindowState(mainWindow)
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
