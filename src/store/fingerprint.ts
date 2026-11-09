/**
 * 内容指纹：FNV-1a 双路全字节 hash + 字节数。
 * 纯 JS 实现，不依赖 crypto.subtle（file:// 等非安全上下文也能用）。
 * 取代 v0.1 的 name:size，避免同名同大小的两本书共用一个进度。
 */
export function fingerprint(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  let h2 = (0x01000193 ^ 0x9e3779b9) >>> 0;

  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    h1 = Math.imul(h1 ^ byte, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ byte, 0x85ebca6b) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }

  const part1 = h1.toString(16).padStart(8, '0');
  const part2 = h2.toString(16).padStart(8, '0');
  return `fp-${part1}${part2}-${bytes.byteLength}`;
}
