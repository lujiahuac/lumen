// 设置 IPC：读取/保存 LLM 配置
import { ipcMain } from 'electron';
import { getLlmConfig, setLlmConfig } from '../config';

export function registerConfigHandlers() {
  ipcMain.handle('config:get', async () => {
    return getLlmConfig();
  });

  ipcMain.handle('config:set', async (_event, config) => {
    setLlmConfig(config);
    return { success: true };
  });
}
