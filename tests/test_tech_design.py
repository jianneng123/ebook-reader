"""技术方案文档的结构与关键决策校验。

运行：python -m unittest discover -s tests -v
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "docs" / "TECH_DESIGN.md"
PRD = ROOT / "docs" / "PRD.md"

REQUIRED_SECTIONS = [
    "# 电子书阅读器 · 技术方案 v0.1",
    "## 1. 结论与决策记录",
    "## 2. 约束推导",
    "## 3. 总体架构",
    "## 4. 模块划分",
    "## 5. 关键技术点",
    "## 6. 数据模型落地",
    "## 7. 持久化与离线交付",
    "## 8. 测试策略（映射 PRD §5.4）",
    "## 9. 里程碑",
    "## 10. 风险与对策",
    "## 11. 未决问题",
    "## 12. 交付约定",
]

REQUIRED_DECISIONS = [
    "TypeScript", "Vite", "Preact", "Electron", "Tauri",
    "TextDecoder", "localStorage", "Vitest", "Parser",
    "统一书籍模型", "Locator", "offset", "分块", "commit",
]


class TestTechDesign(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = DESIGN.read_text(encoding="utf-8") if DESIGN.is_file() else ""

    def test_doc_exists_and_not_empty(self):
        self.assertTrue(DESIGN.is_file(), "docs/TECH_DESIGN.md 必须存在")
        self.assertGreater(len(self.text.strip()), 2000)

    def test_required_sections_present(self):
        for section in REQUIRED_SECTIONS:
            with self.subTest(section=section):
                self.assertIn(section, self.text)

    def test_stack_decisions_documented(self):
        for keyword in REQUIRED_DECISIONS:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_electron_rejected_with_reconsideration_condition(self):
        self.assertIn("v0.1 不上 Electron", self.text)
        self.assertIn("ADR-001", self.text)
        self.assertIn("复议触发条件", self.text)

    def test_architecture_boundary_kept(self):
        self.assertIn("禁止 import 任何解析器实现", self.text)
        self.assertIn("v0.2", self.text)
        self.assertIn("假解析器", self.text)

    def test_offline_delivery_constraint_documented(self):
        self.assertIn("vite-plugin-singlefile", self.text)
        self.assertIn("file://", self.text)
        self.assertIn("CORS", self.text)

    def test_test_strategy_matches_repo_rules(self):
        self.assertIn("python -m unittest discover -s tests -v", self.text)
        self.assertIn("npm test", self.text)
        self.assertIn("PRD §5.4", self.text)
        self.assertIn("两条命令全绿", self.text)

    def test_known_blind_spots_flagged(self):
        self.assertIn("编码切换后旧字符偏移会漂移", self.text)
        self.assertIn("2 MB", self.text)

    def test_validation_paths_documented(self):
        """M0 实测结论必须落进方案，避免后续误用无法走 file:// 的自动化通道。"""
        for keyword in [
            "Chrome headless", "http://127.0.0.1", "setInputFiles",
            'Access to "file:" protocol is blocked', "npm run test:e2e",
            "M0 实测结论", "自动化 E2E",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_delivery_state_documented(self):
        for keyword in ["已实现", "ACCEPTANCE.md", "npm run test:e2e"]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_aligned_with_prd(self):
        self.assertTrue(PRD.is_file(), "技术方案必须对应已有的 docs/PRD.md")
        self.assertIn("v0.1", self.text)
        self.assertIn('"offset" | "cfi"', self.text)
        self.assertIn("以 PRD 为准", self.text)


if __name__ == "__main__":
    unittest.main()
