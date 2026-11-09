"""验收记录的结构与结论校验。

运行：python -m unittest discover -s tests -v
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "ACCEPTANCE.md"

REQUIRED_SECTIONS = [
    "# 电子书阅读器 v0.1 · 验收记录",
    "## 验收命令",
    "## PRD §5.4 逐条核对",
    "## 交付物",
    "## 版本号查询",
    "## 验证通道说明（TECH_DESIGN §7 实测结论）",
    "## 已知限制（v0.1 有意取舍）",
]

REQUIRED_COMMANDS = [
    "python -m unittest discover -s tests -v",
    "npm test",
    "npm run test:e2e",
    "npm run build",
]


class TestAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = DOC.read_text(encoding="utf-8") if DOC.is_file() else ""

    def test_doc_exists_and_not_empty(self):
        self.assertTrue(DOC.is_file(), "docs/ACCEPTANCE.md 必须存在")
        self.assertGreater(len(self.text.strip()), 800)

    def test_required_sections_present(self):
        for section in REQUIRED_SECTIONS:
            with self.subTest(section=section):
                self.assertIn(section, self.text)

    def test_all_five_criteria_documented(self):
        for number in range(1, 6):
            with self.subTest(number=number):
                self.assertIn(f"| {number} |", self.text)
        self.assertEqual(self.text.count("✅ 通过"), 5)

    def test_verification_commands_documented(self):
        for command in REQUIRED_COMMANDS:
            with self.subTest(command=command):
                self.assertIn(command, self.text)

    def test_deliverables_and_limits_documented(self):
        for keyword in [
            "release/index.html", "tests/e2e/run.mjs", "tests/fixtures/",
            "不会自动加载上一本书", "切换编码会重置该书进度", "2 MB",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)


if __name__ == "__main__":
    unittest.main()
