# dsh-official-master Handoff

把尚未收口的正式化工作一次做完。细则以同目录 `spec.md` 为准。种类位子包：`../../../plugin/session-tool/plugin/docs/session-marks/`（相对本文件）。

## 1. 目标

1. 落地 session-marks（拆 vendor，marks.jsonl，双闸，listByKind）
2. 在官方化 genoffice 树上移植 `*_open` + SSE（禁止整包 stash apply）
3. vibee 开跑打 `kind:vibee`（不做新 Web tab）
4. 分仓本地 commit，禁止 force-push / 禁止 push

## 2. 资料

| 资料 | 路径 | 状态 |
|---|---|---|
| 总 spec | `spec.md` | found |
| 总 tasks | `tasks.csv` | found |
| 子 spec | `/Users/nothing/workspace/dsh/plugin/session-tool/plugin/docs/session-marks/spec.md` | found |
| Evidence | `evidence/` | found |

## 3. 地图

```text
P0 基线 → P1 子包 session-marks → P2 open/SSE → P3 vibee kind → P4 commit → P5 5.2
```

关键规则：总包 BR-M01～M07 与 INV-M01～M05；种类位细节见子包第 2 章。

禁止：假平台 session-tags；stash 整包；force-push；只跑单测当完成。

## 4. 初始化

PATH=`/Users/nothing/.nvm/versions/node/v24.18.0/bin:$PATH`

`git status` 三仓 + genoffice。不要 reset --hard。

基线：`node /Users/nothing/workspace/dsh/genoffice/scripts/dev.mjs smoke`

## 5. 循环

按 tasks.csv 1→13；更新状态；存 evidence。失败最多修 3 次。

## 6. 完成

总包 5.1 + 5.2；  
`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py /Users/nothing/workspace/dsh/genoffice/docs/dsh-official-master`
