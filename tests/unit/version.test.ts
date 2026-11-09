import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, versionLabel } from '../../src/version';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8')) as {
  version: string;
};
const mainSource = readFileSync(resolve(root, 'src/main.tsx'), 'utf-8');

describe('应用版本号（唯一来源 package.json）', () => {
  it('与 package.json version 完全一致', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(versionLabel()).toBe(`v${pkg.version}`);
  });

  it('版本格式为语义化版本 x.y.z', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('界面常驻显示版本，且源码不写死版本字符串', () => {
    expect(mainSource).toContain('class="app-version"');
    expect(mainSource).toContain('versionLabel()');
    expect(mainSource).not.toMatch(/v\d+\.\d+\.\d+/);
  });

  it('浏览器标题带版本号，打开即可确认', () => {
    expect(mainSource).toContain('document.title');
    expect(mainSource).toContain('versionLabel()');
  });
});
