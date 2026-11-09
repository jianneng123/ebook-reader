/** 书架纯逻辑：去重 / 50 本上限 / 分页 / 删除。与 IndexedDB 解耦，便于 Node 单测全覆盖。 */

export const MAX_BOOKS = 50;
export const PAGE_SIZE = 12;

export type BookEncoding = 'auto' | 'utf-8' | 'gbk';

export type ShelfItem = {
  id: string;
  title: string;
  fileName: string;
  size: number;
  encoding: BookEncoding;
  addedAt: number;
  lastReadAt: number;
  percent?: number;
};

export type AddReason = 'ok' | 'duplicate' | 'full';
export type AddResult = { items: ShelfItem[]; reason: AddReason };

/** 判定顺序：先去重再判上限，避免「同一本书」在满架时被误报已满。 */
export function addToShelf(items: ShelfItem[], candidate: ShelfItem): AddResult {
  if (items.some((book) => book.id === candidate.id)) {
    return { items, reason: 'duplicate' };
  }
  if (items.length >= MAX_BOOKS) {
    return { items, reason: 'full' };
  }
  return { items: [...items, candidate], reason: 'ok' };
}

export function removeFromShelf(items: ShelfItem[], id: string): ShelfItem[] {
  return items.filter((book) => book.id !== id);
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total));
}

export function pageItems(items: ShelfItem[], page: number): ShelfItem[] {
  const current = clampPage(page, items.length);
  return items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
}

export function withReadAt(items: ShelfItem[], id: string, at: number): ShelfItem[] {
  return items.map((book) => (book.id === id ? { ...book, lastReadAt: at } : book));
}
