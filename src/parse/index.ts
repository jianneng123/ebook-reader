import type { Book, FileMeta, Parser } from './types';
import { txtParser } from './txtParser';

/**
 * v0.2 唯一切换点：按扩展名注册 EPUB 解析器。
 * 阅读层只调用 parseBook(input, meta) 并消费 Book，不感知具体格式。
 */
export function resolveParser(_meta: FileMeta): Parser {
  return txtParser;
}

export function parseBook(input: ArrayBuffer, meta: FileMeta): Book {
  return resolveParser(meta).parse(input, meta);
}
