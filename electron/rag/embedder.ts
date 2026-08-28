// 本地 Embedding：使用 @xenova/transformers 跑 Xenova/all-MiniLM-L6-v2
// 数据不出境，首次运行会下载约 80MB 模型到缓存
// 注意：@xenova/transformers 是纯 ESM 包，必须用动态 import()

import type { FeatureExtractionPipeline } from '@xenova/transformers';

let embedder: FeatureExtractionPipeline | null = null;
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const transformers = await import('@xenova/transformers');
    // 设置 HuggingFace 国内镜像
    transformers.env.remoteHost = 'https://hf-mirror.com/';
    transformers.env.allowLocalModels = false;
    const ext = await transformers.pipeline('feature-extraction', MODEL_NAME, {
      quantized: true,
    });
    return ext;
  })();
  embedder = await loadingPromise;
  return embedder;
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
