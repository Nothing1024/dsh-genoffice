#!/usr/bin/env python3
"""Read-only navigation and evidence gates for the packages linked by this spec."""

import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path


HEADERS = ["序号", "Phase", "名称", "详情锚点", "前置任务", "验证命令", "状态", "备注"]
DONE = "已完成"
NOTE = "闸门只核验状态、结构和证据记录；执行者仍须核对真实场景语义、源码版本及证据时效。不会执行 CSV 命令或修改状态。"


class PackageError(ValueError):
    pass


def confined(path, boundary):
    resolved = path.resolve()
    if not resolved.is_relative_to(boundary.resolve()):
        raise PackageError(f"路径越界（包括符号链接）: {path}")
    return resolved


def section(text, number):
    found = re.search(rf"^### {re.escape(number)}\b[^\n]*\n(.*?)(?=^### |^## |\Z)", text, re.M | re.S)
    if not found:
        raise PackageError(f"缺少 spec §{number}")
    return found.group(1)


def read_package(directory):
    spec = confined(directory / "spec.md", directory)
    board = confined(directory / "tasks.csv", directory)
    if not spec.is_file() or not board.is_file():
        raise PackageError(f"{directory.name}: 缺少 spec.md 或 tasks.csv")
    text = spec.read_text(encoding="utf-8")
    with board.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != HEADERS:
            raise PackageError(f"{directory.name}: CSV 必须严格使用 8 列 {HEADERS}")
        rows = list(reader)
    if not rows:
        raise PackageError(f"{directory.name}: tasks.csv 为空")
    for index, row in enumerate(rows, 1):
        if set(row) != set(HEADERS) or any(value is None for value in row.values()):
            raise PackageError(f"{directory.name}: CSV 第 {index} 行错列")
        if row["序号"] != str(index):
            raise PackageError(f"{directory.name}: 序号必须从 1 连续排列，第 {index} 行不符")
        state = row["状态"]
        if state not in ("待开始", "进行中", DONE) and not re.fullmatch(r"已阻塞:\S.*", state):
            raise PackageError(f"{directory.name} Task {index}: 非法状态 {state!r}")
        if row["详情锚点"] != f"spec.md#task-{index}" or not re.search(rf"^### Task {index}:\s*\S", text, re.M):
            raise PackageError(f"{directory.name} Task {index}: 详情锚点或任务标题缺失")
        raw = row["前置任务"]
        if raw == "无":
            dependencies = []
        elif re.fullmatch(r"[1-9]\d*(;[1-9]\d*)*", raw):
            dependencies = [int(item) for item in raw.split(";")]
        else:
            raise PackageError(f"{directory.name} Task {index}: 非法前置任务 {raw!r}")
        if len(set(dependencies)) != len(dependencies) or any(item > len(rows) for item in dependencies):
            raise PackageError(f"{directory.name} Task {index}: 重复或未知前置任务")
        row["dependencies"] = dependencies
    visiting, visited = set(), set()

    def visit(task_id):
        if task_id in visiting:
            raise PackageError(f"{directory.name}: 依赖有环，涉及 Task {task_id}")
        if task_id in visited:
            return
        visiting.add(task_id)
        for dependency in rows[task_id - 1]["dependencies"]:
            visit(dependency)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in range(1, len(rows) + 1):
        visit(task_id)
    return {"name": directory.name, "directory": directory, "spec": spec, "board": board, "text": text, "rows": rows}


