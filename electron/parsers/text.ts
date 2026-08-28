// TXT 和 Markdown 文件解析器
export async function parseText(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return content;
}
