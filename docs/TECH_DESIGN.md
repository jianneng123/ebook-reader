# 电子书阅读器 · 技术方案 v0.1

> 状态：已评审 · 实现中｜对应 `docs/PRD.md` v0.1｜更新：2026-11-09｜范围：TXT MVP
> 本文只回答「怎么实现」。需求、范围与验收以 PRD 为准；两者冲突时以 PRD 为准。

## 1. 结论与决策记录

**结论：纯 Web 静态应用（Vite + TypeScript + Preact），v0.1 不上 Electron。**

| # | 决策项 | 结论 | 核心理由 | 推翻条件 |
|---|---|---|---|---|
| ADR-001 | 运行形态 | 纯 Web 静态页，不上桌面壳 | v0.1 七项功能无一项需要 Node / 原生窗口 / 常驻文件访问 | 需要文件关联、批量扫目录、分发给非技术用户 |
| ADR-002 | 语言 | TypeScript | PRD §6 已用 TS 定义 `Book / Locator / Progress`；类型即契约，可直接守住解析层边界 | — |
| ADR-003 | UI | Preact | 分块渲染与设置即时生效有状态同步，比原生 DOM 少写样板；比 React 全家桶轻 | 若后续需要复杂组件生态，可换 React，阅读层边界不变 |
| ADR-004 | 构建 / 交付 | Vite + 单文件 HTML 产物 | 静态产物可离线双击打开，无安装、无后端、无网络 | — |
| ADR-005 | 测试 | Python unittest（仓库约定）+ Vitest（应用层）双栈 | 现有测试校验文档与仓库约定；应用单测必须与应用同语言 | — |
| ADR-006 | 运行时依赖预算 | 仅 `preact` 1 个 | 编码、进度、文件读取全部走浏览器原生 API | EPUB 解析器选型（v0.2 再评估） |

### ADR-001 展开：为什么不上 Electron

Electron 不是「做不到」，是**对 v0.1 零收益、纯成本**：

1. PRD 已把壳排除：运行环境写死「桌面浏览器、本地文件、离线可用」，文件不落库、进度存 localStorage、无后端、无同步、无插件、无常驻文件系统访问。
2. 七项功能逐条都能由 Web 原生能力承担，没有任何一项需要主进程：

   | 功能 | 承担者 |
   |---|---|
   | F1 打开 TXT | `<input type="file">` / drag-drop → `File.arrayBuffer()` |
   | F2 编码检测 | `TextDecoder('utf-8', {fatal:true})` → `TextDecoder('gbk')` |
   | F3 段落规范化 | 纯字符串函数 |
   | F4 阅读视图 | DOM + CSS 变量 |
   | F5 进度记忆 | `localStorage` |
   | F6 线性跳转 | 字符偏移索引 + `scrollIntoView` |
   | F7 解析层解耦 | TS 接口 + 纯函数模块 |

3. **能力等价已核实✅**：`gbk` 是 WHATWG Encoding Standard 内置标签，`TextDecoder('gbk')` 在 Chrome 38+ / Firefox 19+ / Safari 10.1+ 全支持（MDN）；本机 Node v22.22.2 实测同样能解出「中文」。两边解码能力相同，Electron 在 F2 上并不占优，不需要为此引入 Node 侧依赖。
4. 反侧成本：约百 MB 包体、打包签名链路、主进程/渲染进程边界、`contextIsolation` 等安全配置，以及每次改动多一道打包验证——与仓库「一次改动一个 commit + 测试全绿」的节奏冲突。
5. 唯一像理由的 v0.2「最近阅读 + IndexedDB 缓存文件」也不需要壳。

**复议触发条件**：目标从「作者自用验证闭环」变为「双击 .txt 关联打开 / 自动加载上一本书 / 书架扫目录 / 分发给别人装」时，再引入桌面壳，且**优先 Tauri 而非 Electron**（包体与内存更低）。若团队只熟 Electron 且不在意包体，它不算错，只是 v0.1 拿不到收益。

## 2. 约束推导

