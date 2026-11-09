import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseBook } from '../../src/parse';
import {
  MAX_PARAGRAPH,
  bookId,
  detectEncoding,
  normalizeParagraphs,
  parseTxt,
} from '../../src/parse/txtParser';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../fixtures');
const REPLACEMENT = '\uFFFD';

function bytes(name: string): ArrayBuffer {
  const buffer = readFileSync(resolve(fixtures, name));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function fileMeta(name: string, size: number, encoding?: string) {
  return encoding ? { name, size, encoding } : { name, size };
}

describe('F2 编码检测', () => {
  it('UTF-8 无 BOM → utf-8', () => {
    expect(detectEncoding(bytes('utf8-novel.txt'))).toEqual({
      encoding: 'utf-8',
      hadBom: false,
    });
  });

  it('UTF-8 BOM → utf-8 + hadBom', () => {
    expect(detectEncoding(bytes('utf8-bom.txt'))).toEqual({
      encoding: 'utf-8',
      hadBom: true,
    });
  });

  it('GBK 中文 → gbk', () => {
    expect(detectEncoding(bytes('gbk-novel.txt'))).toEqual({
      encoding: 'gbk',
      hadBom: false,
    });
  });
});

describe('F2/F3 真实样本（PRD §5.4-1）', () => {
  it('3 本真实中文 TXT 均无乱码、段落可读、不超过单段上限', () => {
    const cases = [
      ['utf8-novel.txt', '青石镇'],
      ['utf8-bom.txt', '旧书店'],
      ['gbk-novel.txt', '旧书店'],
    ] as const;
    for (const [name, keyword] of cases) {
      const buffer = bytes(name);
      const book = parseTxt(buffer, fileMeta(name, buffer.byteLength));
      const text = book.paragraphs.join('');
      expect(text, name).not.toContain(REPLACEMENT);
      expect(text, name).not.toContain('锟斤拷');
      expect(text, name).toContain(keyword);
      expect(book.paragraphs.length, name).toBeGreaterThan(1);
      expect(book.paragraphs.every((p) => p.length <= MAX_PARAGRAPH), name).toBe(true);
    }
  });

  it('BOM 不进入正文', () => {
    const buffer = bytes('utf8-bom.txt');
    const book = parseTxt(buffer, fileMeta('utf8-bom.txt', buffer.byteLength));
    expect(book.paragraphs.join('')).not.toContain('\uFEFF');
  });

  it('硬换行被合并，不出现一行一段', () => {
    const buffer = bytes('utf8-bom.txt');
    const decoded = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
    const lineCount = decoded.split('\n').filter((line) => line.trim()).length;
    const book = parseTxt(buffer, fileMeta('utf8-bom.txt', buffer.byteLength));
    expect(lineCount).toBeGreaterThan(5);
    expect(book.paragraphs.length).toBeLessThan(lineCount);
    expect(book.paragraphs.length).toBeGreaterThan(1);
  });

  it('段首全角空格缩进被保留', () => {
    const buffer = bytes('utf8-novel.txt');
    const book = parseTxt(buffer, fileMeta('utf8-novel.txt', buffer.byteLength));
    expect(book.paragraphs.some((p) => p.startsWith('\u3000'))).toBe(true);
  });

  it('手动切换编码生效，且可切回自动', () => {
    const buffer = bytes('gbk-novel.txt');
    const forced = parseTxt(
      buffer,
      fileMeta('gbk-novel.txt', buffer.byteLength, 'utf-8'),
    );
    expect(forced.paragraphs.join('')).toContain(REPLACEMENT);
    const auto = parseTxt(buffer, fileMeta('gbk-novel.txt', buffer.byteLength));
    expect(auto.paragraphs.join('')).not.toContain(REPLACEMENT);
  });
});

describe('F3 段落规范化边界', () => {
  it('超长无空行文本按上限断段，不连成一整坨', () => {
    const paragraphs = normalizeParagraphs('中文句子没有空行。'.repeat(200));
    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs.every((p) => p.length <= MAX_PARAGRAPH)).toBe(true);
  });

  it('空文本返回单个空段', () => {
    expect(normalizeParagraphs('')).toEqual(['']);
  });

  it('空行分段优先', () => {
    expect(normalizeParagraphs('第一段文字。\n\n第二段文字。')).toEqual([
      '第一段文字。',
      '第二段文字。',
    ]);
  });
});

describe('统一模型与 bookId', () => {
  it('bookId = 文件名 + 字节大小', () => {
    expect(bookId({ name: 'a.txt', size: 123 })).toBe('a.txt:123');
  });

  it('parseBook 输出统一 Book 契约', () => {
    const buffer = bytes('utf8-novel.txt');
    const book = parseBook(buffer, fileMeta('utf8-novel.txt', buffer.byteLength));
    expect(book.format).toBe('txt');
    expect(book.title).toBe('utf8-novel');
    expect(book.chapters).toEqual([]);
    expect(book.id).toBe(`utf8-novel.txt:${buffer.byteLength}`);
  });
});
