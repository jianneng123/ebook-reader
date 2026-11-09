import type { Book, Settings } from '../parse/types';

/** 分块渲染：每块段落数。超过 2 MB 提示后仍按需挂载，避免首屏一次性生成全部 DOM。 */
export const BLOCK_SIZE = 200;

const FONT_PX: Record<Settings['fontSize'], number> = { 1: 16, 2: 19, 3: 23 };
const LINE_HEIGHT: Record<Settings['lineHeight'], number> = { 1: 1.7, 2: 2.1 };

export type ViewModel = {
  title: string;
  blocks: string[][];
  theme: Settings['theme'];
  cssVars: { '--reader-font-size': string; '--reader-line-height': string };
  paragraphCount: number;
  totalBlocks: number;
};

export function totalBlocks(paragraphs: number): number {
  return Math.max(1, Math.ceil(paragraphs / BLOCK_SIZE));
}

/**
 * 阅读层纯函数：只吃 Book + Settings，不 import 任何解析器实现（F7 / PRD §5.4-4）。
 * 假解析器注入测试即通过本函数驱动。
 */
export function createViewModel(book: Book, settings: Settings, visibleBlocks = 1): ViewModel {
  const count = Math.min(Math.max(1, visibleBlocks), totalBlocks(book.paragraphs.length));
  const blocks: string[][] = [];
  for (let i = 0; i < count; i += 1) {
    blocks.push(book.paragraphs.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE));
  }
  return {
    title: book.title,
    blocks,
    theme: settings.theme,
    cssVars: {
      '--reader-font-size': `${FONT_PX[settings.fontSize]}px`,
      '--reader-line-height': `${LINE_HEIGHT[settings.lineHeight]}`,
    },
    paragraphCount: book.paragraphs.length,
    totalBlocks: totalBlocks(book.paragraphs.length),
  };
}
