// 文档分块：递归字符分割 + overlap 重叠
// 目标：保持语义完整性，控制块大小，保留上下文

export interface Chunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

const CHUNK_SIZE = 500; // 每块目标字符数（中文一个字即一个token左右）
const CHUNK_OVERLAP = 80; // 相邻块重叠字符数

const SEPARATORS = ['\n## ', '\n### ', '\n\n', '\n', '。', '！', '？', '；', '，', ' ', ''];

// 粗略估算 token 数（中文按字符，英文按 4 字符/token）
function estimateTokens(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const nonChinese = text.length - chinese;
  return chinese + Math.ceil(nonChinese / 4);
}

function splitBySeparators(text: string, separators: string[]): string[] {
  if (text.length <= CHUNK_SIZE || separators.length === 0) {
    return [text];
  }
  const sep = separators[0];
  const parts = sep === '' ? text.split('') : text.split(sep);
  const chunks: string[] = [];
  let buffer = '';

  for (const part of parts) {
    const candidate = buffer ? buffer + sep + part : part;
    if (candidate.length <= CHUNK_SIZE) {
      buffer = candidate;
    } else {
      if (buffer) chunks.push(buffer);
      if (part.length > CHUNK_SIZE) {
        const subChunks = splitBySeparators(part, separators.slice(1));
        for (const sc of subChunks) {
          if (sc.length <= CHUNK_SIZE) {
            buffer = sc;
          } else {
            chunks.push(sc);
            buffer = '';
          }
        }
      } else {
        buffer = part;
      }
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export function chunkText(text: string): Chunk[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const rawChunks = splitBySeparators(clean, SEPARATORS);

  const result: Chunk[] = [];
  let previousTail = '';

  for (let i = 0; i < rawChunks.length; i++) {
    let content = rawChunks[i].trim();
    if (!content) continue;

    // 加入上一块末尾的 overlap 文本
    if (previousTail) {
      content = previousTail + content;
    }

    const tokenCount = estimateTokens(content);
    result.push({
      content,
      chunkIndex: result.length,
      tokenCount,
    });

    previousTail = content.slice(-CHUNK_OVERLAP);
  }

  return result;
}