| PRD 约束 | 技术含义 | 落地要求 |
|---|---|---|
| 本地、无后端、离线 | 纯静态资源，零网络请求 | 构建产物自包含；不引入任何 CDN 依赖 |
| 文件不落库 | 文本只在内存持有 | 刷新/重开需重新选文件，属有意取舍 |
| 进度存 localStorage | 需要 schema 版本与损坏兜底 | 读取失败回默认值，禁止白屏 |
| 格式隔离 | 阅读层不得出现 `txt` / `epub` 分支 | `Parser` 接口是 v0.2 唯一切换点 |
| 可回滚 | 验证必须可重复、成本低 | 两栈测试全绿 + 每次改动一个 commit |

## 3. 总体架构

```mermaid
flowchart TD
  subgraph 输入层
    F[本地 TXT 文件<br/>选择 / 拖入] --> B[ArrayBuffer + FileMeta]
  end
  subgraph 解析层
    B --> P[Parser 接口]
    P --> T[TXT 解析器<br/>编码检测 · 段落规范化]
    P -.v0.2.-> E[EPUB 解析器]
  end
  T --> M[统一书籍模型 Book]
  E -.-> M
  subgraph 阅读层
    M --> O[偏移索引 offsetIndex]
    M --> V[阅读视图 ReaderView]
    O --> V
    O --> J[百分比跳转]
  end
  subgraph 持久化层
    S[localStorage<br/>进度 · 设置] --> V
    V --> S
  end
```

**依赖方向为单向**：输入层 → 解析层 → 模型 → 阅读层。阅读层可以依赖持久化层，但**禁止 import 任何解析器实现**，也禁止按 `format` 字段做分支渲染。这是 PRD §6 唯一硬约束在技术上的落点。

## 4. 模块划分

| 建议路径 | 职责 | 禁止 |
|---|---|---|
| `src/main.ts` | 装配解析器、存储、视图 | 不写业务逻辑 |
| `src/io/fileReader.ts` | F1 读 `ArrayBuffer`、生成 `bookId`（文件名 + 字节大小） | 不解码、不落库 |
| `src/parse/types.ts` | `Book / Chapter / Locator / Progress / Parser` 类型 | 不含实现 |
| `src/parse/txtParser.ts` | F2 编码检测、F3 段落规范化，纯函数 | 不碰 DOM / localStorage |
| `src/parse/index.ts` | 解析器注册与选择，v0.2 唯一改动点 | 阅读层不得引用具体实现 |
| `src/model/offsetIndex.ts` | 段落累计字符偏移、offset ↔ (段落, 段内偏移) 映射 | 不碰 DOM |
| `src/ui/ReaderView.tsx` | F4 阅读视图、分块渲染、主题/字号/行距 | 不判断 `format` |
| `src/ui/ProgressBar.tsx` | F6 百分比跳转入口 | 不直接算偏移 |
| `src/store/progress.ts` | F5 进度读写、节流、编码切换重置 | — |
| `src/store/settings.ts` | F4 设置读写 | — |

目录为建议，可调整；**`Parser` 接口与「阅读层只认 `Book`」的边界不可省**，这是 v0.2 换 EPUB 时 UI 零改动的前提。

## 5. 关键技术点

### F1 打开本地 TXT
选择或拖入单个 `.txt` → `File.arrayBuffer()` → 计算 `bookId = 文件名 + 字节大小` → 立即进入阅读视图。不缓存文件内容。

### F2 编码检测与切换
1. 先看 BOM（`EF BB BF` → UTF-8 BOM）。
2. 否则 `TextDecoder('utf-8', {fatal:true})` 试探；抛 `TypeError` 则 `TextDecoder('gbk')`。
3. 手动切换作为兜底，PRD 已明确要求。

⚠️ **PRD 盲区（本方案新增）**：`bookId` 只含文件名 + 字节大小，不含编码。同一文件用 UTF-8 与 GBK 解出的字符数不同，**编码切换后旧字符偏移会漂移**。处理：切换编码时清空该书进度并提示「进度已重置」，与 PRD §7「文件变更提示重置」同一逻辑。🔍 是否把 `encoding` 写入 `bookId` 或进度 schema，待评审后同步修订 PRD §6，本文不擅自改产品文档。

### F3 段落规范化
空行分段优先；无空行时按行末标点与行长启发式合并硬换行；设单段最大长度防止一整坨；**段首全角空格缩进不可 trim**。规则集中在 `txtParser.ts`，便于后续迭代与单测。

