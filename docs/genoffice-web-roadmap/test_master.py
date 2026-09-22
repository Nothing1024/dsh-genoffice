import csv
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("master.py")
MODULE = importlib.util.spec_from_file_location("genoffice_master", SCRIPT)
master = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(master)
SKILL = Path.home() / ".agents/skills/prd-workflow"


class MasterTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name)
        self.directory = self.repo / "docs" / SCRIPT.parent.name
        self.children = ["first-package", "second-package"]
        golden = (SKILL / "examples/mini-package/spec.md").read_text()
        for name in ("src/pages/SettingsPage.tsx", "src/utils/download.ts"):
            target = self.repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("export function SettingsPage() {}\nexport function downloadJson() {}\n")
        for name in [self.directory.name, *self.children]:
            directory = self.repo / "docs" / name
            directory.mkdir(parents=True)
            (directory / "evidence").mkdir()
            text = re.sub(r"## 4\. Phase.*?(?=## 5\.)", "## 4. Phase 计划与任务详情\n\n" + "\n".join(f"### Task {index}: 测试任务 {index}\n\n**关联**：BR-001 / BR-002 / UF-001 / UF-002 / INV-001 / EVD-001 / EVD-002 / EVD-003\n\n**具体操作**：从真实入口接线与验证。\n\n**验证**：python3 --version → 通过\n" for index in range(1, 6)) + "\n", golden, flags=re.S)
            if name == self.directory.name:
                links = "\n".join(f"[子包](../{child}/spec.md#BR-001)" for child in self.children)
                text = text.replace("### 2.2 UF", links + "\n\n### 2.2 UF")
            realrun = "### 5.2 真实场景全套测试\n\n**环境准备**\n\n| 项 | 值 |\n|---|---|\n| 启动命令 | python3 --version |\n| 访问入口 | CLI 测试临时目录 |\n\n| UF | Evidence |\n|---|---|\n| UF-001 | `evidence/UF-001/success/result.json` + `evidence/UF-001/success/console.log` |\n"
            text = re.sub(r"### 5\.2\b.*?(?=### 5\.3)", realrun + "\n", text, flags=re.S)
            (directory / "spec.md").write_text(text)
            rows = []
            for index in range(1, 6):
                note = f"package={self.children[index - 2]}" if name == self.directory.name and index in (2, 3) else ""
                task_name = "执行 spec 5.2 真实场景全套测试" if index == 4 else "执行 Phase 1 回归验证" if index == 5 else f"完成第 {index} 项测试任务"
                rows.append(dict(zip(master.HEADERS, [str(index), "P1:测试", task_name, f"spec.md#task-{index}", "无" if index == 1 else str(index - 1), "python3 --version → 通过；这是说明，不可按 shell 运行", "待开始", note])))
            self.write_rows(name, rows)

    def path(self, name):
        return self.repo / "docs" / name

    def rows(self, name):
        with (self.path(name) / "tasks.csv").open(newline="") as stream:
            return list(csv.DictReader(stream))

    def write_rows(self, name, rows):
        with (self.path(name) / "tasks.csv").open("w", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=master.HEADERS)
            writer.writeheader()
            writer.writerows(rows)

    def state(self, name, task_id, value):
        rows = self.rows(name)
        rows[task_id - 1]["状态"] = value
        self.write_rows(name, rows)

    def controller(self):
        return master.Master(self.directory, self.repo, SKILL)

    def evidence(self, name):
        directory = self.path(name) / "evidence/UF-001/success"
        directory.mkdir(parents=True, exist_ok=True)
        result = {"schema_version": 1, "package": name, "uf": "UF-001", "branch": "success", "run_id": "test-real-files", "source_revisions": {"plugin": "fixture-plugin-sha", "engine": "fixture-engine-sha"}, "status": "passed", "cases": [{"id": "fixture-case", "status": "passed", "assertions": [{"name": "fixture-equality", "expected": 1, "actual": 1, "status": "passed"}]}]}
        (directory / "result.json").write_text(json.dumps(result))
        (directory / "console.log").write_text("Fixture CLI capture completed: 0 console events\n")
        return directory / "result.json"

    def finish_child(self, name):
        rows = self.rows(name)
        for row in rows:
            row["状态"] = master.DONE
        self.write_rows(name, rows)
        self.evidence(name)

    def start_first(self):
        self.state(self.directory.name, 1, master.DONE)

    def test_real_validator_and_cli(self):
        run = subprocess.run([sys.executable, str(SCRIPT), "validate", "--json", "--repo", str(self.repo), "--skill-dir", str(SKILL)], capture_output=True, text=True)
        result = json.loads(run.stdout)
        self.assertEqual(run.returncode, 0, result)
        self.assertEqual(result["packages"], 3)
        self.assertEqual(result["tasks"], 15)
        self.assertEqual(len(result["validations"]), 3)

    def test_initial_next_is_master_preparation(self):
        result = self.controller().next()
        self.assertEqual((result["package"], result["taskId"]), (self.directory.name, 1))
        self.assertEqual(result["anchor"], "spec.md#task-1")

    def test_next_resumes_existing_active_task(self):
        self.start_first()
        self.state(self.children[0], 1, master.DONE)
        self.state(self.children[0], 2, "进行中")
        result = self.controller().next()
        self.assertEqual((result["action"], result["package"], result["taskId"]), ("resume_task", self.children[0], 2))

    def test_active_task_precedes_independent_ready_task(self):
        self.start_first()
        rows = self.rows(self.children[0])
        rows[0]["状态"] = master.DONE
        rows[2]["前置任务"] = "1"
        rows[2]["状态"] = "进行中"
        self.write_rows(self.children[0], rows)
        result = self.controller().next()
        self.assertEqual((result["action"], result["taskId"]), ("resume_task", 3))

    def test_bad_csv_headers(self):
        path = self.directory / "tasks.csv"
        path.write_text(path.read_text().replace("序号,Phase", "任务号,Phase", 1))
        with self.assertRaisesRegex(master.PackageError, "8 列"):
            self.controller()

    def test_bad_csv_row_width(self):
        path = self.directory / "tasks.csv"
        path.write_text(path.read_text().replace("待开始,", "待开始,,", 1))
        with self.assertRaisesRegex(master.PackageError, "错列"):
            self.controller()

    def test_missing_spec(self):
        (self.path(self.children[0]) / "spec.md").unlink()
        with self.assertRaisesRegex(master.PackageError, "缺少"):
            self.controller()

    def test_unknown_and_cyclic_dependencies(self):
        for dependency, message in (("9", "未知"), ("2", "有环")):
            with self.subTest(dependency=dependency):
                rows = self.rows(self.children[0])
                rows[0]["前置任务"] = dependency
                self.write_rows(self.children[0], rows)
                with self.assertRaisesRegex(master.PackageError, message):
                    self.controller()

    def test_illegal_status_and_number(self):
        for field, value, message in (("状态", "done", "非法状态"), ("序号", "8", "序号")):
            with self.subTest(field=field):
                rows = self.rows(self.children[0])
                old = rows[0][field]
                rows[0][field] = value
                self.write_rows(self.children[0], rows)
                with self.assertRaisesRegex(master.PackageError, message):
                    self.controller()
                rows[0][field] = old
                self.write_rows(self.children[0], rows)

    def test_blocked_child_cannot_skip(self):
        self.start_first()
        self.state(self.children[0], 1, "已阻塞:真实网关缺失")
        result = self.controller().next()
        self.assertEqual(result["action"], "blocked")
        self.assertIn("真实网关缺失", str(result["errors"]))

    def test_later_child_cannot_start_early(self):
        self.start_first()
        self.state(self.children[1], 1, "进行中")
        result = self.controller().next()
        self.assertEqual(result["action"], "blocked")
        self.assertIn("尚未完成", str(result["errors"]))

    def test_false_completed_wrapper_is_regated(self):
        self.start_first()
        self.state(self.directory.name, 2, master.DONE)
        result = self.controller().next()
        self.assertEqual(result["action"], "blocked")
        self.assertIn("子包闸门未通过", str(result["errors"]))

    def test_completed_child_first_returns_close_wrapper(self):
        self.start_first()
        self.finish_child(self.children[0])
        result = self.controller().next()
        self.assertEqual((result["action"], result["taskId"]), ("close_wrapper", 2), result)
        self.assertEqual(self.rows(self.directory.name)[1]["状态"], "待开始")
        self.state(self.directory.name, 2, master.DONE)
        result = self.controller().next()
        self.assertEqual((result["package"], result["taskId"]), (self.children[1], 1), result)

    def test_all_children_unlock_joint_and_complete(self):
        self.start_first()
        for index, name in enumerate(self.children, 2):
            self.finish_child(name)
            self.state(self.directory.name, index, master.DONE)
        result = self.controller().next()
        self.assertEqual((result["package"], result["taskId"]), (self.directory.name, 4), result)
        self.finish_child(self.directory.name)
        self.assertEqual(self.controller().next()["action"], "complete")

    def test_joint_evidence_gates_final_regression(self):
        self.start_first()
        for index, name in enumerate(self.children, 2):
            self.finish_child(name)
            self.state(self.directory.name, index, master.DONE)
        self.state(self.directory.name, 4, master.DONE)
        result = self.controller().next()
        self.assertEqual(result["action"], "blocked")
        self.evidence(self.directory.name)
        result = self.controller().next()
        self.assertEqual((result["package"], result["taskId"]), (self.directory.name, 5))

    def test_empty_failed_or_incomplete_result_is_rejected(self):
        self.start_first()
        self.finish_child(self.children[0])
        path = self.evidence(self.children[0])
        valid = json.loads(path.read_text())
        invalid = [{}, {**valid, "status": "failed"}, {**valid, "cases": []}, {**valid, "source_revisions": {}}, {**valid, "cases": [{"id": "a", "status": "passed", "assertions": []}]}]
        for value in invalid:
            with self.subTest(value=value):
                path.write_text(json.dumps(value))
                self.assertFalse(self.controller().gate(self.children[0])["passed"])
        path.write_text("")
        self.assertFalse(self.controller().gate(self.children[0])["passed"])

    def test_failed_assertion_is_rejected(self):
        self.start_first()
        self.finish_child(self.children[0])
        path = self.evidence(self.children[0])
        result = json.loads(path.read_text())
        result["cases"][0]["assertions"][0]["status"] = "failed"
        path.write_text(json.dumps(result))
        self.assertFalse(self.controller().gate(self.children[0])["passed"])

    def test_expected_business_error_is_valid_evidence(self):
        self.start_first()
        self.finish_child(self.children[0])
        path = self.evidence(self.children[0])
        result = json.loads(path.read_text())
        assertion = result["cases"][0]["assertions"][0]
        assertion.update({"expected": {"error": "stale", "status": 409}, "actual": {"error": "stale", "status": 409}})
        path.write_text(json.dumps(result))
        self.assertTrue(self.controller().gate(self.children[0])["passed"])

    def test_first_child_cannot_gate_before_master_preparation(self):
        self.finish_child(self.children[0])
        result = self.controller().gate(self.children[0])
        self.assertFalse(result["passed"])
        self.assertIn("母包 Task 1", str(result["errors"]))

    def test_status_is_read_only(self):
        before = {name: (self.path(name) / "tasks.csv").read_bytes() for name in [self.directory.name, *self.children]}
        result = self.controller().status()
        self.assertEqual(len(result["packages"]), 3)
        self.assertEqual(result["next"]["taskId"], 1)
        self.assertEqual(before, {name: (self.path(name) / "tasks.csv").read_bytes() for name in before})

    def test_missing_exact_file_not_replaced_by_sibling(self):
        self.start_first()
        self.finish_child(self.children[0])
        path = self.path(self.children[0]) / "evidence/UF-001/success/console.log"
        path.rename(path.with_name("another.log"))
        self.assertFalse(self.controller().gate(self.children[0])["passed"])

    def test_prior_package_gate_required(self):
        self.finish_child(self.children[1])
        result = self.controller().gate(self.children[1])
        self.assertFalse(result["passed"])
        self.assertIn(self.children[0], str(result["errors"]))

    def test_navigation_and_evidence_path_escape(self):
        path = self.directory / "spec.md"
        path.write_text(path.read_text().replace("../first-package/spec.md", "../../outside/spec.md"))
        with self.assertRaisesRegex(master.PackageError, "非法子包"):
            self.controller()

    def test_symlink_escape(self):
        directory = self.path(self.children[0])
        spec = directory / "spec.md"
        external = self.repo / "external.md"
        external.write_text(spec.read_text())
        spec.unlink()
        spec.symlink_to(external)
        with self.assertRaisesRegex(master.PackageError, "越界"):
            self.controller()

    def test_evidence_symlink_escape(self):
        self.start_first()
        self.finish_child(self.children[0])
        path = self.path(self.children[0]) / "evidence/UF-001/success/console.log"
        external = self.repo / "external.log"
        external.write_text("external")
        path.unlink()
        path.symlink_to(external)
        result = self.controller().gate(self.children[0])
        self.assertFalse(result["passed"])
        self.assertIn("越界", str(result["errors"]))

    def test_wrapper_mapping_is_single_source(self):
        rows = self.rows(self.directory.name)
        rows[1]["备注"] = "package=unknown"
        self.write_rows(self.directory.name, rows)
        with self.assertRaisesRegex(master.PackageError, "逐一一致"):
            self.controller()


if __name__ == "__main__":
    unittest.main()
