import { useEffect, useRef, useState } from 'preact/hooks';
import type { Book, Settings } from '../parse/types';
import type { ParagraphIndex } from '../model/offsetIndex';
import { locate, offsetOf, percentToOffset } from '../model/offsetIndex';
import { BLOCK_SIZE, createViewModel } from './viewModel';

type Props = {
  book: Book;
  settings: Settings;
  index: ParagraphIndex;
  initialOffset: number;
  jump: { percent: number; token: number } | null;
  onOffsetChange: (offset: number) => void;
};

/** F4/F5/F6：连续滚动 + 分块渲染 + 字符偏移定位。只读 Book 与索引，不认格式。 */
export function ReaderView({
  book,
  settings,
  index,
  initialOffset,
  jump,
  onOffsetChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visibleBlocks, setVisibleBlocks] = useState(1);
  const [pendingOffset, setPendingOffset] = useState<number | null>(initialOffset);
  const vm = createViewModel(book, settings, visibleBlocks);

  const scrollToOffset = (offset: number) => {
    const target = locate(index, offset);
    const block = Math.floor(target.paragraph / BLOCK_SIZE) + 1;
    if (block > visibleBlocks) setVisibleBlocks(block);
    setPendingOffset(offset);
  };

  // 换书：重置已挂载块并恢复上次位置。
  useEffect(() => {
    setVisibleBlocks(1);
    setPendingOffset(initialOffset);
  }, [book.id, initialOffset]);

  // 百分比跳转。
  useEffect(() => {
    if (jump) scrollToOffset(percentToOffset(index, jump.percent));
  }, [jump?.token]);

  // 目标段所在块挂载后再定位，避免节点不存在。
  useEffect(() => {
    if (pendingOffset === null) return;
    const container = containerRef.current;
    if (!container) return;
    const { paragraph } = locate(index, pendingOffset);
    const node = container.querySelector<HTMLElement>(`[data-paragraph="${paragraph}"]`);
    if (!node) return;
    node.scrollIntoView({ block: 'start' });
    setPendingOffset(null);
  }, [pendingOffset, visibleBlocks, settings.fontSize, settings.lineHeight]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const top = container.getBoundingClientRect().top;
    const nodes = container.querySelectorAll<HTMLElement>('[data-paragraph]');
    for (const node of Array.from(nodes)) {
      if (node.getBoundingClientRect().bottom > top + 40) {
        onOffsetChange(offsetOf(index, Number(node.dataset.paragraph), 0));
        break;
      }
    }

    if (
      visibleBlocks < vm.totalBlocks &&
      container.scrollTop + container.clientHeight >= container.scrollHeight - 400
    ) {
      setVisibleBlocks((count) => Math.min(vm.totalBlocks, count + 1));
    }
  };

  return (
    <div
      class="reader"
      data-theme={vm.theme}
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        fontSize: vm.cssVars['--reader-font-size'],
        lineHeight: vm.cssVars['--reader-line-height'],
      }}
    >
      <h2 class="reader-title">{vm.title}</h2>
      {vm.blocks.map((block, blockIndex) =>
        block.map((text, innerIndex) => {
          const paragraph = blockIndex * BLOCK_SIZE + innerIndex;
          return (
            <p class="reader-paragraph" data-paragraph={paragraph} key={paragraph}>
              {text}
            </p>
          );
        }),
      )}
      {visibleBlocks < vm.totalBlocks && (
        <p class="reader-more">向下滚动继续加载…</p>
      )}
    </div>
  );
}
