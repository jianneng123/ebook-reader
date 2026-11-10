# 电子书阅读器

一个纯前端、离线可用的本地 TXT 阅读器。没有后端、没有账号、没有网络请求：选中或拖入 `.txt` 文件，书就留在浏览器里，进度、字号、主题都会被记住。

**当前仅支持 TXT**（UTF-8 / UTF-8 BOM / GBK）。EPUB、目录树、笔记高亮、全文搜索均尚未实现。

## 快速开始

### 方式一：下载单文件，双击即用（推荐）

下载 [`release/index.html`](release/index.html)，用 Chrome / Edge / Firefox 直接打开即可。全部 JS 与 CSS 已内联，约 36 KB，无需安装、无需联网、无需起服务。

> ⚠️ 以 `file://` 打开时，部分浏览器会禁用 IndexedDB。此时书架会自动降级为「仅本次会话有效」并在界面给出提示，阅读功能不受影响。若希望书籍永久保留，改用方式二。

### 方式二：本地 http 服务（书架永久保留）

在 `release/` 目录起一个静态服务：

```bash
cd release
python -m http.server 8000
```

浏览器访问 `http://127.0.0.1:8000`。常规 http 来源下 IndexedDB 正常可用，重开浏览器书籍仍在。

## 功能

| 项 | 说明 |
|---|---|
| 导入 | 文件选择或拖入，支持一次多本 `.txt`；按内容指纹去重，互不覆盖 |
| 编码 | 自动识别 UTF-8 / UTF-8 BOM / GBK，猜错可手动切换（切换会重置该书进度，避免偏移漂移） |
| 排版 | 合并硬换行、按空行分段、保留段首缩进、限制单段长度 |
| 书架 | 最多 50 本，分页网格（每页 12 本），自动生成文字书封，支持删除与二次确认 |
| 阅读 | 连续滚动 + 分块渲染（长篇不卡首屏），字号 3 档、行距 2 档、白天 / 夜间主题 |
| 进度 | 按字符偏移自动保存，每本书独立记忆，重开自动回到上次位置 |
| 跳转 | 按百分比线性跳转（暂不提供目录树） |
| 存储 | 书籍全文存 IndexedDB，进度与设置存 localStorage；**所有数据只在本机，不上传** |

健壮性：IndexedDB 或 localStorage 不可用时自动降级为内存存储，页面不会白屏，只是数据仅本次会话有效。

## 从源码构建

需要 Node.js 20+（本项目在 Node 22 开发）；Python 3 仅用于文档与仓库约定校验。

```bash
npm install
npm run dev        # 本地开发，Vite 启动
npm run build      # TypeScript 类型检查 + 生成 release/index.html 单文件产物
npm test           # Vitest 应用层单测
npm run test:e2e   # Playwright + Chrome headless 端到端验收
python -m unittest discover -s tests -v   # 文档结构与仓库约定校验
```

`npm run test:e2e` 需要本机安装 Chrome 或 Playwright 自带 Chromium。脚本会跨平台自动探测常见安装位置（含 Playwright 缓存目录），不写死任何机器路径；若浏览器装在非标准位置，用环境变量指定：

```bash
E2E_CHROME_PATH=/path/to/chrome npm run test:e2e
```

未安装浏览器时可执行 `npx playwright install chromium`。

## 目录结构

| 路径 | 内容 |
|---|---|
| `release/index.html` | 构建产物，单文件离线可用，直接分发给使用者 |
| `index.html` | 开发入口页 |
| `src/main.tsx` | 应用编排：书架 / 阅读双视图、导入、进度、设置 |
| `src/parse/`、`src/io/` | 解析层：统一 `Book` 模型、编码检测、段落规范化、文件读取 |
| `src/model/` | 字符偏移 ↔ 段落 ↔ 百分比的纯函数索引 |
| `src/store/` | 进度、阅读设置、IndexedDB 书架、内容指纹、书架纯逻辑 |
| `src/ui/` | 阅读视图、书架视图、文字书封、视图模型、进度跳转 |
| `src/styles.css` | 布局与白天 / 夜间主题 |
| `docs/` | 产品需求、技术方案、验收记录 |
| `tests/` | Vitest 单测、Python 约定校验、E2E 脚本、中文 TXT 样本 |

## 设计约束

- **格式隔离**：解析层输出统一 `Book` 模型，阅读层只认 `Book`。将来加 EPUB 只需在 `src/parse/index.ts` 注册新解析器，UI 零改动。
- **依赖极简**：运行时依赖只有 `preact`；编码识别、文件读取、持久化全部使用浏览器原生 API。
- **版本号唯一来源**：`package.json` 的 `version` 字段。界面顶部徽章与标签页标题由 `src/version.ts` 读取，不在别处写死。
- **已知限制**：详见 [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) 的「已知限制」一节。

## 文档

- [`docs/PRD.md`](docs/PRD.md) — v0.1 产品需求（历史基线）
- [`docs/TECH_DESIGN.md`](docs/TECH_DESIGN.md) — v0.1 技术方案与架构决策记录
- [`docs/PRD-v0.2.md`](docs/PRD-v0.2.md) — v0.2 多书书架需求
- [`docs/TECH_DESIGN-v0.2.md`](docs/TECH_DESIGN-v0.2.md) — v0.2 增量方案
- [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) — 验收记录与交付物清单

## 贡献

仓库约定见 [`AGENTS.MD`](AGENTS.MD)：每次改动对应一个 Git commit；每次改动编写或更新相关测试，交付前确保所有测试与验证通过。

## 许可证

[MIT](LICENSE) © 2026 阿西巴
