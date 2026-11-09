/** 字符偏移 ↔ (段落序号, 段内偏移) 纯函数。只存字符偏移，不存滚动像素。 */

export type ParagraphIndex = { starts: number[]; total: number };

export function buildIndex(paragraphs: string[]): ParagraphIndex {
  const starts: number[] = [];
  let offset = 0;
  for (const paragraph of paragraphs) {
    starts.push(offset);
    offset += paragraph.length + 1; // 段间以一个 \n 计
  }
  return { starts, total: paragraphs.length > 0 ? offset - 1 : 0 };
}

export function locate(
  index: ParagraphIndex,
  offset: number,
): { paragraph: number; inner: number } {
  if (index.starts.length === 0) return { paragraph: 0, inner: 0 };
  const clamped = Math.max(0, Math.min(offset, index.total));
  let lo = 0;
  let hi = index.starts.length - 1;
  let answer = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (index.starts[mid] <= clamped) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return { paragraph: answer, inner: clamped - index.starts[answer] };
}

export function offsetOf(index: ParagraphIndex, paragraph: number, inner: number): number {
  if (index.starts.length === 0) return 0;
  const p = Math.max(0, Math.min(paragraph, index.starts.length - 1));
  return index.starts[p] + Math.max(0, inner);
}

export function percentToOffset(index: ParagraphIndex, percent: number): number {
  return Math.floor((index.total * Math.max(0, Math.min(percent, 100))) / 100);
}

export function offsetToPercent(index: ParagraphIndex, offset: number): number {
  if (index.total === 0) return 0;
  return Math.max(0, Math.min(100, (offset / index.total) * 100));
}
