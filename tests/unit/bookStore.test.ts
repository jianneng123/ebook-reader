import { describe, expect, it } from 'vitest';
import { createBookStore, type StoredBook } from '../../src/store/bookStore';

const book = (id: string): StoredBook => ({
  id,
  title: `书${id}`,
  fileName: `书${id}.txt`,
  size: 12,
  encoding: 'auto',
  buffer: new TextEncoder().encode(`内容-${id}`).buffer,
  addedAt: 1,
  lastReadAt: 0,
});

describe('书库降级路径（TECH_DESIGN-v0.2 ADR-007）', () => {
  it('Node 无 IndexedDB 时自动降级为内存书架，不抛错', async () => {
    const store = createBookStore();
    await store.list();
    expect(store.mode).toBe('memory');
  });

  it('内存模式下 put / get / list / remove / touch 完整可用', async () => {
    const store = createBookStore();
    await store.list();
    await store.put(book('a'));
    await store.put(book('b'));

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0]).not.toHaveProperty('buffer');
    expect((await store.get('a'))?.buffer.byteLength).toBeGreaterThan(0);

    await store.touch('a');
    expect((await store.get('a'))?.lastReadAt).toBeGreaterThan(0);

    await store.remove('a');
    expect(await store.list()).toHaveLength(1);
    expect(await store.get('a')).toBeNull();
  });
});
