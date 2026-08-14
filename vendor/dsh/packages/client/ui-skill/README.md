# @deepseek-ai/dsh-client-ui-skill

English | [中文](README.zh.md)

Skill reference source, browser half: registers the `/`-trigger `skill` source into `ctx.slash`. Ordinary-session candidates come from the `skill.list` RPC addressed by the per-call `ClientSessionContext` projection's `{sessionId}`, with the host resolving `cwd` from the session header. The host returns the intersection of model-invocable and user-invocable skills because this browser path inserts a model reference rather than loading the body directly. Catalog-addressed continuable children resolve no skill candidates locally because the existing skill RPC requires an attached session; viewing their persisted history must not activate them. Catalogs cache per ordinary session with a single-flight fetch; the scope-birth `warm` hook prewarms the session's entry and `connection/reset` clears everything. Results filter by `startsWith(query)`; picking a candidate lands the literal `/name ` text through the slash pipeline (decision 21 plain-text reference), and the source `codec` owns the reference's two projections: `clipboardText` → `/name`, `serialize` → the model form `<skill>name</skill>` invoked at submit time. The RPC rides the plugin's root-context connection captured at registration — the source never reads services off a per-call argument. The source implements no `matchSpace`/`matchEnter` hooks — skill references never enter command adjudication and ride ordinary prompts into the default sink.

A failed `skill.list` throws from `candidates`, which the slash shell logs and folds into a silent menu-group drop — the menu shows only pending/ready states.

The `/client` export surface is the plugin body (`apply`/`inject`) only; the source object is internal to the registration effect.

## Model Experience

### Skill reference text in the user prompt

#### What the model sees

A picked candidate lands the literal `/name ` in the draft (decision 21: plain text, no `<skill>` tag); the text reaches the model verbatim inside the ordinary user message (`session.prompt`), with no dedicated content block, prompt section, or host-side expansion. The association with the actual skill is model-side and non-deterministic: the session prefix already carries the skill catalog (rendered by `dsh-tool-skill`), and the reference's name matching a catalog entry is what invites the model to load it.

#### Token effect

Conditional and tiny: only a pick (or hand-typing the same text) adds the reference's characters to that one user message. Menu browsing and the candidate fetch add zero model tokens.

#### KV Cache effect

Append-only: the reference is part of a new user message appended after the reusable history prefix. This package never edits earlier request tokens.

## Known Limitations and Deferred Work

- **Non-deterministic skill loading** — the reference is a collaboration cue, not a guarantee; the model may ignore it. The rework path when hit rate proves insufficient (a host-side `context/skill-reference` guidance package, or full-text injection) sits in the design ledger; the wire text shape would not change.
- **First keystroke may race the prewarm** — the scope-birth warm launches the catalog fetch, but a menu opened before it settles shows no skill candidates for that keystroke. Accepted by design: skill references do not participate in enter adjudication, so nothing correctness-bearing waits on the catalog.
- **Text is the truth** — the reference is plain draft text; a hand-typed identical token is the same reference. Chip visuals derive from the lexicon scan; no occurrence identity or position tracking (componentized chips are a ledger item).
