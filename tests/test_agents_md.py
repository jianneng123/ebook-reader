"""仓库基础约定的验证测试。

运行：python -m unittest discover -s tests -v
"""

import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS_MD = ROOT / "AGENTS.MD"
GITIGNORE = ROOT / ".gitignore"

TITLE = "# 注意事项"
RULE_COMMIT = "- 每次改动完成后，都必须创建一个对应的 Git commit，以便后续追踪和回滚。"
RULE_TEST = "- 每次改动后，都必须编写或更新相关测试，并在交付给用户前，确保所有测试和验证全部通过。"
EXPECTED_LINES = [TITLE, RULE_COMMIT, RULE_TEST]


class TestAgentsMd(unittest.TestCase):
    def test_agents_md_exists(self):
        self.assertTrue(AGENTS_MD.is_file(), "AGENTS.MD 必须存在")

    def test_content_matches_image_verbatim(self):
        lines = [line for line in AGENTS_MD.read_text(encoding="utf-8").splitlines() if line.strip()]
        self.assertEqual(lines, EXPECTED_LINES)

    def test_git_repository_initialized(self):
        result = subprocess.run(
            ["git", "-C", str(ROOT), "rev-parse", "--is-inside-work-tree"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "true")

    def test_workbuddy_is_ignored(self):
        self.assertIn(".workbuddy/", GITIGNORE.read_text(encoding="utf-8"))
        result = subprocess.run(
            ["git", "-C", str(ROOT), "check-ignore", "-q", ".workbuddy/memory/2026-11-09.md"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, ".workbuddy/ 应被 Git 忽略")


if __name__ == "__main__":
    unittest.main()
