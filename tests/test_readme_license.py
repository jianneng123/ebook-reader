"""开源交付物（README / MIT LICENSE）的结构与关键内容校验。

运行：python -m unittest discover -s tests -v
"""

import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
LICENSE = ROOT / "LICENSE"

REQUIRED_SECTIONS = [
    "# 电子书阅读器",
    "## 快速开始",
    "## 功能",
    "## 从源码构建",
    "## 目录结构",
    "## 许可证",
]

REQUIRED_COMMANDS = [
    "npm install",
    "npm run dev",
    "npm run build",
    "npm test",
    "npm run test:e2e",
]


class TestReadme(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = README.read_text(encoding="utf-8") if README.is_file() else ""

    def test_readme_exists(self):
        self.assertTrue(README.is_file(), "README.md 必须存在")

    def test_required_sections(self):
        for section in REQUIRED_SECTIONS:
            with self.subTest(section=section):
                self.assertIn(section, self.text)

    def test_usage_covers_both_entry_points(self):
        for keyword in ["release/index.html", "file://", "http://127.0.0.1", "IndexedDB"]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_build_and_test_commands(self):
        for command in REQUIRED_COMMANDS:
            with self.subTest(command=command):
                self.assertIn(command, self.text)

    def test_no_hardcoded_version(self):
        self.assertNotRegex(self.text, r"v\d+\.\d+\.\d+", "版本号唯一来源 package.json")

    def test_license_is_linked(self):
        self.assertIn("MIT", self.text)
        self.assertIn("[MIT](LICENSE)", self.text)


class TestLicense(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = LICENSE.read_text(encoding="utf-8") if LICENSE.is_file() else ""

    def test_license_exists(self):
        self.assertTrue(LICENSE.is_file(), "LICENSE 必须存在")

    def test_mit_boilerplate(self):
        for keyword in [
            "MIT License",
            "Permission is hereby granted, free of charge",
            'THE SOFTWARE IS PROVIDED "AS IS"',
            "WITHOUT WARRANTY OF ANY KIND",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.text)

    def test_copyright_notice(self):
        self.assertIn(f"Copyright (c) {date.today().year}", self.text)


if __name__ == "__main__":
    unittest.main()
