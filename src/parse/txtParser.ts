import type { Book, FileMeta, Parser } from './types';

/** F2 编码检测：BOM → UTF-8 fatal 试探 → GBK；猜错时由调用方传 meta.encoding 手动切换。 */
export type Encoding = 'utf-8' | 'gbk';

/** 单段最大长度，防止无空行长篇连成一整坨（PRD §6）。 */
export const MAX_PARAGRAPH = 800;
const MIN_PARAGRAPH = 40;
const SENTENCE_END = /[。！？!?…"”』」）)\]】]$/;
const INDENT = /^[\s\u3000]/;

export function detectEncoding(buffer: ArrayBuffer): { encoding: Encoding; hadBom: boolean } {
  const bytes = new Uint8Array(buffer);
  const hadBom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (hadBom) return { encoding: 'utf-8', hadBom: true };
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { encoding: 'utf-8', hadBom: false };
  } catch {
    return { encoding: 'gbk', hadBom: false };
  }
}

export function decodeText(buffer: ArrayBuffer, encoding: Encoding, stripBom = false): string {
  const bytes = new Uint8Array(buffer);
  const view = stripBom ? bytes.subarray(3) : bytes;
  // WHATWG Encoding Standard 将 gbk 列为准入标签，浏览器与 Node(full-icu) 均内置。
  return new TextDecoder(encoding).decode(view);
}

/** F3 段落规范化：空行分段优先；无空行时按句末标点、段首缩进与长度上限断段。 */
export function normalizeParagraphs(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const hasBlankLine = lines.some((line) => line.trim() === '');
  const result: string[] = [];
  let current = '';

  const flush = () => {
    // 只去段尾空白，段首全角空格缩进必须保留。
    const value = current.replace(/\s+$/, '');
    if (value.length > 0) result.push(value);
    current = '';
  };

  for (const line of lines) {
    const clean = line.replace(/\s+$/, '');
    if (clean.trim() === '') {
      flush();
      continue;
    }

    if (current && INDENT.test(clean)) flush();
    if (current && current.length + clean.length > MAX_PARAGRAPH) flush();

    current += clean;

    // 单行本身超长时按上限切片，防止「一整坨」。
    if (current.length >= MAX_PARAGRAPH) {
      for (let start = 0; start < current.length; start += MAX_PARAGRAPH) {
        const piece = current.slice(start, start + MAX_PARAGRAPH).replace(/\s+$/, '');
        if (piece.trim()) result.push(piece);
      }
      current = '';
      continue;
    }
    if (!hasBlankLine && current.length >= MIN_PARAGRAPH && SENTENCE_END.test(current)) flush();
  }
  flush();
  return result.length > 0 ? result : [''];
}

/** bookId = 文件名 + 字节大小；文件被编辑后 size 变化即视为不同书（PRD §6）。 */
export function bookId(meta: FileMeta): string {
  return `${meta.name}:${meta.size}`;
}

export function parseTxt(input: ArrayBuffer, meta: FileMeta): Book {
  const forced =
    meta.encoding === 'utf-8' || meta.encoding === 'gbk'
      ? (meta.encoding as Encoding)
      : undefined;
  const detected = detectEncoding(input);
  const encoding = forced ?? detected.encoding;
  const stripBom = !forced && detected.hadBom;
  const text = decodeText(input, encoding, stripBom);

  return {
    id: bookId(meta),
    title: meta.name.replace(/\.txt$/i, ''),
    format: 'txt',
    paragraphs: normalizeParagraphs(text),
    chapters: [],
  };
}

export const txtParser: Parser = { parse: parseTxt };
