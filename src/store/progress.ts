import type { Progress } from '../parse/types';

export const PROGRESS_KEY = 'reader:progress:v1';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type StoredProgress = { version: 1; books: Record<string, Progress> };

function empty(): StoredProgress {
  return { version: 1, books: {} };
}

function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Progress>;
  const locator = p.locator as { type?: unknown; value?: unknown } | undefined;
  return (
    typeof p.bookId === 'string' &&
    !!locator &&
    (locator.type === 'offset' || locator.type === 'cfi') &&
    (typeof locator.value === 'number' || typeof locator.value === 'string') &&
    typeof p.percent === 'number' &&
    Number.isFinite(p.percent) &&
    typeof p.updatedAt === 'number'
  );
}

/** 读取损坏 / 旧 schema 一律回空集合，禁止白屏。 */
export function loadAll(storage: StorageLike): StoredProgress {
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (!raw) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty();
    const candidate = parsed as { version?: unknown; books?: unknown };
    if (candidate.version !== 1 || !candidate.books || typeof candidate.books !== 'object') {
      return empty();
    }
    const books: Record<string, Progress> = {};
    for (const [id, value] of Object.entries(candidate.books as Record<string, unknown>)) {
      if (isProgress(value)) books[id] = value;
    }
    return { version: 1, books };
  } catch {
    return empty();
  }
}

export function loadProgress(storage: StorageLike, id: string): Progress | null {
  return loadAll(storage).books[id] ?? null;
}

export function saveProgress(storage: StorageLike, progress: Progress): void {
  const all = loadAll(storage);
  all.books[progress.bookId] = progress;
  storage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

/** F2 手动切换编码后调用：字符偏移失效，重置该书进度（TECH_DESIGN §5 F2）。 */
export function clearProgress(storage: StorageLike, id: string): void {
  const all = loadAll(storage);
  delete all.books[id];
  storage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

/** 滚动时节流写入，页面隐藏 / 关闭由调用方 flush() 强制落盘。 */
export function createThrottledSaver(storage: StorageLike, waitMs = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Progress | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      saveProgress(storage, pending);
      pending = null;
    }
  };

  return {
    save(progress: Progress) {
      pending = progress;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, waitMs);
    },
    flush,
  };
}
