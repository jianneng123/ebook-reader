import { describe, expect, it } from 'vitest';
import type { Progress } from '../../src/parse/types';
import {
  PROGRESS_KEY,
  clearProgress,
  createThrottledSaver,
  loadAll,
  loadProgress,
  saveProgress,
} from '../../src/store/progress';
import type { StorageLike } from '../../src/store/progress';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
} from '../../src/store/settings';

function memoryStorage() {
  const data = new Map<string, string>();
  const storage: StorageLike & { raw(key: string): string | undefined } = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    raw: (key) => data.get(key),
  };
  return storage;
}

function progress(bookId: string, offset: number): Progress {
  return {
    bookId,
    locator: { type: 'offset', value: offset },
    percent: offset,
    updatedAt: 1_700_000_000_000,
  };
}

describe('F5 进度持久化', () => {
  it('写入后可读取，多本书互不覆盖', () => {
    const storage = memoryStorage();
    saveProgress(storage, progress('a.txt:10', 100));
    saveProgress(storage, progress('b.txt:20', 200));
    expect(loadProgress(storage, 'a.txt:10')?.locator.value).toBe(100);
    expect(loadProgress(storage, 'b.txt:20')?.locator.value).toBe(200);
    expect(Object.keys(loadAll(storage).books)).toHaveLength(2);
  });

  it('损坏 JSON / 旧 schema / 非法记录一律回空集合，不白屏', () => {
    const storage = memoryStorage();
    storage.setItem(PROGRESS_KEY, '{not json');
    expect(loadProgress(storage, 'a.txt:10')).toBeNull();

    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, books: {} }));
    expect(loadProgress(storage, 'a.txt:10')).toBeNull();

    storage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, books: { bad: { bookId: 1 } } }),
    );
    expect(loadProgress(storage, 'bad')).toBeNull();
  });

  it('clearProgress 只删目标书（编码切换重置）', () => {
    const storage = memoryStorage();
    saveProgress(storage, progress('a.txt:10', 100));
    saveProgress(storage, progress('b.txt:20', 200));
    clearProgress(storage, 'a.txt:10');
    expect(loadProgress(storage, 'a.txt:10')).toBeNull();
    expect(loadProgress(storage, 'b.txt:20')?.locator.value).toBe(200);
  });

  it('节流写入，flush 后强制落盘', () => {
    const storage = memoryStorage();
    const saver = createThrottledSaver(storage, 10_000);
    saver.save(progress('a.txt:10', 100));
    expect(storage.raw(PROGRESS_KEY)).toBeUndefined();
    saver.flush();
    expect(loadProgress(storage, 'a.txt:10')?.locator.value).toBe(100);
  });
});

describe('F4 阅读设置持久化', () => {
  it('默认设置', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('保存后重启可恢复', () => {
    const storage = memoryStorage();
    saveSettings(storage, { fontSize: 3, lineHeight: 2, theme: 'dark' });
    expect(loadSettings(storage)).toEqual({ fontSize: 3, lineHeight: 2, theme: 'dark' });
  });

  it('非法值 / 损坏 JSON 回默认值', () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_KEY, '{bad');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    storage.setItem(SETTINGS_KEY, JSON.stringify({ fontSize: 9, lineHeight: 7, theme: 'x' }));
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });
});
