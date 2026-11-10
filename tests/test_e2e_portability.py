"""E2E 浏览器路径可移植性校验（不得写死本机用户名 / 盘符）。

运行：python -m unittest discover -s tests -v
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
E2E = ROOT / "tests" / "e2e" / "run.mjs"
README = ROOT / "README.md"


class TestE2EPortability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.e2e = E2E.read_text(encoding="utf-8") if E2E.is_file() else ""
        cls.readme = README.read_text(encoding="utf-8") if README.is_file() else ""

    def test_no_machine_specific_paths(self):
        for pattern in [r"C:/Users/", r"C:\\Users\\", r"gj137", r"C:/Program Files"]:
            with self.subTest(pattern=pattern):
                self.assertNotRegex(self.e2e, pattern, "E2E 脚本不得绑定某台机器")

    def test_env_override(self):
        for keyword in ["E2E_CHROME_PATH", "process.env", "npx playwright install chromium"]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.e2e)

    def test_cross_platform_detection(self):
        for keyword in [
            "platform()",
            "homedir",
            "LOCALAPPDATA",
            "PLAYWRIGHT_BROWSERS_PATH",
            "chromium.executablePath()",
            "readdirSync",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.e2e)

    def test_both_channels_use_resolver(self):
        self.assertGreaterEqual(self.e2e.count("resolveChrome()"), 2)
        self.assertNotIn("const CHROME =", self.e2e)

    def test_readme_documents_override(self):
        self.assertIn("E2E_CHROME_PATH", self.readme)
        self.assertIn("npx playwright install chromium", self.readme)


if __name__ == "__main__":
    unittest.main()
