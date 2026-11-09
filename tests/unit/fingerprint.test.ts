import { describe, expect, it } from 'vitest';
import { fingerprint } from '../../src/store/fingerprint';

const bytes = (text: string) => new TextEncoder().encode(text).buffer;

describe('内容指纹（ADR-008）', () => {
  it('相同内容得到相同 ID', () => {
    expect(fingerprint(bytes('第一章 青石镇'))).toBe(fingerprint(bytes('第一章 青石镇')));
  });

  it('不同内容得到不同 ID', () => {
    expect(fingerprint(bytes('甲'))).not.toBe(fingerprint(bytes('乙')));
  });

  it('同名同大小但内容不同不会被判为同一本', () => {
    const a = fingerprint(bytes('AAAA'));
    const b = fingerprint(bytes('BBBB'));
    expect(a).not.toBe(b);
  });

  it('ID 含字节数且格式稳定，空内容也可用', () => {
    expect(fingerprint(bytes(''))).toMatch(/^fp-[0-9a-f]{16}-0$/);
    expect(fingerprint(bytes('中文内容'))).toMatch(/^fp-[0-9a-f]{16}-\d+$/);
  });

  it('长文本全字节参与计算，尾部改动可识别', () => {
    const base = '青石镇的雨下了三天。'.repeat(5000);
    const first = fingerprint(bytes(base));
    const changed = fingerprint(bytes(`${base}!`));
    expect(first).not.toBe(changed);
  });
});
