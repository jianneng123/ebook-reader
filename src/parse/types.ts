/** PRD §6 统一书籍模型：阅读层只认这些类型，不认任何具体格式实现。 */

export type Locator = { type: 'offset' | 'cfi'; value: number | string };

export type Chapter = { title: string; locator: Locator };

export type Book = {
  id: string;
  title: string;
  format: 'txt' | 'epub';
  paragraphs: string[];
  chapters: Chapter[];
};

export type Progress = {
  bookId: string;
  locator: Locator;
  percent: number;
  updatedAt: number;
};

export type FileMeta = { name: string; size: number; encoding?: string };

export interface Parser {
  parse(input: ArrayBuffer, meta: FileMeta): Book;
}

export type Settings = {
  fontSize: 1 | 2 | 3;
  lineHeight: 1 | 2;
  theme: 'light' | 'dark';
};

