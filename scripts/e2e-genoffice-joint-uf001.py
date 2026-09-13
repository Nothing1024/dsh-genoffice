#!/usr/bin/env python3
"""UF-001 failure branches against a temporary master tree. Never touches the real plugin CSV."""
from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
MASTER_SCRIPT = PLUGIN / "docs/genoffice-web-roadmap/master.py"
SKILL = Path.home() / ".agents/skills/prd-workflow"
HEADERS = ["序号", "Phase", "名称", "详情锚点", "前置任务", "验证命令", "状态", "备注"]
DONE = "已完成"


def run_master(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(MASTER_SCRIPT), *args, "--json", "--repo", str(repo), "--skill-dir", str(SKILL)],
        capture_output=True,
        text=True,
    )


def write_rows(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def evidence(directory: Path, name: str) -> Path:
    target = directory / "docs" / name / "evidence/UF-001/success"
    target.mkdir(parents=True, exist_ok=True)
    result = {
        "schema_version": 1,
        "package": name,
        "uf": "UF-001",
        "branch": "success",
        "run_id": "joint-temp",
        "source_revisions": {"plugin": "fixture-plugin-sha", "engine": "fixture-engine-sha"},
        "status": "passed",
        "cases": [{"id": "fixture-case", "status": "passed", "assertions": [{"name": "fixture-equality", "expected": 1, "actual": 1, "status": "passed"}]}],
    }
    (target / "result.json").write_text(json.dumps(result))
    (target / "console.log").write_text("Fixture CLI capture completed: 0 console events\n")
    (target / "network.json").write_text("{}\n")
    (target / "screenshot.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)
    return target / "result.json"


def build_repo(root: Path) -> tuple[str, list[str]]:
    master_name = "genoffice-web-roadmap"
    children = ["first-package", "second-package"]
    golden = (SKILL / "examples/mini-package/spec.md").read_text()
    for name in ("src/pages/SettingsPage.tsx", "src/utils/download.ts"):
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("export function SettingsPage() {}\nexport function downloadJson() {}\n")
    for name in [master_name, *children]:
        directory = root / "docs" / name
        directory.mkdir(parents=True)
        (directory / "evidence").mkdir()
        text = re.sub(
            r"## 4\. Phase.*?(?=## 5\.)",
            "## 4. Phase 计划与任务详情\n\n"
            + "\n".join(
                f"### Task {index}: 测试任务 {index}\n\n**关联**：BR-001 / BR-002 / UF-001 / UF-002 / INV-001 / EVD-001 / EVD-002 / EVD-003\n\n**具体操作**：从真实入口接线与验证。\n\n**验证**：python3 --version → 通过\n"
                for index in range(1, 6)
            )
            + "\n",
            golden,
            flags=re.S,
        )
        if name == master_name:
            links = "\n".join(f"[子包](../{child}/spec.md#BR-001)" for child in children)
            text = text.replace("### 2.2 UF", links + "\n\n### 2.2 UF")
        realrun = "### 5.2 真实场景全套测试\n\n**环境准备**\n\n| 项 | 值 |\n|---|---|\n| 启动命令 | python3 --version |\n| 访问入口 | CLI 测试临时目录 |\n\n| UF | Evidence |\n|---|---|\n| UF-001 | `evidence/UF-001/success/result.json` + `evidence/UF-001/success/console.log` |\n"
        text = re.sub(r"### 5\.2\b.*?(?=### 5\.3)", realrun + "\n", text, flags=re.S)
        (directory / "spec.md").write_text(text)
        rows = []
        for index in range(1, 6):
            note = f"package={children[index - 2]}" if name == master_name and index in (2, 3) else ""
            task_name = "执行 spec 5.2 真实场景全套测试" if index == 4 else "执行 Phase 1 回归验证" if index == 5 else f"完成第 {index} 项测试任务"
            rows.append(dict(zip(HEADERS, [str(index), "P1:测试", task_name, f"spec.md#task-{index}", "无" if index == 1 else str(index - 1), "python3 --version → 通过；这是说明，不可按 shell 运行", "待开始", note])))
        write_rows(directory / "tasks.csv", rows)
    return master_name, children


def parse(run: subprocess.CompletedProcess[str]) -> dict:
    text = (run.stdout or "") + (run.stderr or "")
    start = text.find("{")
    if start < 0:
        return {"raw": text, "code": run.returncode}
    try:
        data = json.loads(text[start:])
    except json.JSONDecodeError:
        return {"raw": text, "code": run.returncode}
    data["code"] = run.returncode
    return data


def main() -> int:
    real_csv = (PLUGIN / "docs/genoffice-web-roadmap/tasks.csv").read_bytes()
    with tempfile.TemporaryDirectory(prefix="joint-uf001-") as tmp:
        repo = Path(tmp)
        master_name, children = build_repo(repo)
        master_csv = repo / "docs" / master_name / "tasks.csv"
        child_spec = repo / "docs" / children[0] / "spec.md"

        broken = run_master(repo, "next")
        # failure-1: delete spec, then restore
        backup = child_spec.read_text()
        child_spec.unlink()
        missing = parse(run_master(repo, "next"))
        child_spec.write_text(backup)
        restored = parse(run_master(repo, "validate"))
        cyclic_rows = list(csv.DictReader(master_csv.open()))
        # mutate child CSV cycle
        child_csv = repo / "docs" / children[0] / "tasks.csv"
        rows = list(csv.DictReader(child_csv.open(newline="")))
        rows[0]["前置任务"] = "2"
        write_rows(child_csv, rows)
        cyclic = parse(run_master(repo, "next"))
        rows[0]["前置任务"] = "无"
        write_rows(child_csv, rows)

        fail1 = {
            "broken_code": missing.get("code"),
            "broken_action": missing.get("action"),
            "broken_errors": missing.get("errors") or missing.get("raw"),
            "restored_passed": restored.get("passed") is True,
            "cyclic_code": cyclic.get("code"),
            "no_execute_task": missing.get("action") != "execute_task" and missing.get("action") != "resume_task",
        }

        # failure-2: false complete wrapper + empty evidence
        rows = list(csv.DictReader((repo / "docs" / master_name / "tasks.csv").open(newline="")))
        rows[0]["状态"] = DONE
        rows[1]["状态"] = DONE
        write_rows(repo / "docs" / master_name / "tasks.csv", rows)
        false_complete = parse(run_master(repo, "next"))
        evidence(repo, children[0])
        (repo / "docs" / children[0] / "evidence/UF-001/success/result.json").write_text("")
        empty_gate = parse(run_master(repo, "gate", children[0]))
        fail2 = {
            "false_complete_action": false_complete.get("action"),
            "false_complete_errors": false_complete.get("errors"),
            "empty_gate_passed": empty_gate.get("passed"),
            "empty_gate_errors": empty_gate.get("errors"),
            "downstream_locked": false_complete.get("action") == "blocked",
        }

        after = (PLUGIN / "docs/genoffice-web-roadmap/tasks.csv").read_bytes()
        payload = {
            "fail1": fail1,
            "fail2": fail2,
            "real_csv_unchanged": after == real_csv,
            "broken_stdout": (broken.stdout or "")[-400:],
            "missing_stdout": json.dumps(missing, ensure_ascii=False)[:800],
            "false_stdout": json.dumps(false_complete, ensure_ascii=False)[:800],
        }
        print(json.dumps(payload, ensure_ascii=False))
        ok = (
            payload["real_csv_unchanged"]
            and fail1["no_execute_task"]
            and fail1["restored_passed"]
            and fail2["downstream_locked"]
            and empty_gate.get("passed") is False
        )
        return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
