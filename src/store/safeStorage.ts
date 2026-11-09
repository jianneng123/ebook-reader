import type { StorageLike } from './progress';

/** file:// 下部分浏览器会禁用 localStorage，降级到内存存储，保证不白屏。 */
export function browserStorage(): StorageLike {
  try {
    const probe = '__reader_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
    };
  }
}
