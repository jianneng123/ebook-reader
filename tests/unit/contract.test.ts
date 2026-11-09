import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Book, Parser } from '../../src/parse/types';
import { DEFAULT_SETTINGS } from '../../src/store/settings';
import { BLOCK_SIZE, createViewModel, totalBlocks } from '../../src/ui/viewModel';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

/** 假解析器：返回 EPUB 格式的 Book，用来证明阅读层不认 TXT 具体实现。 */
const fakeBook: Book = {
  id: 'fake:1',
  title: '假解析器之书',
  format: 'epub',
  paragraphs: ['甲', '乙', '丙'],
  chapters: [],
};
const fakeParser: Parser = { parse: () => fakeBook };

describe('F7 解析层解耦（PRD §5.4-4）', () => {
  it('阅读层可由任意 Parser 产出的 Book 驱动，format=epub 同样渲染', () => {
    const book = fakeParser.parse(new ArrayBuffer(0), { name: 'x.epub', size: 0 });
    const vm = createViewModel(book, DEFAULT_SETTINGS);
    expect(vm.title).toBe('假解析器之书');
    expect(vm.blocks[0]).toEqual(['甲', '乙', '丙']);
    expect(vm.paragraphCount).toBe(3);
  });

  it('阅读层源码不引用 TXT 解析器实现', () => {
    for (const file of [
      'src/ui/viewModel.ts',
      'src/ui/ReaderView.tsx',
      'src/ui/ProgressBar.tsx',
    ]) {
      const source = readFileSync(resolve(root, file), 'utf-8');
      expect(source, file).not.toContain('txtParser');
      expect(source, file).not.toContain('parse/txtParser');
    }
  });

  it('设置即时生效：字号 / 行距 / 主题映射到样式', () => {
    const vm = createViewModel(fakeBook, { fontSize: 3, lineHeight: 2, theme: 'dark' });
    expect(vm.cssVars['--reader-font-size']).toBe('23px');
    expect(vm.cssVars['--reader-line-height']).toBe('2.1');
    expect(vm.theme).toBe('dark');
  });

  it('分块渲染按 200 段切块，不首屏生成全部 DOM', () => {
    const many = Array.from({ length: 450 }, (_, i) => `第${i}段`);
    const book = { ...fakeBook, paragraphs: many };
    expect(totalBlocks(many.length)).toBe(3);
    const vm = createViewModel(book, DEFAULT_SETTINGS, 3);
    expect(vm.blocks).toHaveLength(3);
    expect(vm.blocks[0]).toHaveLength(BLOCK_SIZE);
  });
});
