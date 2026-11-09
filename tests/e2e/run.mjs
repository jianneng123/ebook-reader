/**
 * v0.1 端到端验收（PRD §5.4 / TECH_DESIGN §8）
 *
 * 运行：npm run test:e2e
 * 通道 A：本地 http://127.0.0.1 服务 + Playwright（复用本机 Chromium / Chrome），
 *        用 setInputFiles 绕开原生文件选择框，覆盖 F1~F6 交互。
 * 通道 B：Chrome --headless=new --dump-dom 验证单文件 file:// 产物可离线渲染。
 *
 * 刻意不使用 Playwright CLI 的 file:// 通道（实测被拦），也不依赖桌面 computer use。
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const release = resolve(root, 'release/index.html');
const fixtures = resolve(root, 'tests/fixtures');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  FAIL  ${name}: ${error.message}`);
  }
}

async function launchBrowser() {
  const candidates = [
    'C:/Users/gj137/AppData/Local/ms-playwright/chromium-1243/chrome-win/chrome.exe',
    'C:/Users/gj137/AppData/Local/ms-playwright/chromium-1234/chrome-win/chrome.exe',
    CHROME,
  ];
  let lastError;
  for (const executablePath of candidates) {
    if (!existsSync(executablePath)) continue;
    try {
      return await chromium.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`没有可用的 Chromium/Chrome：${lastError?.message ?? '未找到可执行文件'}`);
}

async function freshPage(browser, url, fn) {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await page.waitForSelector('.app');
    await fn(page);
  } finally {
    await page.close();
  }
}

async function openTxt(page, name) {
  await page.setInputFiles('input[type="file"]', resolve(fixtures, name));
  await page.waitForSelector('.reader-paragraph');
}

function readerText() {
  return Array.from(document.querySelectorAll('.reader-paragraph'))
    .map((node) => node.textContent ?? '')
    .join('');
}

async function main() {
  // 始终验证最新产物。
  console.log('构建单文件产物…');
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf-8', shell: true });
  if (build.status !== 0) throw new Error(`npm run build 失败:\n${build.stdout}\n${build.stderr}`);
  const html = await readFile(release, 'utf-8');
  assert.ok(html.length > 10_000, '单文件产物应内联全部 JS/CSS');
  const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'));
  const expectedVersionLabel = `v${version}`;

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await launchBrowser();

  try {
    console.log('\n[通道 A] 本地 http + Playwright 交互验收');

    await check('打开阅读器即可看到版本号（工具栏徽章 + 标签页标题）', async () => {
      await freshPage(browser, url, async (page) => {
        const badge = await page.textContent('.app-version');
        assert.equal(badge?.trim(), expectedVersionLabel, '版本徽章应与 package.json 一致');
        assert.ok(await page.isVisible('.app-version'), '版本徽章应可见');
        assert.ok(await page.isVisible('.empty'), '未打开文件时也能看到版本号');
        assert.ok((await page.title()).includes(expectedVersionLabel), '标签页标题应带版本号');
      });
    });

    await check('§5.4-1 三本真实中文 TXT 无乱码、段落可读', async () => {
      const cases = [
        ['utf8-novel.txt', '青石镇'],
        ['utf8-bom.txt', '旧书店'],
        ['gbk-novel.txt', '旧书店'],
      ];
      for (const [name, keyword] of cases) {
        await freshPage(browser, url, async (page) => {
          await openTxt(page, name);
          const info = await page.evaluate(() => ({
            text: Array.from(document.querySelectorAll('.reader-paragraph'))
              .map((node) => node.textContent ?? '')
              .join(''),
            count: document.querySelectorAll('.reader-paragraph').length,
          }));
          assert.ok(info.text.includes(keyword), `${name} 应包含「${keyword}」`);
          assert.ok(!info.text.includes('\uFFFD'), `${name} 不应有替换字符`);
          assert.ok(!info.text.includes('锟斤拷'), `${name} 不应有典型乱码`);
          assert.ok(info.count > 1, `${name} 段落数应大于 1`);
        });
      }
    });

    await check('F3 硬换行被合并，不出现一行一段', async () => {
      await freshPage(browser, url, async (page) => {
        await openTxt(page, 'utf8-bom.txt');
        const count = await page.$$eval('.reader-paragraph', (nodes) => nodes.length);
        assert.ok(count >= 2 && count <= 8, `段落数异常: ${count}`);
        const indent = await page.$$eval('.reader-paragraph', (nodes) =>
          nodes.some((node) => node.textContent?.startsWith('\u3000')),
        );
        assert.ok(indent, '段首全角空格缩进应保留');
      });
    });

    await check('F2 手动切换编码生效且可切回', async () => {
      await freshPage(browser, url, async (page) => {
        await openTxt(page, 'gbk-novel.txt');
        await page.selectOption('.encoding-select', 'utf-8');
        const broken = await page.evaluate(readerText);
        assert.ok(broken.includes('\uFFFD'), '强制 UTF-8 解码 GBK 应出现替换字符');
        await page.selectOption('.encoding-select', 'gbk');
        const fixed = await page.evaluate(readerText);
        assert.ok(fixed.includes('旧书店') && !fixed.includes('\uFFFD'), '切回 GBK 应无乱码');
        const notice = await page.textContent('.notice');
        assert.match(notice ?? '', /进度已重置/);
      });
    });

    await check('§5.4-3 字号 / 行距 / 主题即时生效且重启保留', async () => {
      await freshPage(browser, url, async (page) => {
        await openTxt(page, 'utf8-novel.txt');
        await page.getByRole('button', { name: '大', exact: true }).click();
        assert.equal(await page.$eval('.reader', (el) => getComputedStyle(el).fontSize), '23px');
        await page.getByRole('button', { name: '宽松行距' }).click();
        assert.equal(await page.$eval('.reader', (el) => el.style.lineHeight), '2.1');
        await page.getByRole('button', { name: '夜间' }).click();
        assert.equal(await page.getAttribute('.reader', 'data-theme'), 'dark');

        await page.reload();
        await page.waitForSelector('.app');
        await openTxt(page, 'utf8-novel.txt');
        assert.equal(await page.$eval('.reader', (el) => getComputedStyle(el).fontSize), '23px');
        assert.equal(await page.getAttribute('.reader', 'data-theme'), 'dark');
      });
    });

    await check('§5.4-2 刷新 / 重开同一文件后位置恢复', async () => {
      await freshPage(browser, url, async (page) => {
        await openTxt(page, 'utf8-novel.txt');
        await page.$eval('.reader', (el) => {
          el.scrollTop = Math.floor(el.scrollHeight / 2);
        });
        await page.waitForTimeout(700); // 进度节流 400ms
        const saved = await page.evaluate(() =>
          localStorage.getItem('reader:progress:v1'),
        );
        assert.ok(saved && saved.includes('"type":"offset"'), '进度应写入 localStorage');

        await page.reload();
        await page.waitForSelector('.app');
        await openTxt(page, 'utf8-novel.txt');
        await page.waitForTimeout(400);
        const scrollTop = await page.$eval('.reader', (el) => el.scrollTop);
        assert.ok(scrollTop > 0, `恢复后应回到上次位置，实际 scrollTop=${scrollTop}`);
      });
    });

    await check('F6 跳到 50% 位置正确', async () => {
      await freshPage(browser, url, async (page) => {
        await openTxt(page, 'utf8-novel.txt');
        // 等恢复定位引发的滚动事件安静下来，避免它回写 value 覆盖滑块草稿值。
        await page.waitForTimeout(200);
        await page.$eval('.progress-range', (el) => {
          el.value = '50';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForFunction(
          () => document.querySelector('.progress-bar .btn')?.textContent?.includes('50%'),
          null,
          { timeout: 3000 },
        );
        await page.locator('.progress-bar .btn').click();
        await page.waitForTimeout(300);
        const scrollTop = await page.$eval('.reader', (el) => el.scrollTop);
        assert.ok(scrollTop > 0, '50% 跳转应滚动到中段');
        const label = await page.textContent('.progress-value');
        assert.match(label ?? '', /当前 \d+%/);
      });
    });

    console.log('\n[通道 B] Chrome headless 验证 file:// 单文件离线产物');
    await check('单文件 file:// 直开能渲染且无外链资源', async () => {
      const fileUrl = pathToFileURL(release).href;
      const dumped = execFileSync(
        CHROME,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--dump-dom',
          fileUrl,
        ],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      assert.ok(dumped.includes('选择或拖入一个 .txt 文件开始阅读'), 'JS 未执行或页面为空');
      assert.match(dumped, /class="app-version"/, '离线产物应含版本徽章节点');
      assert.ok(
        dumped.includes(expectedVersionLabel),
        `离线产物应显示 ${expectedVersionLabel}`,
      );
      assert.ok(!/<script[^>]+src=/.test(dumped), '产物不应有外链 script');
      assert.ok(!/<link[^>]+stylesheet/.test(dumped), '产物不应有外链样式');
    });
  } finally {
    await browser.close();
    await new Promise((done) => server.close(done));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nE2E 汇总：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length > 0) {
    for (const item of failed) console.error(`  ${item.name}: ${item.error.stack}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
