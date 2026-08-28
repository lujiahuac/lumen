// 统一文件解析入口
import path from 'path';
import { parseText } from './text';
import { parsePdf } from './pdf';
import { parseDocx } from './docx';

export type SupportedFileType = 'txt' | 'md' | 'pdf' | 'docx';

export function detectFileType(filePath: string): SupportedFileType | null {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  if (['txt', 'md', 'markdown'].includes(ext)) return 'txt';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  return null;
}

export async function parseFile(filePath: string): Promise<string> {
  const type = detectFileType(filePath);
  if (!type) throw new Error(`Unsupported file type: ${filePath}`);
  switch (type) {
    case 'txt':
      return parseText(filePath);
    case 'pdf':
      return parsePdf(filePath);
    case 'docx':
      return parseDocx(filePath);
    default:
      throw new Error(`Unsupported file type: ${type}`);
  }
}
