# dsh-genoffice/plugin

This git repo's loopback DSH env is `env/` (profile `go`, port `3082`).

Machine-local shared catalog (not in this git repo):
- `~/workspace/dsh/plugin/.shared/settings.yaml` — `llm-pi-ai` / `agent-default-model`
- `~/workspace/dsh/plugin/.shared/plugins.yaml` — extra plugins keyed by warehouse path
- `~/workspace/dsh/plugin/.shared/.env` — API key (mode 600)

After changing the catalog: `sh ~/workspace/dsh/plugin/.shared/apply.sh --warehouse dsh-genoffice/plugin`
then restart `env/boot.sh` if extra plugin versions changed.

Do not hand-edit `env/settings.yaml` shared namespaces.
Do not vendor extra plugins into `packages/`.
Neighbor `link:` packages stay in this profile; apply does not touch them.

Exposing an engine editor tool: follow the upstream-sync review rule in
`../engine/CLAUDE.md` ("Syncing the official upstream"). Record each decision in
`packages/tab-genoffice/src/host/capability.ts`; unreviewed tools stay unregistered.
