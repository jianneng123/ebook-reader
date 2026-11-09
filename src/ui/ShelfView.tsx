import {
  MAX_BOOKS,
  clampPage,
  pageCount,
  pageItems,
  type ShelfItem,
} from '../store/shelf';
import { coverOf } from './cover';

type Props = {
  books: ShelfItem[];
  page: number;
  onPageChange: (page: number) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (files: File[]) => void;
};

/** 书架主界面：分页网格（每页 12 本）+ 文字书封 + 图标下方文件名。 */
export function ShelfView({
  books,
  page,
  onPageChange,
  onOpen,
  onDelete,
  onImport,
}: Props) {
  const total = pageCount(books.length);
  const current = clampPage(page, books.length);
  const items = pageItems(books, current);

  return (
    <div class="shelf">
      <div class="shelf-bar">
        <span class="shelf-hint">
          共 {books.length} 本 · 最多 {MAX_BOOKS} 本 · 每页 12 本
        </span>
        <label class="file-picker">
          导入 TXT
          <input
            type="file"
            multiple
            accept=".txt,text/plain"
            onChange={(event) => {
              const input = event.target as HTMLInputElement;
              const files = Array.from(input.files ?? []);
              if (files.length) onImport(files);
              input.value = '';
            }}
          />
        </label>
      </div>

      {books.length === 0 ? (
        <div class="shelf-empty">书架还是空的，导入或拖入 .txt 文件开始阅读</div>
      ) : (
        <div class="shelf-grid">
          {items.map((book) => {
            const cover = coverOf(book.title);
            return (
              <div class="shelf-card" key={book.id} data-book-id={book.id}>
                <button
                  class="shelf-open"
                  onClick={() => onOpen(book.id)}
                  aria-label={`打开 ${book.fileName}`}
                >
                  <span class="book-cover" style={{ background: cover.gradient }}>
                    <span class="book-cover-initial">{cover.initial}</span>
                    <span class="book-cover-title">{book.title}</span>
                  </span>
                  <span class="book-file-name" title={book.fileName}>
                    {book.fileName}
                  </span>
                  <span class="book-progress">已读 {Math.round(book.percent ?? 0)}%</span>
                </button>
                <button
                  class="book-delete"
                  onClick={() => onDelete(book.id)}
                  aria-label={`删除 ${book.fileName}`}
                  title="从书架删除"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div class="shelf-pager">
        <button
          class="btn"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          上一页
        </button>
        <span class="pager-label" data-page={current}>
          第 {current} / {total} 页
        </span>
        <button
          class="btn"
          disabled={current >= total}
          onClick={() => onPageChange(current + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