def result_errors(data, package, relative):
    prefix = f"{package}: {relative}"
    if not isinstance(data, dict):
        return [f"{prefix}: result 必须为对象"]
    errors = []
    parts = Path(relative).parts
    uf = next((part for part in parts if re.fullmatch(r"UF-\d{3}", part)), None)
    branch = Path(relative).parent.name
    expected = {"schema_version": 1, "package": package, "uf": uf, "branch": branch, "status": "passed"}
    for key, value in expected.items():
        if value is None or data.get(key) != value or (key == "schema_version" and type(data.get(key)) is not int):
            errors.append(f"{prefix}: {key} 必须为 {value!r}")
    if not re.fullmatch(r"success|failure-[1-9]\d*", branch):
        errors.append(f"{prefix}: 无法识别场景分支")
    if not isinstance(data.get("run_id"), str) or not data["run_id"].strip():
        errors.append(f"{prefix}: run_id 必须非空")
    revisions = data.get("source_revisions")
    if not isinstance(revisions, dict) or any(not isinstance(revisions.get(key), str) or not revisions[key].strip() for key in ("plugin", "engine")):
        errors.append(f"{prefix}: source_revisions.plugin/engine 必须非空")
    cases = data.get("cases")
    if not isinstance(cases, list) or not cases:
        return errors + [f"{prefix}: cases 必须为非空数组"]
    for index, case in enumerate(cases, 1):
        if not isinstance(case, dict) or case.get("status") != "passed" or not isinstance(case.get("id"), str) or not case["id"].strip():
            errors.append(f"{prefix}: case {index} 必须有非空 id 且 status=passed")
            continue
        assertions = case.get("assertions")
        if not isinstance(assertions, list) or not assertions:
            errors.append(f"{prefix}: case {index} assertions 必须非空")
            continue
        for assertion in assertions:
            if not isinstance(assertion, dict) or assertion.get("status") != "passed" or not isinstance(assertion.get("name"), str) or not assertion["name"].strip() or "expected" not in assertion or "actual" not in assertion:
                errors.append(f"{prefix}: case {index} 每个 assertion 必须有 name、expected、actual 且 status=passed")
    return errors


