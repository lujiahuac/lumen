// 检索器：向量相似度检索 + 关键词加权
import { embedQuery } from './embedder';
import { searchSimilar, type RetrievalResult } from './vectorStore';

export interface RetrievalContext {
  results: RetrievalResult[];
  context: string;
}

// 提取关键词：中文按 bigram，英文按空格分词
function extractKeywords(query: string): string[] {
  const keywords: string[] = [];
  const segments = query
    .toLowerCase()
    .split(/[\s,，。！？；：、.!?;:"'""''（）()\[\]【】]+/);

  for (const seg of segments) {
    if (!seg) continue;
    if (/[\u4e00-\u9fff]/.test(seg)) {
      // 中文段：提取 2-gram
      if (seg.length === 1) {
        keywords.push(seg);
      } else {
        for (let i = 0; i < seg.length - 1; i++) {
          keywords.push(seg.slice(i, i + 2));
        }
      }
    } else if (seg.length > 1) {
      keywords.push(seg);
    }
  }
  return keywords;
}

// 关键词命中降低 distance（越小越相似）
function keywordBoost(query: string, content: string, distance: number): number {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return distance;

  let hits = 0;
  const lower = content.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) hits++;
  }
  return distance - hits * 0.02;
}

export async function retrieve(
  query: string,
  topK: number = 6
): Promise<RetrievalContext> {
  if (!query.trim()) {
    return { results: [], context: '' };
  }

  const queryVector = await embedQuery(query);
  const rawResults = await searchSimilar(queryVector, topK * 2);

  const boosted = rawResults
    .map((r) => ({ ...r, distance: keywordBoost(query, r.content, r.distance) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topK);

  const context = boosted
    .map((r, i) => `[${i + 1}] ${r.content.trim()}`)
    .join('\n\n');

  return { results: boosted, context };
}
