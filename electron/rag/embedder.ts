// 本地 Embedding：使用 @xenova/transformers 跑 Xenova/all-MiniLM-L6-v2
// 数据不出境，首次运行会下载约 80MB 模型到用户目录
// 注意：@xenova/transformers 是纯 ESM 包，必须用动态 import()

import path from 'path';
import { app } from 'electron';
import type { FeatureExtractionPipeline } from '@xenova/transformers';

export type EmbedderStatus = 'downloading' | 'loading' | 'ready' | 'error';

type StatusListener = (status: EmbedderStatus, progress?: number, message?: string) => void;

let embedder: FeatureExtractionPipeline | null = null;
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null;
let status: EmbedderStatus = 'loading';
const listeners = new Set<StatusListener>();

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

export function onEmbedderStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  // 立即推送当前状态
  listener(status);
  return () => listeners.delete(listener);
}

function setStatus(next: EmbedderStatus, progress?: number, message?: string) {
  status = next;
  for (const l of listeners) l(next, progress, message);
}

export function getEmbedderStatus(): EmbedderStatus {
  return status;
}

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const transformers = await import('@xenova/transformers');
    // 模型缓存到用户数据目录（打包后 app 目录只读，默认缓存路径会失效）
    transformers.env.cacheDir = path.join(app.getPath('userData'), 'models');
    // 设置 HuggingFace 国内镜像
    transformers.env.remoteHost = 'https://hf-mirror.com/';
    transformers.env.allowLocalModels = false;

    setStatus('loading', undefined, '正在准备本地模型');
    try {
      // progress_callback：模型文件下载/加载进度（transformers.js 官方支持）
      const ext = await transformers.pipeline('feature-extraction', MODEL_NAME, {
        quantized: true,
        progress_callback: (info: any) => {
          if (info.status === 'progress' && typeof info.progress === 'number') {
            const file = info.file ? `（${info.file}）` : '';
            setStatus('downloading', Math.round(info.progress), `正在下载本地模型${file}`);
          } else if (info.status === 'ready') {
            setStatus('loading', undefined, '正在加载模型到内存');
          }
        },
      });
      embedder = ext;
      setStatus('ready');
      return ext;
    } catch (err: any) {
      setStatus('error', undefined, err?.message || '模型加载失败');
      throw err;
    }
  })();

  return loadingPromise;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await getEmbedder();
  const results: number[][] = [];

  for (const text of texts) {
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    // output.data 是 Float32Array
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

// 预热：在 app 启动时提前加载模型
export async function warmupEmbedder(): Promise<void> {
  await getEmbedder();
}

// 用于 LanceDB schema 定义
export const EMBEDDING_DIM = 384;
