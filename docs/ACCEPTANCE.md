# 电子书阅读器 v0.1 · 验收记录

> 日期：2026-11-09｜对应 `docs/PRD.md` §5.4 与 `docs/TECH_DESIGN.md` §8｜状态：全部通过

## 验收命令

| 命令 | 用途 | 结果 |
|---|---|---|
| `python -m unittest discover -s tests -v` | 文档与仓库约定校验（含版本号唯一来源） | ✅ 31 项通过 |
| `npm test` | Vitest 应用层单测（含版本号模块） | ✅ 34 项通过 |
| `npm run test:e2e` | 本地 http 交互 E2E + `file://` 离线产物（含版本可见性） | ✅ 8/8 通过 |
| `npm run build` | 类型检查 + 单文件构建 | ✅ 产出 `release/index.html`（25.25 kB） |

## PRD §5.4 逐条核对

| # | 验收标准 | 证据 | 结论 |
|---|---|---|---|
| 1 | 至少 3 本真实中文 TXT（含 1 本 GBK）能打开、无乱码、段落可读 | `tests/fixtures/` 三本真实样本；`txtParser.test.ts`；E2E「§5.4-1」 | ✅ 通过 |
| 2 | 刷新 / 关闭后重新选同一文件，位置恢复误差小于 1 屏 | E2E「§5.4-2 刷新 / 重开同一文件后位置恢复」；进度按字符偏移存 `reader:progress:v1` | ✅ 通过 |
| 3 | 字号、行距、主题切换即时生效，且重启后保留 | E2E「§5.4-3 字号 / 行距 / 主题即时生效且重启保留」；`store.test.ts` | ✅ 通过 |
| 4 | 假解析器注入测试，证明阅读层不依赖 TXT 实现 | `contract.test.ts`：返回 `format: 'epub'` 的 fake parser 驱动 `createViewModel`，并静态断言阅读层源码不引用解析器实现 | ✅ 通过 |
| 5 | 测试全量通过、工作区干净、每次改动均有 commit | 上述四条命令 + `git status` 干净 + `git log` 逐次提交 | ✅ 通过 |

## 交付物

| 类型 | 路径 |
|---|---|
| 离线单文件产物（`file://` 双击即用，无外链） | `release/index.html` |
| 源码（解析层 / 模型 / 存储 / UI） | `src/` |
| 应用版本模块（唯一来源 `package.json`） | `src/version.ts` |
| 应用层单测 | `tests/unit/*.test.ts` |
| 仓库约定校验 | `tests/test_agents_md.py`、`tests/test_prd.py`、`tests/test_tech_design.py`、`tests/test_acceptance.py` |
| 端到端验收脚本 | `tests/e2e/run.mjs` |
| 真实中文 TXT 样本（UTF-8 / UTF-8 BOM / GBK） | `tests/fixtures/` |

## 版本号查询

| 入口 | 位置 |
|---|---|
| 打开阅读器 | **顶部工具栏蓝色徽章** `v0.1.0`（未打开文件时也常驻）；浏览器标签页标题「电子书阅读器 v0.1.0」 |
| 机器可读唯一来源 | `package.json` → `version` 字段（`npm pkg get version`） |
| 代码引用 | `src/version.ts` 读取 `package.json`，导出 `APP_VERSION` / `versionLabel()`；UI 与标题均调用它，无写死版本字符串 |
| 离线产物 | `release/index.html` 内联版本标签，`file://` 双击可见 |
| 代码版本 | `git log --oneline -1`（当前无 Git tag） |

改版本只需改 `package.json` 的 `version` 并重新 `npm run build`；版本号一致性由 `tests/unit/version.test.ts`、`tests/test_version.py` 与 E2E 双重校验。

## 验证通道说明（TECH_DESIGN §7 实测结论）

- 交互验证走 `http://127.0.0.1` 本地服务 + Playwright `setInputFiles`，绕开原生文件选择框。
- 单文件 `file://` 产物用 Chrome `--headless=new --dump-dom` 验证，产物内联全部 JS/CSS、无外链。
- 未安装 Chrome 扩展、未引入桌面 computer use；两者对验证本地离线产物没有增益。

## 已知限制（v0.1 有意取舍）

- 「重开恢复」= 重新选择同一文件后自动定位，**不会自动加载上一本书**（PRD §2 口径），文件本身不落库。
- 手动切换编码会重置该书进度，避免字符偏移漂移（TECH_DESIGN §5 F2）。
- 超过 2 MB 提示并启用分块渲染，阈值待真实长篇实测后定值（PRD §9）。
- v0.2 才引入 EPUB 解析器、目录树与最近阅读。
