# 电子书阅读器 v0.2 · 验收记录

> 日期：2026-11-09｜对应 `docs/PRD.md` §5.4、`docs/PRD-v0.2.md` §7 与 `docs/TECH_DESIGN-v0.2.md` §6｜状态：全部通过

## 验收命令

| 命令 | 用途 | 结果 |
|---|---|---|
| `python -m unittest discover -s tests -v` | 文档与仓库约定校验（含 v0.2 需求、验收记录、版本号唯一来源） | ✅ 41 项通过 |
| `npm test` | Vitest 应用层单测（含指纹 / 书架逻辑 / 书封 / 书库降级） | ✅ 52 项通过 |
| `npm run test:e2e` | 本地 http 多书交互 E2E + `file://` 离线产物 | ✅ 14/14 通过 |
| `npm run build` | 类型检查 + 单文件构建 | ✅ 产出 `release/index.html`（34.55 kB） |

## PRD §5.4 逐条核对（v0.1 基线）

| # | 验收标准 | 证据 | 结论 |
|---|---|---|---|
| 1 | 至少 3 本真实中文 TXT（含 1 本 GBK）能打开、无乱码、段落可读 | `tests/fixtures/` 三本真实样本；`txtParser.test.ts`；E2E「§5.4-1」 | ✅ 通过 |
| 2 | 刷新 / 关闭后重新选同一文件，位置恢复误差小于 1 屏 | E2E「§5.4-2 刷新 / 重开同一文件后位置恢复」；进度按字符偏移存 `reader:progress:v1` | ✅ 通过 |
| 3 | 字号、行距、主题切换即时生效，且重启后保留 | E2E「§5.4-3 字号 / 行距 / 主题即时生效、重启保留且书架贯通」；`store.test.ts` | ✅ 通过 |
| 4 | 假解析器注入测试，证明阅读层不依赖 TXT 实现 | `contract.test.ts`：返回 `format: 'epub'` 的 fake parser 驱动 `createViewModel`，并静态断言阅读层源码不引用解析器实现 | ✅ 通过 |
| 5 | 测试全量通过、工作区干净、每次改动均有 commit | 上述四条命令 + `git status` 干净 + `git log` 逐次提交 | ✅ 通过 |

## v0.2 书架验收（PRD-v0.2 §7）

| # | 验收标准 | 证据 | 结论 |
|---|---|---|---|
| 1 | 导入 3 本后书架 3 张卡片，文字书封下方显示文件名 | E2E「R1/R3/R8 导入 3 本互不覆盖」 | ✅ 达标 |
| 2 | 刷新 / 重开后书仍在，点封面直接阅读，无需重选文件 | E2E「R2/R7 刷新后书架仍在」（IndexedDB 全文持久化） | ✅ 达标 |
| 3 | A → 返回 → B → 返回 → A 切换，内容与各自进度正确 | E2E「R4/R5 三本书来回切换」 | ✅ 达标 |
| 4 | 第 13 本触发第 2 页，上一页 / 下一页可用，页码正确 | E2E「R9 第 13 本触发第 2 页」 | ✅ 达标 |
| 5 | 满 50 本拒绝导入并提示；删除一本后可再导入 | E2E「R10/R11 满 50 本拒绝导入；删除一本后可再导入」 | ✅ 达标 |
| 6 | 删除清除该书进度；主题在书架与阅读页一致 | E2E「R10/R11」与「§5.4-3」；`shelf.test.ts` 删除边界 | ✅ 达标 |
| 7 | `file://` 单文件产物仍能渲染、不白屏，版本徽章可见 | E2E 通道 B（Chrome headless `--dump-dom`） | ✅ 达标 |
| 8 | 四条命令全绿、工作区干净、每次改动有 commit | 本表 + `git status` + `git log` | ✅ 达标 |

补充覆盖：同一内容重复导入去重（E2E「R3」）、按书保存编码（E2E「F2/R6」）、多选批量导入 50 本（E2E「R10」）、硬换行合并（E2E「F3」）、50% 跳转（E2E「F6」）、版本号常驻可见（E2E「打开阅读器即可看到版本号」）。

## 交付物

| 类型 | 路径 |
|---|---|
| 离线单文件产物（`file://` 双击即用，无外链） | `release/index.html` |
| v0.2 需求与增量方案 | `docs/PRD-v0.2.md`、`docs/TECH_DESIGN-v0.2.md` |
| 源码（解析层 / 模型 / 存储 / UI） | `src/` |
| 书架数据层 | `src/store/fingerprint.ts`、`src/store/shelf.ts`、`src/store/bookStore.ts` |
| 书架 UI | `src/ui/ShelfView.tsx`、`src/ui/cover.ts` |
| 应用版本模块（唯一来源 `package.json`） | `src/version.ts` |
| 应用层单测 | `tests/unit/*.test.ts` |
| 仓库约定校验 | `tests/test_agents_md.py`、`tests/test_prd.py`、`tests/test_tech_design.py`、`tests/test_prd_v02.py`、`tests/test_version.py`、`tests/test_acceptance.py` |
| 端到端验收脚本 | `tests/e2e/run.mjs` |
| 真实中文 TXT 样本（UTF-8 / UTF-8 BOM / GBK） | `tests/fixtures/` |

## 版本号查询

| 入口 | 位置 |
|---|---|
| 打开阅读器 | **顶部工具栏蓝色徽章** `v0.2.0`（书架与阅读页均常驻）；浏览器标签页标题「电子书阅读器 v0.2.0」 |
| 机器可读唯一来源 | `package.json` → `version` 字段（`npm pkg get version`） |
| 代码引用 | `src/version.ts` 读取 `package.json`，导出 `APP_VERSION` / `versionLabel()`；UI 与标题均调用它，无写死版本字符串 |
| 离线产物 | `release/index.html` 内联版本标签，`file://` 双击可见 |
| 代码版本 | `git log --oneline -1`（当前无 Git tag） |

改版本只需改 `package.json` 的 `version` 并重新 `npm run build`；版本号一致性由 `tests/unit/version.test.ts`、`tests/test_version.py`、`tests/test_prd_v02.py` 与 E2E 多重校验。

## 验证通道说明（TECH_DESIGN §7 实测结论）

- 交互验证走 `http://127.0.0.1` 本地服务 + Playwright `setInputFiles`，绕开原生文件选择框；多书 / IndexedDB / 分页 / 50 本上限全部在此通道验证。
- 单文件 `file://` 产物用 Chrome `--headless=new --dump-dom` 验证，产物内联全部 JS/CSS、无外链。
- 未安装 Chrome 扩展、未引入桌面 computer use；两者对验证本地离线产物没有增益。

## 已知限制（v0.2 有意取舍）

- `file://` 来源下浏览器可能禁用 IndexedDB：此时书架降级为**本次会话有效**并给出提示；永久保留在 `http://127.0.0.1` 等常规来源下成立。
- `bookId` 由 v0.1 的 `文件名:大小` 改为内容指纹，v0.1 遗留进度会与新 ID 失配，属一次性迁移代价。
- 手动切换编码仍会重置该书进度，避免字符偏移漂移。
- 超过 2 MB 提示并启用分块渲染，阈值待真实长篇实测后定值。
- 50 本长篇 TXT 全文入库可能触及浏览器配额；写入异常会捕获并提示，不静默丢书。
- EPUB 解析器、目录树、笔记高亮、全文搜索、云同步、书架排序与分组、自定义封面均不在 v0.2 范围。