### F4 阅读视图
连续滚动；字号 3 档、行距 2 档、白天/夜间主题用 CSS 变量 + `data-theme` 切换，即时生效；设置写 `localStorage`，启动时读取恢复。

### F5 进度记忆（最容易被低估）
**只存字符偏移，不存滚动像素**——字号、行距、窗口宽度变化都会让像素位置漂移。偏移以 JS 字符串 code unit 计，在同一解析结果内稳定，不跨编码复用。

定位链路：

```
offset → 段落累计偏移索引（二分查找）→ (段落序号, 段内偏移)
       → 确保该段所在渲染块已挂载 → DOM Range → scrollIntoView
```

`offsetIndex.ts` 做成纯函数，是 Vitest 的重点对象。进度写入节流 300–500ms，并在 `visibilitychange` / `pagehide` 强制落盘。跳转前目标块未挂载时必须先渲染，否则 `scrollIntoView` 找不到节点。

### F6 线性跳转
`targetOffset = floor(totalChars × percent)` → 复用 F5 定位链路。边界（0%、100%、超界）单独测。不做目录树。

### F7 解析层解耦
`Parser` 接口输入 `ArrayBuffer + FileMeta`、输出 `Book`；阅读层只接收 `Book`。§5.4 第 4 条「假解析器注入」用一个返回固定 `Book` 的 fake parser 驱动渲染测试即可证明。

### 超大 TXT
按 PRD §9 先设 2 MB 阈值：超限给提示 + 分段挂载（分块渲染），不在首屏一次性生成全部 DOM。阈值用真实长篇实测后定值。

## 6. 数据模型落地

PRD §6 的类型原样保留，补充运行时所需的接口与存储结构：

```ts
type Book = {
  id: string
  title: string
  format: "txt" | "epub"
  paragraphs: string[]
  chapters: Chapter[]
}
type Chapter = { title: string; locator: Locator }
type Locator = { type: "offset" | "cfi"; value: number | string }
type Progress = { bookId: string; locator: Locator; percent: number; updatedAt: number }

type FileMeta = { name: string; size: number; encoding?: string }
interface Parser { parse(input: ArrayBuffer, meta: FileMeta): Book }

type ParagraphIndex = { starts: number[]; total: number }   // 每段起始累计偏移
type Settings = { fontSize: 1 | 2 | 3; lineHeight: 1 | 2; theme: "light" | "dark" }
type StoredProgress = { version: 1; books: Record<string, Progress> }
```

`Locator` 保持类型化（`offset` / `cfi`），v0.2 老进度不失效，这条不改。

## 7. 持久化与离线交付

| 项 | 方案 |
|---|---|
| localStorage keys | `reader:progress:v1`、`reader:settings:v1` |
| 写入 | 节流 300–500ms + 页面隐藏时强制落盘 |
| 读取 | `try/catch` + schema 校验，损坏回默认值，禁止白屏 |
| 主交付路径 | `vite-plugin-singlefile` 打成单个 `index.html`，`file://` 双击即用 |
| 开发期 | `vite dev` 或 `python -m http.server` |
| **离线产物验证** | 本机 Chrome `--headless=new --dump-dom "file:///..."` 单次模式（M0 实测通过✅） |
| **交互 E2E** | 起 `http://127.0.0.1` 本地静态服务 + Playwright `setInputFiles` 注入真实 TXT，覆盖 F1~F6 |

⚠️ **离线唯一真坑**：`file://` 直开多文件 Vite 产物时，ES module 受 CORS 策略拦截会加载失败。因此单文件产物是主路径，不是可选项。

**M0 实测结论（2026-11-09，已闭环）**：
- ✅ 本机 Chrome `chrome.exe --headless=new --dump-dom "file:///..."` 成功读到本地页面 DOM → 单文件 `file://` 交付路径成立。
- ❌ `playwright-cli open file://...` 报 `Access to "file:" protocol is blocked`；内置 WorkBuddy 浏览器的 `tabs_new` / `tab_goto` 把 URL 限制为 `^https?://` → **两者都不能用于验证 `file://` 产物**。
- ✅ 可行组合：交互验证一律走本地 `http://127.0.0.1` 服务（Playwright 用 `setInputFiles` 绕开原生文件选择框），离线产物验证走 Chrome 单次无头模式。
- 结论：ADR-001 / ADR-004 无需复议，**不引入桌面 computer use，也不安装 Chrome 扩展**（扩展只解决复用登录态，与本地产物验证无关）。

