import { describe, expect, it } from 'vitest';
import {
  MAX_BOOKS,
  PAGE_SIZE,
  addToShelf,
  clampPage,
  pageCount,
  pageItems,
  removeFromShelf,
  withReadAt,
  type ShelfItem,
} from '../../src/store/shelf';

const item = (n: number): ShelfItem => ({
  id: `fp-${n}`,
  title: `书${n}`,
  fileName: `书${n}.txt`,
  size: 100 + n,
  encoding: 'auto',
  addedAt: n,
  lastReadAt: 0,
});

const many = (count: number) => Array.from({ length: count }, (_, i) => item(i + 1));

describe('书架纯逻辑（PRD-v0.2 R1 / R3 / R9 / R10 / R11）', () => {
  it('常量：上限 50 本、每页 12 本', () => {
    expect(MAX_BOOKS).toBe(50);
    expect(PAGE_SIZE).toBe(12);
  });

  it('分页页数：0 本也至少 1 页，12 本 1 页，13 本 2 页', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(12)).toBe(1);
    expect(pageCount(13)).toBe(2);
    expect(pageCount(50)).toBe(5);
  });

  it('分页切片与越界夹取', () => {
    const items = many(13);
    expect(pageItems(items, 1)).toHaveLength(12);
    expect(pageItems(items, 2)).toEqual([items[12]]);
    expect(pageItems(items, 99)).toEqual([items[12]]);
    expect(clampPage(-3, 13)).toBe(1);
    expect(clampPage(2, 5)).toBe(1);
  });

  it('同一内容重复导入被判重，书架不变', () => {
    const items = many(3);
    const result = addToShelf(items, item(2));
    expect(result.reason).toBe('duplicate');
    expect(result.items).toBe(items);
  });

  it('第 51 本被拒绝，满架时重复导入仍优先判重', () => {
    const items = many(50);
    expect(addToShelf(items, item(51)).reason).toBe('full');
    expect(addToShelf(items, item(51)).items).toBe(items);
    expect(addToShelf(items, item(3)).reason).toBe('duplicate');
  });

  it('删除释放名额并更新最近阅读时间', () => {
    const items = withReadAt(many(3), 'fp-2', 12345);
    expect(items[1].lastReadAt).toBe(12345);
    const reduced = removeFromShelf(items, 'fp-2');
    expect(reduced).toHaveLength(2);
    expect(addToShelf(reduced, item(99)).reason).toBe('ok');
  });

  it('满 50 本删除一本后可再导入', () => {
    const reduced = removeFromShelf(many(50), 'fp-1');
    expect(addToShelf(reduced, item(51)).reason).toBe('ok');
  });
});
