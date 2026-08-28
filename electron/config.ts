// LLM 配置管理：读取/保存用户的 API Key、Base URL、模型名
// 配置存在 SQLite 的 app_config 表中（schema.sql 中建表）
import { getDb } from './db';

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULTS: LlmConfig = {
  apiKey: '',
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4-flash',
};

export function getLlmConfig(): LlmConfig {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM app_config').all() as
    { key: string; value: string }[];

  const kv: Record<string, string> = {};
  for (const row of rows) {
    kv[row.key] = row.value;
  }

  return {
    apiKey: kv['llm.api_key'] || DEFAULTS.apiKey,
    baseUrl: kv['llm.base_url'] || DEFAULTS.baseUrl,
    model: kv['llm.model'] || DEFAULTS.model,
  };
}

export function setLlmConfig(config: Partial<LlmConfig>): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  if (config.apiKey !== undefined) stmt.run('llm.api_key', config.apiKey);
  if (config.baseUrl !== undefined) stmt.run('llm.base_url', config.baseUrl);
  if (config.model !== undefined) stmt.run('llm.model', config.model);
}
