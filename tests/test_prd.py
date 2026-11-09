"""产品设计文档的结构与关键决策校验。

运行：python -m unittest discover -s tests -v
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRD = ROOT / "docs" / "PRD.md"

REQUIRED_SECTIONS = [
    "# 电子书阅读器 · 产品设计文档",
    "## 1. 背景与真正目标",
    "## 5. v0.1 功能清单",
    "## 6. 结构与关键数据",
    "## 8. 测试与交付约定",
]
REQUIRED_DECISIONS = [
    "TXT", "EPUB", "GBK", "解耦", "统一书籍模型",
    "进度", "验收标准", "云同步",
]


class TestProductDoc(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = PRD.read_text(encoding="utf-8") if PRD.is_file() else ""

    def test_doc_exists_and_not_empty(self):
        self.assertTrue(PRD.is_file(), "docs/PRD.md 必须存在")
        self.assertGreater(len(self.text.strip()), 500)

    def test_required_sections_present(self):
        for section in REQUIRED_SECTIONS:
            with self.subTest(section=section):
                self.assertIn(section, self.text)

    def test_key_decisions_documented(self):
        for keyword in REQUIRED_DECISIONS:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_scope_boundary_explicit(self):
        self.assertIn("### 5.3 明确不做", self.text)
        self.assertIn("### 5.1 必做功能", self.text)

    def test_epub_route_keeps_ui_unchanged(self):
        self.assertIn("v0.2", self.text)
        self.assertIn("UI 层零改动", self.text)

    def test_progress_locator_is_typed(self):
        self.assertIn('type: "offset" | "cfi"', self.text)


if __name__ == "__main__":
    unittest.main()
