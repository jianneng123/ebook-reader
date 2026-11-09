import { describe, expect, it } from 'vitest';
import { coverOf } from '../../src/ui/cover';

describe('文字书封（PRD-v0.2 R8）', () => {
  it('同一书名配色稳定', () => {
    expect(coverOf('青石镇')).toEqual(coverOf('青石镇'));
  });

  it('不同书名生成不同色相', () => {
    const hues = Array.from({ length: 12 }, (_, i) => coverOf(`第${i}本书`).hue);
    expect(new Set(hues).size).toBeGreaterThan(1);
  });

  it('首字取中文字符，空标题回退为「书」', () => {
    expect(coverOf('青石镇').initial).toBe('青');
    expect(coverOf('  ').initial).toBe('书');
  });

  it('渐变是可用 CSS 且色相在 0~359', () => {
    const cover = coverOf('旧书店');
    expect(cover.hue).toBeGreaterThanOrEqual(0);
    expect(cover.hue).toBeLessThan(360);
    expect(cover.gradient).toMatch(/^linear-gradient\(145deg, hsl\(/);
  });
});