## 8. 测试策略（映射 PRD §5.4）

| 验收项 | 测试层 | 内容 |
|---|---|---|
| 解析器单测 | Vitest | BOM / UTF-8 / GBK 三路解码、硬换行合并、段首缩进、单段上限 |
| 模型契约（§5.4-4） | Vitest | 假解析器注入，证明阅读层不依赖 TXT 实现 |
| 偏移映射 | Vitest | offset ↔ (段落, 段内偏移) 往返、0 / 末位 / 超界、50% |
| 进度与设置 | Vitest | 写入读取、损坏兜底、编码切换重置 |
| 文档与仓库约定 | Python unittest | 现有 10 项 + 本文配套校验 |
| §5.4-1/2/3 | 自动化 E2E | 本地 http 服务 + Playwright：3 本真实中文 TXT（含 1 本 GBK）、刷新重开误差 < 1 屏、设置重启保留、50% 跳转 |
| 离线产物 | Chrome headless | `--dump-dom` 验单文件 `file://` 直开能渲染，无 ES module / CORS 报错 |

```bash
python -m unittest discover -s tests -v   # 仓库约定层
npm test                                  # vitest run，应用层单测
npm run test:e2e                          # Playwright 交互 E2E + Chrome headless 离线产物校验
npm run build                             # 产出单文件 HTML
```

**交付判定**：两条命令全绿（Python unittest + Vitest）+ E2E 脚本通过 + `git status` 干净 + 每个改动均有对应 commit。E2E 与单文件产物随实现一起落地，不把未建立的命令写成「已验证」。

## 9. 里程碑

| 阶段 | 产出 | 退出条件 |
|---|---|---|
| M0 探针 | 验证 `file://` 直开与交互验证通道 | ✅ 已完成（2026-11-09 实测，见 §7）；ADR-001 / ADR-004 无需复议 |
| M1 解析层 | `types.ts` + `txtParser.ts` + Vitest 解析器单测 | 3 本真实 TXT 无乱码、段落可读 |
| M2 阅读层 | `ReaderView` + 设置 + 分块渲染 | 字号/行距/主题即时生效且重启保留 |
| M3 进度与跳转 | `offsetIndex` + `progress` + 跳转 | 刷新恢复误差 < 1 屏、50% 跳转正确 |
| M4 验收 | 假解析器注入测试 + 手工清单 | PRD §5.4 五条全达标、两栈测试全绿、工作区干净 |

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| 单文件 `file://` 加载失败 | M0 已实测：Chrome 单次无头 `--dump-dom` 可读；若某浏览器仍失败，退到本地静态服务，仍不上桌面壳 |
| GBK 误判 | `fatal` 试探 + 手动切换兜底 + 真实样本压测 |
| 编码切换导致偏移漂移 | 切换即重置进度；`encoding` 是否进 `bookId` 待评审🔍 |
| 超大文件首屏卡死 | 2 MB 阈值 + 分块渲染，跳转前确保目标块已挂载 |
| 双测试栈漏跑一条 | 两条命令写进 PRD §8 与交付清单，M4 逐条核对 |
| 解耦过度 | 已确认 v0.2 要 EPUB，保留边界 |

## 11. 未决问题

- 超大文件分块阈值：先按 2 MB 试，实测后定（承接 PRD §9）。
- 编码是否写入 `bookId` / 进度 schema：确认后同步修订 PRD §6。
- 单文件产物内联全部 JS 对超大工程的影响：v0.1 体量下可忽略，实测观察。
- EPUB 解析库选型、是否记住最近打开的书：v0.2 开工前评估（承接 PRD §9）。

## 12. 交付约定

遵守仓库 `AGENTS.MD`：每次改动创建一个对应 Git commit；每次改动编写或更新相关测试，交付前确保全部通过。本次交付物为本文档与 `tests/test_tech_design.py`；实现阶段按 M1~M4 交付源码、Vitest 单测、E2E 脚本与单文件 HTML 产物。
