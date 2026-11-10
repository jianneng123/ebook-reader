/**
 * v0.2 端到端验收（PRD-v0.2 §7 / TECH_DESIGN-v0.2 §6）
 *
 * 运行：npm run test:e2e
 * 浏览器路径由 resolveChrome() 跨平台解析；非标准安装可设 E2E_CHROME_PATH。
 * 通道 A：本地 http://127.0.0.1 服务 + Playwright（复用 Chromium / Chrome），
 *        setInputFiles 绕开原生文件选择框，IndexedDB 在此通道可用，验证多书书架。
 * 通道 B：Chrome --headless=new --dump-dom 验证单文件 file:// 产物可离线渲染。
 *
 * 刻意不使用 Playwright CLI 的 file:// 通道（实测被拦），也不依赖桌面 computer use。
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const release = resolve(root, 'release/index.html');
const fixtures = resolve(root, 'tests/fixtures');
const CHROME_ENV = 'E2E_CHROME_PATH';

/** Playwright 缓存里已安装的 chromium 版本目录，动态枚举，不写死版本号与用户名。 */
function playwrightCacheCandidates() {
  const bases = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) bases.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  if (platform() === 'win32') {
    if (process.env.LOCALAPPDATA) bases.push(join(process.env.LOCALAPPDATA, 'ms-playwright'));
  } else if (platform() === 'darwin') {
    bases.push(join(homedir(), 'Library/Caches/ms-playwright'));
  } else {
    bases.push(join(homedir(), '.cache/ms-playwright'));
  }

  const relative =
    platform() === 'win32'
      ? join('chrome-win', 'chrome.exe')
      : platform() === 'darwin'
        ? join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
        : join('chrome-linux', 'chrome');

  const found = [];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    try {
      for (const entry of readdirSync(base)) {
        if (!entry.startsWith('chromium-')) continue;
        const candidate = join(base, entry, relative);
        if (existsSync(candidate)) found.push(candidate);
      }
    } catch {
      // 缓存目录不可读时跳过，继续尝试其他来源。
    }
  }
  return found;
}

/** 各平台 Chrome / Chromium 常见安装位置，只依赖环境变量与系统约定路径。 */
function systemCandidates() {
  const os = platform();
  if (os === 'win32') {
    const paths = [];
    for (const variable of ['ProgramFiles', 'ProgramFiles(x86)']) {
      const base = process.env[variable];
      if (base) paths.push(join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    if (process.env.LOCALAPPDATA) {
      paths.push(join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    return paths;
  }
  if (os === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

let cachedChrome = null;

/**
 * 解析浏览器可执行文件：环境变量 > Playwright 自带 > 缓存目录 > 系统安装位置。
 * 不写死任何本机用户名或盘符，便于他人 clone 后直接跑 E2E。
 */
function resolveChrome() {
  if (cachedChrome) return cachedChrome;
  const fromEnv = process.env[CHROME_ENV];
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`${CHROME_ENV} 指向的文件不存在：${fromEnv}`);
    }
    cachedChrome = fromEnv;
    return cachedChrome;
  }

  try {
    const fromPlaywright = chromium.executablePath();
    if (fromPlaywright && existsSync(fromPlaywright)) {
      cachedChrome = fromPlaywright;
      return cachedChrome;
    }
  } catch {
    // playwright-core 未安装浏览器时继续探测。
  }

  for (const candidate of [...playwrightCacheCandidates(), ...systemCandidates()]) {
    if (existsSync(candidate)) {
      cachedChrome = candidate;
      return cachedChrome;
    }
  }

  throw new Error(
    `找不到 Chrome/Chromium。请安装浏览器，或设置 ${CHROME_ENV}=<可执行文件路径>，` +
      '也可执行 npx playwright install chromium。',
  );
}

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
  const executablePath = resolveChrome();
  try {
    return await chromium.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });
  } catch (error) {
    // 显式路径启动失败时，最后交给 Playwright 自己解析，避免单点失败。
    try {
      return await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      });
    } catch {
      throw new Error(`无法启动 Chromium/Chrome（${executablePath}）：${error.message}`);
    }
  }
}

async function freshPage(browser, url, fn) {
  const page = await browser.newPage(); // 每次独立 context，IndexedDB 天然隔离
  try {
    await page.goto(url);
    await page.waitForSelector('.app');
    page.on('dialog', (dialog) => dialog.accept());
    await fn(page);
  } finally {
    await page.close();
  }
}

async function waitNotice(page, keyword) {
  await page.waitForFunction(
    (k) => (document.querySelector('.notice')?.textContent ?? '').includes(k),
    keyword,
    { timeout: 15_000 },
  );
}

async function importFiles(page, files, expectedTotal, noticeKeyword = '成功导入') {
  await page.setInputFiles('input[type="file"]', files);
  await page.waitForFunction(
    (total) => Number(document.querySelector('.shelf-count')?.dataset.count ?? -1) === total,
    expectedTotal,
    { timeout: 15_000 },
  );
  await waitNotice(page, noticeKeyword);
}

