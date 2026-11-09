"""版本号唯一来源与界面可见性的仓库约定校验。

运行：python -m unittest discover -s tests -v
"""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative_path: str) -> str:
    path = ROOT / relative_path
    return path.read_text(encoding="utf-8") if path.is_file() else ""


class TestVersion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pkg_text = read("package.json")
        cls.version_source = read("src/version.ts")
        cls.main_source = read("src/main.tsx")
        cls.css = read("src/styles.css")
        cls.acceptance = read("docs/ACCEPTANCE.md")

    def test_package_json_has_semver(self):
        version = json.loads(self.pkg_text)["version"]
        self.assertRegex(version, r"^\d+\.\d+\.\d+$")

    def test_version_module_reads_package_json(self):
        self.assertIn("from '../package.json'", self.version_source)
        self.assertIn("pkg.version", self.version_source)
        self.assertIn("versionLabel", self.version_source)
        self.assertNotRegex(self.version_source, r"v\d+\.\d+\.\d+")

    def test_ui_shows_version_without_hardcoding(self):
        self.assertIn('class="app-version"', self.main_source)
        self.assertIn("versionLabel()", self.main_source)
        self.assertIn("document.title", self.main_source)
        self.assertNotRegex(self.main_source, r"v\d+\.\d+\.\d+")

    def test_version_badge_has_visible_style(self):
        self.assertIn(".app-version", self.css)
        self.assertIn("background:", self.css)

    def test_acceptance_documents_version_entry(self):
        self.assertIn("## 版本号查询", self.acceptance)
        for keyword in ["package.json", "src/version.ts", "顶部工具栏", "浏览器标签页标题"]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.acceptance)


if __name__ == "__main__":
    unittest.main()
