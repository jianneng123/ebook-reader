import type { FileMeta } from '../parse/types';

/** F1：读取本地文件，只在内存持有 ArrayBuffer，不落库（PRD §6）。 */
export async function readLocalFile(
  file: File,
): Promise<{ buffer: ArrayBuffer; meta: FileMeta }> {
  const buffer = await file.arrayBuffer();
  return { buffer, meta: { name: file.name, size: file.size } };
}
