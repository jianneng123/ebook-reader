"""验收记录的结构与结论校验。

运行：python -m unittest discover -s tests -v
"""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "ACCEPTANCE.md"

REQUIRED_SECTIONS = [
    "# 电子书阅读器 v0.2 · 验收记录",
    "## 验收命令",
    "## PRD §5.4 逐条核对（v0.1 基线）",
    "## v0.2 书架验收（PRD-v0.2 §7）",
    "## 交付物",
    "## 版本号查询",
    "## 验证通道说明（TECH_DESIGN §7 实测结论）",
    "## 已知限制（v0.2 有意取舍）",
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
        cls.version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]

    def test_doc_exists_and_not_empty(self):
        self.assertTrue(DOC.is_file(), "docs/ACCEPTANCE.md 必须存在")
        self.assertGreater(len(self.text.strip()), 1500)

    def test_required_sections_present(self):
        for section in REQUIRED_SECTIONS:
            with self.subTest(section=section):
                self.assertIn(section, self.text)

    def test_all_five_v01_criteria_documented(self):
        for number in range(1, 6):
            with self.subTest(number=number):
                self.assertIn(f"| {number} |", self.text)
        self.assertEqual(self.text.count("✅ 通过"), 5)

    def test_all_eight_v02_criteria_documented(self):
        self.assertEqual(self.text.count("✅ 达标"), 8)
        for keyword in [
            "IndexedDB", "50 本", "第 2 页", "文字书封", "删除", "刷新", "file://",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_verification_commands_documented(self):
        for command in REQUIRED_COMMANDS:
            with self.subTest(command=command):
                self.assertIn(command, self.text)

    def test_deliverables_and_limits_documented(self):
        for keyword in [
            "release/index.html", "tests/e2e/run.mjs", "tests/fixtures/",
            "ShelfView.tsx", "bookStore.ts", "fingerprint.ts",
            "本次会话有效", "2 MB", "EPUB",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_recorded_version_matches_package(self):
        self.assertIn(f"v{self.version}", self.text)
        self.assertIn("`package.json` → `version`", self.text)


if __name__ == "__main__":
    unittest.main()