class Master:
    def __init__(self, directory, repo, skill_dir):
        self.repo = Path(repo).resolve()
        self.skill_dir = Path(skill_dir).resolve()
        directory = confined(Path(directory), self.repo / "docs")
        self.master = read_package(directory)
        links = re.findall(r"\]\(([^)]+/spec\.md#BR-001)\)", section(self.master["text"], "2.1"))
        if not links:
            raise PackageError("母包 §2.1 缺少子包导航链接")
        self.children = []
        for link in links:
            if not re.fullmatch(r"\.\./[a-z0-9]+(?:-[a-z0-9]+)*/spec\.md#BR-001", link):
                raise PackageError(f"非法子包链接: {link}")
            child_dir = confined(directory / link.split("#")[0], self.repo / "docs").parent
            if child_dir == directory or any(child["directory"] == child_dir for child in self.children):
                raise PackageError(f"重复或自指子包: {link}")
            self.children.append(read_package(child_dir))
        self.packages = [self.master, *self.children]
        self.by_name = {package["name"]: package for package in self.packages}
        wrappers = []
        for row in self.master["rows"]:
            matches = re.findall(r"(?:^|[\s;；])package=([^\s;；]+)", row["备注"])
            if len(matches) > 1:
                raise PackageError(f"母包 Task {row['序号']}: 包装关系重复")
            row["package"] = matches[0] if matches else None
            if matches:
                wrappers.append(row)
        if [row["package"] for row in wrappers] != [child["name"] for child in self.children]:
            raise PackageError("母包 CSV package= 包装关系必须与 spec §2.1 子包顺序逐一一致")
        if len(self.master["rows"]) != len(self.children) + 3 or [int(row["序号"]) for row in wrappers] != list(range(2, len(self.children) + 2)):
            raise PackageError("母包必须依次为准备、各子包包装、联合真实场景、回归")
        for index, row in enumerate(self.master["rows"], 1):
            if row["dependencies"] != ([] if index == 1 else [index - 1]):
                raise PackageError(f"母包 Task {index}: 必须顺序依赖上一任务")
        self.wrappers = wrappers
        self.gate_cache = {}

    def skill_validate(self, package):
        validator = self.skill_dir / "scripts" / "validate_package.py"
        if not validator.is_file():
            return {"package": package["name"], "passed": False, "output": f"缺少 skill validator: {validator}；请传 --skill-dir"}
        try:
            run = subprocess.run([sys.executable, str(validator), str(package["directory"]), "--repo", str(self.repo)], capture_output=True, text=True, timeout=60)
            return {"package": package["name"], "passed": run.returncode == 0, "exit_code": run.returncode, "output": run.stdout + run.stderr}
        except (OSError, subprocess.TimeoutExpired) as error:
            return {"package": package["name"], "passed": False, "output": str(error)}

    def package_gate(self, package, require_complete=True):
        name = package["name"]
        key = (name, require_complete)
        if key in self.gate_cache:
            return self.gate_cache[key]
        errors = [f"{name} Task {row['序号']}: {row['状态']}，尚未完成" for row in package["rows"] if require_complete and row["状态"] != DONE]
        validation = self.skill_validate(package)
        if not validation["passed"]:
            errors.append(f"{name}: skill validator 未通过，见 validations.output")
        paths = sorted(set(re.findall(r"`(evidence/[^`]+)`", section(package["text"], "5.2"))))
        if not paths or not any(Path(path).name == "result.json" for path in paths):
            errors.append(f"{name}: spec §5.2 必须列出具体 result.json 及证据文件")
        for relative in paths:
            try:
                if any(char in relative for char in "*{}?\\") or ".." in Path(relative).parts:
                    raise PackageError(f"{name}: 非法证据路径 {relative}")
                path = confined(package["directory"] / relative, package["directory"])
                if not path.is_file() or path.stat().st_size == 0:
                    raise PackageError(f"{name}: 证据文件缺失、不是普通文件或为空: {relative}")
                if Path(relative).name == "result.json":
                    errors.extend(result_errors(json.loads(path.read_text(encoding="utf-8")), name, relative))
            except (PackageError, OSError, ValueError) as error:
                errors.append(str(error))
        result = {"package": name, "passed": not errors, "errors": errors, "validations": [validation]}
        self.gate_cache[key] = result
        return result

    def gate(self, name):
        name = self.master["name"] if name in (None, "master") else name
        if name not in self.by_name:
            raise PackageError(f"未知 package: {name}；可选 {', '.join(self.by_name)}")
        selected = self.by_name[name]
        required = self.packages if selected == self.master else self.children[:self.children.index(selected) + 1]
        checks = [self.package_gate(package) for package in required]
        errors = [error for check in checks for error in check["errors"]]
        if selected != self.master:
            wrapper = next(row for row in self.wrappers if row["package"] == name)
            errors.extend(f"母包 Task {row['序号']}: 前置状态为 {row['状态']}" for row in self.master["rows"][:int(wrapper["序号"]) - 1] if row["状态"] != DONE)
        return {"action": "gate", "package": name, "passed": not errors, "errors": errors, "validations": [validation for check in checks for validation in check["validations"]]}

    def task_action(self, package, row, action=None):
        return {"action": action or ("resume_task" if row["状态"] == "进行中" else "execute_task"), "package": package["name"], "spec": str(package["spec"]), "tasks": str(package["board"]), "taskId": int(row["序号"]), "anchor": row["详情锚点"], "name": row["名称"], "status": row["状态"], "instruction": "阅读 spec 对应任务及关联合同；实现、真实验证并归档证据后，只更新 tasks.csv 对应状态，再调用 next。"}

    def blocked(self, reasons, package=None, row=None):
        result = self.task_action(package, row, "blocked") if package and row else {"action": "blocked"}
        if package and not row:
            result.update({"package": package["name"], "spec": str(package["spec"]), "tasks": str(package["board"])})
        result.update({"errors": reasons, "instruction": "先解决所列阻塞并补齐证据；不得跳到后续包，也不得仅修改状态放行。"})
        return result

    def unmet(self, package, row):
        return [f"{package['name']} Task {row['序号']} 依赖 Task {dependency}（{package['rows'][dependency - 1]['状态']}）" for dependency in row["dependencies"] if package["rows"][dependency - 1]["状态"] != DONE]

    def next(self):
        pending = next((row for row in self.master["rows"] if row["状态"] != DONE), None)
        if pending:
            for later in self.master["rows"][int(pending["序号"]):]:
                if later["状态"] != "待开始":
                    return self.blocked([f"母包 Task {later['序号']} 在前置 Task {pending['序号']} 尚未完成时已启动"], self.master, later)
                child = self.by_name.get(later["package"])
                if child and any(task["状态"] != "待开始" for task in child["rows"]):
                    return self.blocked([f"{child['name']} 在母包前置 Task {pending['序号']} 尚未完成时已启动"], child)
        for row in self.master["rows"]:
            missing = self.unmet(self.master, row)
            if missing:
                return self.blocked(missing, self.master, row)
            child = self.by_name.get(row["package"])
            if row["状态"] == DONE:
                if child:
                    gate = self.package_gate(child)
                    if not gate["passed"]:
                        return self.blocked([f"母包 Task {row['序号']} 已标完成，但子包闸门未通过", *gate["errors"]], self.master, row)
                elif "真实场景" in row["名称"]:
                    gate = self.package_gate(self.master, require_complete=False)
                    if not gate["passed"]:
                        return self.blocked(gate["errors"], self.master, row)
                continue
            if row["状态"].startswith("已阻塞:"):
                return self.blocked([f"{self.master['name']} Task {row['序号']}: {row['状态']}"], self.master, row)
            if child:
                for task in child["rows"]:
                    if task["状态"].startswith("已阻塞:"):
                        return self.blocked([f"{child['name']} Task {task['序号']}: {task['状态']}"], child, task)
                    if task["状态"] in (DONE, "进行中") and self.unmet(child, task):
                        return self.blocked(self.unmet(child, task), child, task)
                active = [task for task in child["rows"] if task["状态"] == "进行中"]
                ready = [task for task in child["rows"] if task["状态"] == "待开始" and not self.unmet(child, task)]
                if active or ready:
                    return self.task_action(child, (active or ready)[0])
                gate = self.package_gate(child)
                if not gate["passed"]:
                    return self.blocked(gate["errors"], child)
                result = self.task_action(self.master, row, "close_wrapper")
                result["instruction"] = f"子包 {child['name']} 已全部完成并通过闸门；核对证据真实性与源码版本后，将本母包包装任务改为已完成，再调用 next。"
                return result
            return self.task_action(self.master, row)
        result = self.gate("master")
        return {"action": "complete"} if result["passed"] else self.blocked(result["errors"])

    def validate(self):
        validations = [self.skill_validate(package) for package in self.packages]
        errors = [f"{item['package']}: skill validator 未通过" for item in validations if not item["passed"]]
        for package in self.packages:
            for row in package["rows"]:
                if row["状态"] in (DONE, "进行中"):
                    errors.extend(self.unmet(package, row))
            if any(row["状态"] == DONE and "真实场景" in row["名称"] for row in package["rows"]):
                errors.extend(self.package_gate(package, require_complete=False)["errors"])
        for row in self.wrappers:
            if row["状态"] == DONE:
                errors.extend(self.package_gate(self.by_name[row["package"]])["errors"])
        return {"action": "validate", "passed": not errors, "packages": len(self.packages), "tasks": sum(len(package["rows"]) for package in self.packages), "errors": errors, "validations": validations}

    def status(self):
        packages = []
        for package in self.packages:
            rows = package["rows"]
            packages.append({
                "package": package["name"], "tasks": str(package["board"]), "total": len(rows),
                "completed": sum(row["状态"] == DONE for row in rows),
                "inProgress": [int(row["序号"]) for row in rows if row["状态"] == "进行中"],
                "blocked": [{"taskId": int(row["序号"]), "reason": row["状态"]} for row in rows if row["状态"].startswith("已阻塞:")],
            })
        return {"action": "status", "packages": packages, "next": self.next()}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "status", "next", "gate"))
    parser.add_argument("package", nargs="?")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--repo", type=Path)
    parser.add_argument("--skill-dir", type=Path, default=Path.home() / ".agents/skills/prd-workflow")
    args = parser.parse_args(argv)
    if args.package and args.command != "gate":
        parser.error("只有 gate 接受 package 参数")
    default_directory = Path(__file__).resolve().parent
    repo = args.repo.resolve() if args.repo else default_directory.parent.parent
    directory = repo / "docs" / default_directory.name if args.repo else default_directory
    try:
        controller = Master(directory, repo, args.skill_dir)
        result = controller.gate(args.package) if args.command == "gate" else getattr(controller, args.command)()
        exit_code = 0
        if result.get("passed") is False:
            exit_code = 1
        if result.get("action") == "blocked" or result.get("next", {}).get("action") == "blocked":
            exit_code = 2
    except (PackageError, OSError, UnicodeError) as error:
        result, exit_code = {"action": args.command, "passed": False, "errors": [str(error)]}, 1
    result["note"] = NOTE
    print(json.dumps(result, ensure_ascii=False, indent=None if args.json else 2))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
