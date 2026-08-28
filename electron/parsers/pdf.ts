// PDF 文件解析器
import pdfParse from 'pdf-parse';
import fs from 'fs/promises';

export async function parsePdf(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  const result = await pdfParse(dataBuffer);
  return result.text;
}
