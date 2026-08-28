import { useState, useEffect } from 'react'
import { useStore } from '../stores/app'

const PRESETS = [
  { label: '智谱 GLM-4-Flash（免费）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: '硅基流动 SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
]

export default function Settings() {
  const config = useStore((s) => s.config)
  const saveConfig = useStore((s) => s.saveConfig)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (config) {
      setApiKey(config.apiKey)
      setBaseUrl(config.baseUrl)
      setModel(config.model)
    }
  }, [config])

  const handleSave = async () => {
    await saveConfig({ apiKey, baseUrl, model })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setBaseUrl(preset.baseUrl)
    setModel(preset.model)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // 先保存当前配置
      await saveConfig({ apiKey, baseUrl, model })
      // 发一条测试消息
      const res = await window.lumen.sendMessage('你好，请回复"连接成功"四个字。', null)
      if (res.success && res.answer) {
        setTestResult({ ok: true, msg: `连接成功！模型回复: ${res.answer.slice(0, 50)}` })
      } else {
        setTestResult({ ok: false, msg: res.error || '测试失败' })
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || '测试失败' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings-view">
      <h2>设置</h2>

      <section className="settings-section">
        <h3>LLM 配置</h3>
        <p className="settings-desc">
          配置 OpenAI 兼容的 API 接口。你的文档内容在本地进行 embedding 和检索，
          只有最终的问题和上下文会发送到 LLM。
        </p>

        <div className="form-group">
          <label>快速预设</label>
          <div className="preset-buttons">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="preset-btn"
                onClick={() => applyPreset(p)}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>API Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://open.bigmodel.cn/api/paas/v4"
          />
        </div>

        <div className="form-group">
          <label>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入你的 API Key"
          />
        </div>

        <div className="form-group">
          <label>模型名称</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="glm-4-flash"
          />
        </div>

        <div className="settings-actions">
          <button className="save-btn" onClick={handleSave}>
            {saved ? '✓ 已保存' : '保存设置'}
          </button>
          <button className="test-btn" onClick={handleTest} disabled={testing || !apiKey}>
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
          </div>
        )}
      </section>

      <section className="settings-section">
        <h3>关于 Lumen</h3>
        <p>本地优先的 AI 知识库桌面应用</p>
        <p className="hint">
          Embedding 模型：Xenova/all-MiniLM-L6-v2（本地运行）<br />
          向量数据库：LanceDB（嵌入式）<br />
          结构化存储：SQLite（better-sqlite3）
        </p>
      </section>
    </div>
  )
}
