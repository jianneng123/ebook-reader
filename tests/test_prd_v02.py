"""v0.2 多书书架需求与增量方案的仓库约定校验。

运行：python -m unittest discover -s tests -v
"""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRD_V02 = ROOT / "docs" / "PRD-v0.2.md"
DESIGN_V02 = ROOT / "docs" / "TECH_DESIGN-v0.2.md"
PRD_V01 = ROOT / "docs" / "PRD.md"
DESIGN_V01 = ROOT / "docs" / "TECH_DESIGN.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.is_file() else ""


class TestPrdV02(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prd = read(PRD_V02)
        cls.design = read(DESIGN_V02)
        cls.old_prd = read(PRD_V01)
        cls.old_design = read(DESIGN_V01)
        cls.pkg = json.loads(read(ROOT / "package.json"))

    def test_both_v02_docs_exist(self):
        self.assertTrue(PRD_V02.is_file(), "docs/PRD-v0.2.md 必须存在")
        self.assertTrue(DESIGN_V02.is_file(), "docs/TECH_DESIGN-v0.2.md 必须存在")
        self.assertGreater(len(self.prd.strip()), 1500)
        self.assertGreater(len(self.design.strip()), 1000)

    def test_prd_required_sections(self):
        for section in [
            "# 电子书阅读器 · 产品设计文档 v0.2（多书书架）",
            "## 2. 用户确认的四项决策",
            "## 3. 功能需求",
            "## 4. 数据模型（v0.2 增量）",
            "## 6. 明确不做",
            "## 7. 验收标准",
            "## 8. 风险与对策",
        ]:
            with self.subTest(section=section):
                self.assertIn(section, self.prd)

    def test_four_confirmed_decisions_documented(self):
        for keyword in [
            "存全文，永久保留", "IndexedDB", "分页网格 + 页码", "每页 12 本",
            "自动生成文字书封", "满 50 本拒绝导入", "二次确认", "不覆盖",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.prd)

    def test_scope_boundary_and_acceptance(self):
        for keyword in ["EPUB", "云同步", "来回切换", "独立进度", "独立编码", "file://"]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.prd)
        for number in range(1, 9):
            with self.subTest(number=number):
                self.assertIn(f"| {number} |", self.prd)

    def test_design_records_incremental_adrs(self):
        for keyword in [
            "ADR-007", "ADR-008", "ADR-009", "ADR-010", "ADR-011",
            "IndexedDB", "fingerprint.ts", "shelf.ts", "ShelfView.tsx",
            "MAX_BOOKS = 50", "PAGE_SIZE = 12", "降级",
        ]:
            with self.subTest(keyword=keyword):
                self.assertIn(keyword, self.design)

    def test_v01_docs_point_to_v02(self):
        self.assertIn("docs/PRD-v0.2.md", self.old_prd)
        self.assertIn("docs/TECH_DESIGN-v0.2.md", self.old_design)
        self.assertIn("取代", self.old_prd)

    def test_package_version_is_semver(self):
        self.assertRegex(self.pkg["version"], r"^\d+\.\d+\.\d+$")
        self.assertEqual(self.pkg["name"], "ebook-reader")


if __name__ == "__main__":
    unittest.main()
