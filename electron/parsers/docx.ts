// Word 文件解析器
import mammoth from 'mammoth';
import fs from 'fs/promises';

export async function parseDocx(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  // 将 Node Buffer 转为 ArrayBuffer
  const arrayBuffer = dataBuffer.buffer.slice(
    dataBuffer.byteOffset,
    dataBuffer.byteOffset + dataBuffer.byteLength
  ) as ArrayBuffer;
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
