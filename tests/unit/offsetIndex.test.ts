import { describe, expect, it } from 'vitest';
import {
  buildIndex,
  locate,
  offsetOf,
  offsetToPercent,
  percentToOffset,
} from '../../src/model/offsetIndex';

const paragraphs = ['第一段文字', '第二段比较长一点', '第三段'];
const index = buildIndex(paragraphs);
const total = paragraphs.join('\n').length;

describe('offsetIndex 纯函数（F5/F6）', () => {
  it('buildIndex 段落起点与总量正确', () => {
    expect(index.starts[0]).toBe(0);
    expect(index.starts[1]).toBe(paragraphs[0].length + 1);
    expect(index.total).toBe(total);
  });

  it('offset ↔ (段落, 段内偏移) 往返一致', () => {
    const offsets = [0, 1, 4, 5, 6, 10, 14, total, -10, total + 999];
    for (const offset of offsets) {
      const { paragraph, inner } = locate(index, offset);
      const restored = offsetOf(index, paragraph, inner);
      expect(restored).toBe(Math.max(0, Math.min(offset, total)));
    }
  });

  it('locate 落在正确的段落', () => {
    expect(locate(index, 0).paragraph).toBe(0);
    expect(locate(index, paragraphs[0].length + 1).paragraph).toBe(1);
    expect(locate(index, total).paragraph).toBe(2);
    expect(locate(index, total + 500).paragraph).toBe(2);
  });

  it('50% 跳到全文中间（TECH_DESIGN §5 F6）', () => {
    expect(percentToOffset(index, 50)).toBe(Math.floor(total * 0.5));
    expect(percentToOffset(index, 0)).toBe(0);
    expect(percentToOffset(index, 100)).toBe(total);
    expect(percentToOffset(index, 150)).toBe(total);
    expect(percentToOffset(index, -20)).toBe(0);
  });

  it('offset → percent 换算', () => {
    expect(offsetToPercent(index, 0)).toBe(0);
    expect(offsetToPercent(index, total)).toBe(100);
    expect(offsetToPercent(index, total / 2)).toBeCloseTo(50, 5);
  });

  it('空书籍不崩溃', () => {
    const empty = buildIndex([]);
    expect(empty.total).toBe(0);
    expect(locate(empty, 10)).toEqual({ paragraph: 0, inner: 0 });
    expect(percentToOffset(empty, 50)).toBe(0);
    expect(offsetToPercent(empty, 10)).toBe(0);
  });
});
