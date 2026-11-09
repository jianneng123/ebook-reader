import type { BookEncoding } from './shelf';

const DB_NAME = 'ebook-reader';
const DB_VERSION = 1;
const STORE = 'books';

/** 原始字节保留，便于重新解析与按书切换编码。 */
export type StoredBook = {
  id: string;
  title: string;
  fileName: string;
  size: number;
  encoding: BookEncoding;
  buffer: ArrayBuffer;
  addedAt: number;
  lastReadAt: number;
};

export type BookSummary = {
  id: string;
  title: string;
  fileName: string;
  size: number;
  encoding: BookEncoding;
  addedAt: number;
  lastReadAt: number;
};

export type BookStore = {
  readonly mode: 'indexeddb' | 'memory';
  list(): Promise<BookSummary[]>;
  get(id: string): Promise<StoredBook | null>;
  put(book: StoredBook): Promise<void>;
  remove(id: string): Promise<void>;
  touch(id: string): Promise<void>;
};

function summary(book: StoredBook): BookSummary {
  return {
    id: book.id,
    title: book.title,
    fileName: book.fileName,
    size: book.size,
    encoding: book.encoding,
    addedAt: book.addedAt,
    lastReadAt: book.lastReadAt,
  };
}

function runRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * IndexedDB 存全文；不可用时（例如 file:// 受限）自动降级为内存书架，
 * 保证页面不白屏，只是本次会话有效。
 */
export function createBookStore(): BookStore {
  let backend: 'indexeddb' | 'memory' = 'indexeddb';
  let opening: Promise<IDBDatabase | null> | null = null;
  const memory = new Map<string, StoredBook>();

  const open = (): Promise<IDBDatabase | null> => {
    if (backend === 'memory') return Promise.resolve(null);
    if (opening) return opening;
    opening = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        backend = 'memory';
        resolve(null);
        return;
      }
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          backend = 'memory';
          resolve(null);
        };
        request.onblocked = () => {
          backend = 'memory';
          resolve(null);
        };
      } catch {
        backend = 'memory';
        resolve(null);
      }
    });
    return opening;
  };

  const switchToMemory = async (db: IDBDatabase | null) => {
    if (backend === 'memory') return;
    if (db) {
      const all = await runRequest<StoredBook[]>(
        db,
        'readonly',
        (store) => store.getAll() as IDBRequest<StoredBook[]>,
      );
      for (const book of all ?? []) memory.set(book.id, book);
    }
    backend = 'memory';
    opening = null;
  };

  const list = async (): Promise<BookSummary[]> => {
    const db = await open();
    if (!db) return Array.from(memory.values(), summary);
    const all = await runRequest<StoredBook[]>(
      db,
      'readonly',
      (store) => store.getAll() as IDBRequest<StoredBook[]>,
    );
    if (all === null) {
      await switchToMemory(db);
      return Array.from(memory.values(), summary);
    }
    return all.map(summary);
  };

  const get = async (id: string): Promise<StoredBook | null> => {
    const db = await open();
    if (!db) return memory.get(id) ?? null;
    const found = await runRequest<StoredBook | undefined>(
      db,
      'readonly',
      (store) => store.get(id) as IDBRequest<StoredBook | undefined>,
    );
    if (found === null) {
      await switchToMemory(db);
      return memory.get(id) ?? null;
    }
    return found ?? null;
  };

  const put = async (book: StoredBook): Promise<void> => {
    const db = await open();
    if (!db) {
      memory.set(book.id, book);
      return;
    }
    const result = await runRequest<IDBValidKey>(
      db,
      'readwrite',
      (store) => store.put(book) as IDBRequest<IDBValidKey>,
    );
    if (result === null) {
      await switchToMemory(db);
      memory.set(book.id, book);
    }
  };

  const remove = async (id: string): Promise<void> => {
    const db = await open();
    if (db) {
      const result = await runRequest<undefined>(
        db,
        'readwrite',
        (store) => store.delete(id) as IDBRequest<undefined>,
      );
      if (result === null) await switchToMemory(db);
    }
    memory.delete(id);
  };

  const touch = async (id: string): Promise<void> => {
    const record = await get(id);
    if (record) await put({ ...record, lastReadAt: Date.now() });
  };

  return {
    get mode() {
      return backend;
    },
    list,
    get,
    put,
    remove,
    touch,
  };
}
