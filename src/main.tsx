import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { readLocalFile } from './io/fileReader';
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
import { ReaderView } from './ui/ReaderView';
import { ProgressBar } from './ui/ProgressBar';
import './styles.css';

const LARGE_FILE_BYTES = 2 * 1024 * 1024;
const storage = browserStorage();
const saver = createThrottledSaver(storage);

type Loaded = { book: Book; meta: FileMeta; buffer: ArrayBuffer };

function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage));
  const [encoding, setEncoding] = useState('auto');
  const [offset, setOffset] = useState(0);
  const [restoreOffset, setRestoreOffset] = useState(0);
  const [jump, setJump] = useState<{ percent: number; token: number } | null>(null);
  const [notice, setNotice] = useState('');
  const dragDepth = useRef(0);

  const index = useMemo(
    () => (loaded ? buildIndex(loaded.book.paragraphs) : null),
    [loaded],
  );

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

  const applyEncoding = (buffer: ArrayBuffer, meta: FileMeta, next: string) => {
    return parseBook(buffer, {
      ...meta,
      encoding: next === 'auto' ? undefined : next,
    });
  };

  const openFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setNotice('请选择 .txt 文件');
      return;
    }
    const { buffer, meta } = await readLocalFile(file);
    const book = applyEncoding(buffer, meta, encoding);
    const saved = loadProgress(storage, book.id);
    const initial =
      saved?.locator.type === 'offset' && typeof saved.locator.value === 'number'
        ? saved.locator.value
        : 0;
    setLoaded({ book, meta, buffer });
    setRestoreOffset(initial);
    setOffset(initial);
    setNotice(
      buffer.byteLength > LARGE_FILE_BYTES
        ? '文件较大（超过 2 MB），已启用分块渲染'
        : '',
    );
  };

  const switchEncoding = (next: string) => {
    setEncoding(next);
    if (!loaded) return;
    const book = applyEncoding(loaded.buffer, loaded.meta, next);
    clearProgress(storage, book.id);
    setLoaded({ ...loaded, book });
    setRestoreOffset(0);
    setOffset(0);
    setNotice('编码已切换，进度已重置');
  };

  const handleOffsetChange = (next: number) => {
    setOffset(next);
    if (!loaded || !index) return;
    saver.save({
      bookId: loaded.book.id,
      locator: { type: 'offset', value: next },
      percent: offsetToPercent(index, next),
      updatedAt: Date.now(),
    });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    const file = event.dataTransfer?.files?.[0];
    if (file) void openFile(file);
  };

  return (
    <div
      class="app"
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => {
        dragDepth.current += 1;
      }}
      onDragLeave={() => {
        dragDepth.current -= 1;
      }}
      onDrop={onDrop}
    >
      <header class="toolbar">
        <h1 class="app-title">电子书阅读器</h1>
        <label class="file-picker">
          打开 TXT
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) void openFile(file);
            }}
          />
        </label>
        <select
          class="encoding-select"
          aria-label="编码"
          value={encoding}
          onChange={(event) => switchEncoding((event.target as HTMLSelectElement).value)}
        >
          <option value="auto">自动编码</option>
          <option value="utf-8">UTF-8</option>
          <option value="gbk">GBK</option>
        </select>
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

      {loaded && index ? (
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
        <div class="empty">选择或拖入一个 .txt 文件开始阅读</div>
      )}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
