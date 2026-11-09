# 电子书阅读器 · 技术方案 v0.2（多书书架）

> 状态：已落地 · 已验收｜对应 `docs/PRD-v0.2.md`｜更新：2026-11-09｜基线：`docs/TECH_DESIGN.md` v0.1
> v0.1 的 ADR-001~006 继续有效；本文只记录 v0.2 增量决策。冲突时以 PRD-v0.2 为准。

## 1. 增量决策记录

| # | 决策项 | 结论 | 理由 | 推翻条件 |
|---|---|---|---|---|
| ADR-007 | 书籍持久化 | IndexedDB 存 `StoredBook`（含原始 `ArrayBuffer`） | localStorage 有 ~5MB 配额且不能直接存二进制；IndexedDB 可存结构化克隆的字节 | 需要跨设备同步时才引入后端 |
| ADR-008 | bookId | 内容指纹（FNV-1a 双路全字节 hash + 字节数） | v0.1 `name:size` 会让同名同大小的两本书共用一个进度；纯 JS 指纹不依赖 `crypto.subtle` 的安全上下文 | 需要识别「同一本书的不同版本」时改为显式版本链 |
| ADR-009 | 书架逻辑 | 纯函数模块 `shelf.ts`（去重 / 50 上限 / 分页 / 删除） | IndexedDB 不可在 Node 单测环境运行，纯逻辑与 I/O 分离后可全覆盖 | — |
| ADR-010 | 视图结构 | 单页双视图状态机 `shelf | reader` | 避免引入路由库；运行时依赖预算仍为 `preact` 1 个 | 页面数超过 3 个再评估 |
| ADR-011 | 书封 | 纯函数 `cover.ts` 由书名 hash 生成渐变与首字 | 无封面图资源，避免引入图片依赖或生成工具 | 支持用户自定义封面时再替换 |

## 2. 分层（v0.1 基础上新增）

```mermaid
flowchart TD
  subgraph 输入层
    F[多本 TXT<br/>多选 / 拖入] --> B[ArrayBuffer + FileMeta]
  end
  subgraph 书架层（新增）
    B --> FP[fingerprint.ts 内容指纹]
    FP --> SH[shelf.ts 纯逻辑<br/>去重 / 50 上限 / 分页 / 删除]
    SH --> IDB[(bookStore.ts<br/>IndexedDB)]
    IDB --> SV[ShelfView.tsx<br/>分页网格 + 文字书封]
  end
  subgraph 解析层（不变）
    IDB --> P[Parser 接口]
    P --> BOOK[统一书籍模型 Book]
  end
  subgraph 阅读层（不变）
    BOOK --> VM[viewModel / ReaderView / ProgressBar]
    VM --> PG[(localStorage 多书进度)]
  end
```

`src/main.tsx` 负责双视图编排；阅读层仍只认 `Book`，不认书架、不认 IndexedDB、不认 TXT 实现。

## 3. 持久化设计

| 项 | 方案 |
|---|---|
| DB | `ebook-reader`，object store `books`，keyPath `id` |
| 记录 | `StoredBook`（PRD-v0.2 §4），`buffer` 直接结构化克隆 |
| 读取 | `listBooks()` 返回不含 `buffer` 的摘要供书架渲染；`getBook(id)` 才取全文 |
| 写入 | 逐本 `putBook()`，失败汇总提示；`touchBook(id)` 更新 `lastReadAt` |
| 删除 | `deleteBook(id)` + `clearProgress(storage, id)` |
| 降级 | IndexedDB 打开失败（如 `file://` 受限）→ 内存 Map 书架，仅本次会话有效，界面提示 |
| 进度 | 沿用 `reader:progress:v1`，key 换成指纹 ID；schema 不变 |
| 编码 | 存进 `StoredBook.encoding`，切换书时由该书记录恢复 |
| 版本 | `package.json` → `0.2.0`，UI 徽章与标题自动跟随 |

## 4. 书架纯逻辑（`src/store/shelf.ts`）

```ts
const MAX_BOOKS = 50;
const PAGE_SIZE = 12;

type ShelfItem = { id, title, fileName, size, encoding, addedAt, lastReadAt, percent? };

addToShelf(items: ShelfItem[], candidate: ShelfItem): { items, reason: 'ok' | 'duplicate' | 'full' }
removeFromShelf(items: ShelfItem[], id: string): ShelfItem[]
pageCount(total: number): number
pageItems(items: ShelfItem[], page: number): ShelfItem[]   // 越界自动夹到合法页
```

- 上限与去重都在纯函数里判定，便于单测覆盖 0 / 1 / 12 / 13 / 49 / 50 / 51 边界。
- 书架按 `addedAt` 升序排列（先添加在前），不做用户自定义排序。

## 5. 文字书封（`src/ui/cover.ts`）

- `coverOf(title)` 返回 `{ hue, gradient, initial }`：书名 hash → 稳定色相，生成两段渐变；`initial` 取书名首字（去空白）。
- 纯函数、零 DOM 依赖，同名必同色，便于单测。

## 6. 测试策略

| 层 | 覆盖 |
|---|---|
| Vitest | 指纹稳定性 / 同名同大小不冲突；书架去重、50 上限、分页边界、删除；书封配色稳定 |
| Python unittest | PRD-v0.2 与本文的章节与关键决策校验；版本与文档一致性 |
| E2E（http 通道） | 多书保留、刷新持久、来回切换、独立进度、分页、50 上限、删除、主题贯通 |
| E2E（file:// 通道） | 单文件产物渲染不白屏、版本徽章可见、无外链 |
| 构建 | `npm run build` 类型检查 + 单文件产物 |

## 7. 已知限制

- `file://` 下 IndexedDB 可能被禁：书架降级为会话内存，永久保留需经本地 http 服务打开。
- v0.1 旧进度 key（`name:size`）与指纹 ID 不匹配，升级后旧进度一次性失效。
- 50 本长篇 TXT 的总体积受浏览器配额约束；写入失败只提示，不自动淘汰。
- v0.1 「2 MB 分块阈值待实测」与「`encoding` 是否写入 bookId」两项未决问题继续保留；编码已按书独立保存，不再依赖全局状态。