const txtBufferFile = (name, text) => ({
  name,
  mimeType: 'text/plain',
  buffer: Buffer.from(text, 'utf-8'),
});

async function openBook(page, fileName) {
  let card = page.locator('.shelf-card').filter({ hasText: fileName });
  // 导入后默认停在最后一页，需要时向前翻页找目标书。
  for (let i = 0; i < 6 && (await card.count()) === 0; i += 1) {
    const previous = page.getByRole('button', { name: '上一页' });
    if (await previous.isDisabled()) break;
    await previous.click();
    card = page.locator('.shelf-card').filter({ hasText: fileName });
  }
  assert.ok((await card.count()) > 0, `书架上找不到 ${fileName}`);
  await card.first().locator('.shelf-open').click();
  await page.waitForSelector('.reader-paragraph');
}

async function openTxt(page, name) {
  await importFiles(page, [resolve(fixtures, name)], 1);
  await openBook(page, name);
}

async function backToShelf(page) {
  await page.getByRole('button', { name: '← 返回书架' }).click();
  await page.waitForSelector('.shelf');
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
    console.log('\n[通道 A] 本地 http + Playwright 多书书架验收');

    await check('打开阅读器即可看到版本号（工具栏徽章 + 标签页标题）', async () => {
      await freshPage(browser, url, async (page) => {
        const badge = await page.textContent('.app-version');
        assert.equal(badge?.trim(), expectedVersionLabel, '版本徽章应与 package.json 一致');
        assert.ok(await page.isVisible('.app-version'), '版本徽章应可见');
        assert.ok(await page.isVisible('.shelf'), '默认进入书架主界面');
        assert.ok((await page.title()).includes(expectedVersionLabel), '标签页标题应带版本号');
      });
    });

    await check('R1/R3/R8 导入 3 本互不覆盖，图标下方显示文件名', async () => {
      await freshPage(browser, url, async (page) => {
        await importFiles(
          page,
          ['utf8-novel.txt', 'utf8-bom.txt', 'gbk-novel.txt'].map((name) =>
            resolve(fixtures, name),
          ),
          3,
        );
        assert.equal(await page.$$eval('.shelf-card', (nodes) => nodes.length), 3);
        assert.equal(await page.$$eval('.book-cover', (nodes) => nodes.length), 3);
        const names = await page.$$eval('.book-file-name', (nodes) =>
          nodes.map((node) => node.textContent),
        );
        assert.deepEqual(
          [...names].sort(),
          ['utf8-novel.txt', 'utf8-bom.txt', 'gbk-novel.txt'].sort(),
        );
        assert.match(await page.textContent('.shelf-hint'), /共 3 本 · 最多 50 本/);
      });
    });

    await check('R3 同一内容重复导入被去重，书架数量不变', async () => {
      await freshPage(browser, url, async (page) => {
        await importFiles(page, [resolve(fixtures, 'utf8-novel.txt')], 1);
        await importFiles(page, [resolve(fixtures, 'utf8-novel.txt')], 1, '重复跳过');
        assert.equal(await page.$eval('.shelf-count', (el) => el.dataset.count), '1');
      });
    });

    await check('R2/R7 刷新后书架仍在，无需重新导入即可直接阅读', async () => {
      await freshPage(browser, url, async (page) => {
        await importFiles(
          page,
          [resolve(fixtures, 'utf8-novel.txt'), resolve(fixtures, 'gbk-novel.txt')],
          2,
        );
        await page.reload();
        await page.waitForSelector('.shelf-count');
        await page.waitForFunction(
          () => document.querySelector('.shelf-count')?.dataset.count === '2',
        );
        await openBook(page, 'gbk-novel.txt');
        assert.ok((await page.evaluate(readerText)).includes('旧书店'), 'GBK 书应可直接打开');
      });
    });

    await check('R4/R5 三本书来回切换，内容与进度各归各', async () => {
      await freshPage(browser, url, async (page) => {
        await importFiles(
          page,
          ['utf8-novel.txt', 'utf8-bom.txt', 'gbk-novel.txt'].map((name) =>
            resolve(fixtures, name),
          ),
          3,
        );
        await openBook(page, 'utf8-novel.txt');
        assert.ok((await page.evaluate(readerText)).includes('青石镇'));
        await page.$eval('.reader', (el) => {
          el.scrollTop = Math.floor(el.scrollHeight / 2);
        });
        await page.waitForTimeout(700); // 进度节流 400ms
        await backToShelf(page);

        await openBook(page, 'gbk-novel.txt');
        assert.ok((await page.evaluate(readerText)).includes('旧书店'));
        const freshScroll = await page.$eval('.reader', (el) => el.scrollTop);
        assert.equal(freshScroll, 0, '新书应从 0 开始，不继承上一本的进度');
        await backToShelf(page);

        await openBook(page, 'utf8-novel.txt');
        await page.waitForTimeout(400);
        const restored = await page.$eval('.reader', (el) => el.scrollTop);
        assert.ok(restored > 0, `切回第一本应恢复进度，实际 ${restored}`);
      });
    });

    await check('R9 第 13 本触发第 2 页，上一页 / 下一页可用', async () => {
      await freshPage(browser, url, async (page) => {
        const files = Array.from({ length: 13 }, (_, i) =>
          txtBufferFile(`书${String(i + 1).padStart(2, '0')}.txt`, `第${i + 1}本书的正文。\n\n第二段。`),
        );
        await importFiles(page, files, 13);
        assert.equal(await page.$eval('.pager-label', (el) => el.dataset.page), '2');
        assert.match(await page.textContent('.pager-label'), /第 2 \/ 2 页/);
        assert.equal(await page.$$eval('.shelf-card', (nodes) => nodes.length), 1);
        await page.getByRole('button', { name: '上一页' }).click();
        assert.equal(await page.$$eval('.shelf-card', (nodes) => nodes.length), 12);
        await page.getByRole('button', { name: '下一页' }).click();
        assert.equal(await page.$$eval('.shelf-card', (nodes) => nodes.length), 1);
      });
    });

    await check('R10/R11 满 50 本拒绝导入；删除一本后可再导入', async () => {
      await freshPage(browser, url, async (page) => {
        const files = Array.from({ length: 50 }, (_, i) =>
          txtBufferFile(`批量${String(i + 1).padStart(2, '0')}.txt`, `第${i + 1}本内容。\n\n第二段。`),
        );
        await importFiles(page, files, 50);
        const extra = txtBufferFile('第51本.txt', '第 51 本的内容。');
        await page.setInputFiles('input[type="file"]', [extra]);
        await waitNotice(page, '书架已满');
        assert.equal(await page.$eval('.shelf-count', (el) => el.dataset.count), '50');

        await page.locator('.shelf-card .book-delete').first().click();
        await page.waitForFunction(
          () => document.querySelector('.shelf-count')?.dataset.count === '49',
        );
        await importFiles(page, [extra], 50);
        assert.equal(await page.$eval('.shelf-count', (el) => el.dataset.count), '50');
      });
    });

    await check('§5.4-1 三本真实中文 TXT 无乱码、段落可读', async () => {
      for (const [name, keyword] of [
        ['utf8-novel.txt', '青石镇'],
        ['utf8-bom.txt', '旧书店'],
        ['gbk-novel.txt', '旧书店'],
      ]) {
        await freshPage(browser, url, async (page) => {
          await openTxt(page, name);
          const text = await page.evaluate(readerText);
          assert.ok(text.includes(keyword), `${name} 应包含「${keyword}」`);
          assert.ok(!text.includes('\uFFFD'), `${name} 不应有替换字符`);
          assert.ok(!text.includes('锟斤拷'), `${name} 不应有典型乱码`);
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

    await check('F2/R6 手动切换编码生效、按书保存且可切回', async () => {
      await freshPage(browser, url, async (page) => {
        await openTxt(page, 'gbk-novel.txt');
        await page.selectOption('.encoding-select', 'utf-8');
        const broken = await page.evaluate(readerText);
        assert.ok(broken.includes('\uFFFD'), '强制 UTF-8 解码 GBK 应出现替换字符');
        await page.selectOption('.encoding-select', 'gbk');
        const fixed = await page.evaluate(readerText);
        assert.ok(fixed.includes('旧书店') && !fixed.includes('\uFFFD'), '切回 GBK 应无乱码');
        await waitNotice(page, '进度已重置');
        await backToShelf(page);
        await openBook(page, 'gbk-novel.txt');
        assert.equal(
          await page.inputValue('.encoding-select'),
          'gbk',
          '重新打开该书应记住编码选择',
        );
      });
    });

    await check('§5.4-3 字号 / 行距 / 主题即时生效、重启保留且书架贯通', async () => {
      await freshPage(browser, url, async (page) => {
        await openTxt(page, 'utf8-novel.txt');
        await page.getByRole('button', { name: '大', exact: true }).click();
        assert.equal(await page.$eval('.reader', (el) => getComputedStyle(el).fontSize), '23px');
        await page.getByRole('button', { name: '宽松行距' }).click();
        assert.equal(await page.$eval('.reader', (el) => el.style.lineHeight), '2.1');
        await page.getByRole('button', { name: '夜间' }).click();
        assert.equal(await page.getAttribute('.app', 'data-theme'), 'dark');
        assert.equal(await page.getAttribute('.reader', 'data-theme'), 'dark');

        await page.reload();
        await page.waitForSelector('.app');
        assert.equal(await page.getAttribute('.app', 'data-theme'), 'dark', '书架也应保留夜间主题');
        await openBook(page, 'utf8-novel.txt');
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
        await page.waitForTimeout(700);
        const saved = await page.evaluate(() => localStorage.getItem('reader:progress:v1'));
        assert.ok(saved && saved.includes('"type":"offset"'), '进度应写入 localStorage');

        await page.reload();
        await page.waitForSelector('.app');
        await openBook(page, 'utf8-novel.txt');
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
        resolveChrome(),
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
      assert.ok(dumped.includes('我的书架'), 'JS 未执行或书架为空');
      assert.ok(dumped.includes('导入 TXT'), '书架应有导入入口');
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
