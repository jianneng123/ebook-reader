import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { parseBook } from './parse';
import type { Book, FileMeta, Settings } from './parse/types';
import { buildIndex, offsetToPercent } from './model/offsetIndex';
import {
  clearProgress,
  createThrottledSaver,
  loadProgress,
} from './store/progress';
import { loadSettings, saveSettings } from './store/settings';
import { browserStorage } from './store/safeStorage';
import { fingerprint } from './store/fingerprint';
import { createBookStore, type StoredBook } from './store/bookStore';
import {
  MAX_BOOKS,
  addToShelf,
  clampPage,
  pageCount,
  removeFromShelf,
  type BookEncoding,
  type ShelfItem,
} from './store/shelf';
import { ReaderView } from './ui/ReaderView';
import { ProgressBar } from './ui/ProgressBar';
import { ShelfView } from './ui/ShelfView';
import { versionLabel } from './version';
import './styles.css';

const LARGE_FILE_BYTES = 2 * 1024 * 1024;
const storage = browserStorage();
const saver = createThrottledSaver(storage);
const store = createBookStore();
document.title = `电子书阅读器 ${versionLabel()}`;

type View = 'shelf' | 'reader';
type Loaded = { id: string; book: Book; meta: FileMeta; buffer: ArrayBuffer };
type ImportStats = {
  ok: number;
  duplicate: number;
  full: number;
  invalid: number;
  error: number;
};

