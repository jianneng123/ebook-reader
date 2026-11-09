/** 文字书封：按书名 hash 稳定生成渐变配色与首字，零 DOM 依赖。 */

export type Cover = { hue: number; gradient: string; initial: string };

function hashTitle(title: string): number {
  let hash = 0x811c9dc5;
  for (const char of Array.from(title)) {
    for (const unit of char.codePointAt(0)!.toString(16)) {
      hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193) >>> 0;
    }
  }
  return hash;
}

export function coverOf(title: string): Cover {
  const hue = hashTitle(title) % 360;
  const second = (hue + 42) % 360;
  const gradient = `linear-gradient(145deg, hsl(${hue}, 62%, 52%), hsl(${second}, 58%, 36%))`;
  const trimmed = title.trim();
  const initial = trimmed ? (Array.from(trimmed)[0] ?? '书') : '书';
  return { hue, gradient, initial };
}
