// 对话框 IPC：文件选择器
import { ipcMain, dialog, BrowserWindow } from 'electron';

export function registerDialogHandlers() {
  ipcMain.handle('dialog:openFiles', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return [];

    const result = await dialog.showOpenDialog(window, {
      title: '选择文档',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '支持的文档', extensions: ['txt', 'md', 'pdf', 'docx'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });

    if (result.canceled) return [];
    return result.filePaths;
  });
}