function App() {
  const [view, setView] = useState<View>('shelf');
  const [books, setBooks] = useState<ShelfItem[]>([]);
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage));
  const [encoding, setEncoding] = useState<BookEncoding>('auto');
  const [offset, setOffset] = useState(0);
  const [restoreOffset, setRestoreOffset] = useState(0);
  const [jump, setJump] = useState<{ percent: number; token: number } | null>(null);
  const [notice, setNotice] = useState('');

  const index = useMemo(
    () => (loaded ? buildIndex(loaded.book.paragraphs) : null),
    [loaded],
  );

  // 启动：从 IndexedDB 恢复书架，并给每本书附上各自进度。
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const summaries = await store.list();
      if (cancelled) return;
      setBooks(
        summaries.map((book) => ({
          ...book,
          percent: loadProgress(storage, book.id)?.percent ?? 0,
        })),
      );
      if (store.mode === 'memory') {
        setNotice('当前环境不支持 IndexedDB，书架仅本次会话有效；用本地 http 服务打开可永久保留。');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const flush = () => saver.flush();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(storage, next);
  };

  /** 解析结果统一覆盖成指纹 ID，阅读层仍只认 Book。 */
  const bookFromBuffer = (
    buffer: ArrayBuffer,
    meta: FileMeta,
    enc: BookEncoding,
    id: string,
  ): Book => {
    const parsed = parseBook(buffer, {
      ...meta,
      encoding: enc === 'auto' ? undefined : enc,
    });
    return { ...parsed, id };
  };

  const importFiles = async (files: File[]) => {
    const stats: ImportStats = { ok: 0, duplicate: 0, full: 0, invalid: 0, error: 0 };
    let next = books;

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.txt')) {
        stats.invalid += 1;
        continue;
      }
      let buffer: ArrayBuffer;
      try {
        buffer = await file.arrayBuffer();
      } catch {
        stats.error += 1;
        continue;
      }
      const item: ShelfItem = {
        id: fingerprint(buffer),
        title: file.name.replace(/\.txt$/i, ''),
        fileName: file.name,
        size: file.size,
        encoding: 'auto',
        addedAt: Date.now(),
        lastReadAt: 0,
        percent: 0,
      };
      const result = addToShelf(next, item);
      if (result.reason !== 'ok') {
        stats[result.reason] += 1;
        next = result.items;
        continue;
      }
      const record: StoredBook = {
        id: item.id,
        title: item.title,
        fileName: item.fileName,
        size: item.size,
        encoding: item.encoding,
        buffer,
        addedAt: item.addedAt,
        lastReadAt: item.lastReadAt,
      };
      await store.put(record);
      next = result.items;
      stats.ok += 1;
    }

    setBooks(next);
    // 新导入的书排在末尾，直接跳到最后一页让用户看到结果。
    setPage(clampPage(pageCount(next.length), next.length));

    if (stats.full > 0) {
      setNotice(
        `书架已满（${MAX_BOOKS}/${MAX_BOOKS}），请先删除一本再导入；本次拒绝 ${stats.full} 本`,
      );
    } else {
      const parts = [`成功导入 ${stats.ok} 本`];
      if (stats.duplicate) parts.push(`重复跳过 ${stats.duplicate} 本`);
      if (stats.invalid) parts.push(`非 .txt 跳过 ${stats.invalid} 本`);
      if (stats.error) parts.push(`读取失败 ${stats.error} 本`);
      setNotice(parts.join('；'));
    }
  };

  const openBook = async (id: string) => {
    saver.flush();
    const record = await store.get(id);
    if (!record) {
      setNotice('书籍内容已丢失，请重新导入');
      return;
    }
    const meta: FileMeta = { name: record.fileName, size: record.size };
    const book = bookFromBuffer(record.buffer, meta, record.encoding, record.id);
    const saved = loadProgress(storage, record.id);
    const initial =
      saved?.locator.type === 'offset' && typeof saved.locator.value === 'number'
        ? saved.locator.value
        : 0;

    setLoaded({ id: record.id, book, meta, buffer: record.buffer });
    setEncoding(record.encoding);
    setRestoreOffset(initial);
    setOffset(initial);
    setActiveId(record.id);
    setView('reader');
    setNotice(
      record.buffer.byteLength > LARGE_FILE_BYTES
        ? '文件较大（超过 2 MB），已启用分块渲染'
        : '',
    );
    await store.touch(record.id);
  };

  const backToShelf = () => {
    saver.flush();
    setBooks((prev) =>
      prev.map((book) => ({
        ...book,
        percent: loadProgress(storage, book.id)?.percent ?? 0,
      })),
    );
    setView('shelf');
    setNotice('');
  };

  const switchEncoding = async (next: BookEncoding) => {
    setEncoding(next);
    if (!loaded) return;
    const book = bookFromBuffer(loaded.buffer, loaded.meta, next, loaded.id);
    clearProgress(storage, loaded.id);
    setLoaded({ ...loaded, book });
    setRestoreOffset(0);
    setOffset(0);
    const record = await store.get(loaded.id);
    if (record) await store.put({ ...record, encoding: next });
    setBooks((prev) =>
      prev.map((item) =>
        item.id === loaded.id ? { ...item, encoding: next, percent: 0 } : item,
      ),
    );
    setNotice('编码已切换，进度已重置');
  };

  const handleOffsetChange = (next: number) => {
    setOffset(next);
    if (!loaded || !index) return;
    saver.save({
      bookId: loaded.id,
      locator: { type: 'offset', value: next },
      percent: offsetToPercent(index, next),
      updatedAt: Date.now(),
    });
  };

  const deleteBook = async (id: string) => {
    const target = books.find((book) => book.id === id);
    if (!target) return;
    if (!window.confirm(`确定从书架删除《${target.title}》？该书的阅读进度也会清除。`)) {
      return;
    }
    saver.flush();
    await store.remove(id);
    clearProgress(storage, id);
    const next = removeFromShelf(books, id);
    setBooks(next);
    setPage(clampPage(page, next.length));
    if (activeId === id) {
      setLoaded(null);
      setActiveId(null);
      setView('shelf');
    }
    setNotice(`已删除《${target.title}》`);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) void importFiles(files);
  };

  return (
    <div
      class="app"
      data-theme={settings.theme}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <header class="toolbar">
        <h1 class="app-title">电子书阅读器</h1>
        <span class="app-version" data-testid="app-version" title="构建版本，来源 package.json">
          {versionLabel()}
        </span>
        {view === 'reader' ? (
          <>
            <button class="btn" onClick={backToShelf}>
              ← 返回书架
            </button>
            <span class="current-book" title={loaded?.book.title}>
              {loaded?.book.title}
            </span>
            <select
              class="encoding-select"
              aria-label="编码"
              value={encoding}
              onChange={(event) =>
                void switchEncoding((event.target as HTMLSelectElement).value as BookEncoding)
              }
            >
              <option value="auto">自动编码</option>
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
            </select>
          </>
        ) : (
          <span class="shelf-count" data-count={books.length}>
            我的书架 · {books.length} / {MAX_BOOKS} 本
          </span>
        )}

        <div class="setting-group" aria-label="字号">
          {([1, 2, 3] as const).map((size, i) => (
            <button
              class={`btn ${settings.fontSize === size ? 'active' : ''}`}
              onClick={() => updateSettings({ fontSize: size })}
              key={size}
            >
              {['小', '中', '大'][i]}
            </button>
          ))}
        </div>
        <div class="setting-group" aria-label="行距">
          <button
            class={`btn ${settings.lineHeight === 1 ? 'active' : ''}`}
            onClick={() => updateSettings({ lineHeight: 1 })}
          >
            标准行距
          </button>
          <button
            class={`btn ${settings.lineHeight === 2 ? 'active' : ''}`}
            onClick={() => updateSettings({ lineHeight: 2 })}
          >
            宽松行距
          </button>
        </div>
        <button
          class="btn"
          onClick={() =>
            updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })
          }
        >
          {settings.theme === 'light' ? '夜间' : '白天'}
        </button>
      </header>

      {notice && <div class="notice">{notice}</div>}

      {view === 'shelf' ? (
        <ShelfView
          books={books}
          page={page}
          onPageChange={setPage}
          onOpen={(id) => void openBook(id)}
          onDelete={(id) => void deleteBook(id)}
          onImport={(files) => void importFiles(files)}
        />
      ) : loaded && index ? (
        <>
          <ProgressBar
            value={offsetToPercent(index, offset)}
            onJump={(percent) => setJump({ percent, token: Date.now() })}
          />
          <ReaderView
            book={loaded.book}
            settings={settings}
            index={index}
            initialOffset={restoreOffset}
            jump={jump}
            onOffsetChange={handleOffsetChange}
          />
        </>
      ) : (
        <div class="empty">书籍内容不可用，请返回书架重新选择</div>
      )}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
