import { createElement, useEffect, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/tabs/icon.tsx
/** Shared SVG presentation props for sidebar tab icons (16px grid). */
const TAB_ICON_PROPS = {
	width: 14,
	height: 14,
	viewBox: "0 0 16 16",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.4,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
/** GenOffice document glyph. `size` is accepted for the TabDescriptor icon callback. */
function GenOfficeIcon(_props) {
	return /* @__PURE__ */ jsxs("svg", {
		...TAB_ICON_PROPS,
		children: [/* @__PURE__ */ jsx("path", { d: "M4 2h5l3 3v9H4z" }), /* @__PURE__ */ jsx("path", { d: "M9 2v3h3M6.5 8.5h3M6.5 11h3" })]
	});
}
//#endregion
//#region src/tabs/relay.ts
/**
* GenOffice relay loopback: shared by the file-list panel and the control-mode
* viewer. Probe state is a module-level store so both surfaces show one strip.
*/
/** The genoffice relay base (loopback; CORS loopback whitelist covers it). */
const RELAY_BASE = "http://localhost:8787";
const PREVIEWABLE = {
	docx: "docs",
	md: "markdown",
	xlsx: "sheets",
	pptx: "slides",
	pdf: "pdf"
};
const RELAY_THROTTLE_MS = 1500;
let relayOk = null;
let lastProbeAt = 0;
let inFlight = null;
const listeners$1 = /* @__PURE__ */ new Set();
function getRelayOk() {
	return relayOk;
}
function subscribeRelay(fn) {
	listeners$1.add(fn);
	return () => {
		listeners$1.delete(fn);
	};
}
function emitRelay() {
	for (const fn of listeners$1) fn();
}
/** Update the shared flag without a network round-trip (list fetch already proved it). */
function noteRelayOk(ok) {
	if (relayOk === ok) return;
	relayOk = ok;
	lastProbeAt = Date.now();
	emitRelay();
}
function extOf(path) {
	const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	const base = slash < 0 ? path : path.slice(slash + 1);
	const dot = base.lastIndexOf(".");
	return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
}
async function docIdFor(absPath) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(absPath));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Control mode adds `control=1`; `_r` busts the iframe after save/reload (BR-014). */
function previewUrlFor(path, ext, control, nonce) {
	const app = PREVIEWABLE[ext];
	if (app === void 0) return "";
	const target = encodeURIComponent(`path:${path}`);
	const extra = nonce !== void 0 && nonce !== "" ? `&_r=${encodeURIComponent(nonce)}` : "";
	return `${RELAY_BASE}/${app}/?${control ? "control=1&" : ""}open=${target}${extra}`;
}
/** Raw health probe (no store). */
async function checkRelay(signal) {
	try {
		return (await fetch(`${RELAY_BASE}/api/dir?path=`, signal === void 0 ? void 0 : { signal })).ok;
	} catch {
		return false;
	}
}
/** Shared probe with throttle. `force` bypasses throttle (「重新检查」). */
async function probeRelay(force = false, signal) {
	const now = Date.now();
	if (!force && inFlight !== null) return inFlight;
	if (!force && relayOk !== null && now - lastProbeAt < RELAY_THROTTLE_MS) return relayOk;
	lastProbeAt = now;
	inFlight = checkRelay(signal).then((ok) => {
		relayOk = ok;
		emitRelay();
		return ok;
	}).finally(() => {
		inFlight = null;
	});
	return inFlight;
}
async function notifyHostSync(path) {
	try {
		await fetch(`${window.location.origin}/dsh-artifact/genoffice-sync`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path })
		});
	} catch {}
}
//#endregion
//#region src/tabs/coexist.ts
/**
* Click-preview coexistence config (BR-007). Changing claimed types or
* degrade behaviour is a constant edit, not a render-logic rewrite.
*
* 2026-08-13 decision (ASM-001): claim docx / xlsx / pptx; leave md / pdf
* to the upstream builtin viewers. Degrade stays manual.
*/
const CLAIMED_EXTS = [
	"docx",
	"xlsx",
	"pptx"
];
/** better-sidebar builtin viewer ids keyed by our extension. */
const UPSTREAM_VIEWER_ID = {
	docx: "docx",
	xlsx: "xlsx",
	pptx: "pptx",
	md: "markdown",
	pdf: "pdf"
};
//#endregion
//#region src/tabs/doc-registry.ts
const active = /* @__PURE__ */ new Map();
const listeners = /* @__PURE__ */ new Set();
function notify() {
	for (const listener of listeners) listener();
}
function lookupActive(docId) {
	return active.get(docId);
}
function subscribeActive(listener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
/** Register occupancy. Returns an unregister function. */
function registerActive(docId, entry) {
	active.set(docId, entry);
	queueMicrotask(notify);
	return () => {
		if (active.get(docId) === entry) {
			active.delete(docId);
			notify();
		}
	};
}
//#endregion
//#region src/tabs/genoffice.module.css
var genoffice_module_default = {
	"btn": "n2sFFq_btn",
	"crumb": "n2sFFq_crumb",
	"fileName": "n2sFFq_fileName",
	"hint": "n2sFFq_hint",
	"homeNote": "n2sFFq_homeNote",
	"iframe": "n2sFFq_iframe",
	"list": "n2sFFq_list",
	"panel": "n2sFFq_panel",
	"pathBar": "n2sFFq_pathBar",
	"pathInput": "n2sFFq_pathInput",
	"pathText": "n2sFFq_pathText",
	"row": "n2sFFq_row",
	"rowClickable": "n2sFFq_rowClickable",
	"rowDisabled": "n2sFFq_rowDisabled",
	"rowIcon": "n2sFFq_rowIcon",
	"rowName": "n2sFFq_rowName",
	"rowTag": "n2sFFq_rowTag",
	"toolbar": "n2sFFq_toolbar"
};
//#endregion
//#region src/tabs/control-mode.tsx
/**
* The single control-mode surface: health probe, iframe, toolbar (save /
* reload-from-disk / browser-open / back), and relay-down degrade.
*/
const ROW_ICON_PROPS$1 = {
	...TAB_ICON_PROPS,
	width: 14,
	height: 14
};
const BROWSER_OPEN_TITLE = "离开控制模式；网页版 AI 面板可直连第三方模型服务商，可能出网";
function ControlModeViewer(props) {
	const { path, title, ext, onBack, renderBuiltin } = props;
	const degradeMode = props.degradeMode ?? "manual";
	const [relayOk, setRelayOk] = useState(() => getRelayOk());
	const [yielded, setYielded] = useState(false);
	const [blocked, setBlocked] = useState(false);
	const [previewLoaded, setPreviewLoaded] = useState(false);
	const [previewError, setPreviewError] = useState(false);
	const [frameNonce, setFrameNonce] = useState(() => crypto.randomUUID());
	const [syncing, setSyncing] = useState(false);
	const [popupHint, setPopupHint] = useState(false);
	const [saveState, setSaveState] = useState("idle");
	const [saveMessage, setSaveMessage] = useState(null);
	const iframeRef = useRef(null);
	const probeSeq = useRef(0);
	const busy = saveState === "saving" || syncing;
	const unloadPreview = () => {
		const prev = iframeRef.current;
		if (prev !== null) prev.src = "about:blank";
	};
	const remountControl = async () => {
		setSyncing(true);
		setPreviewLoaded(false);
		setPreviewError(false);
		await notifyHostSync(path);
		setFrameNonce(crypto.randomUUID());
	};
	const probe = (force = true) => {
		const seq = ++probeSeq.current;
		setRelayOk(null);
		setYielded(false);
		probeRelay(force, new AbortController().signal).then((ok) => {
			if (seq !== probeSeq.current) return;
			setRelayOk(ok);
		});
	};
	useEffect(() => {
		return subscribeRelay(() => {
			setRelayOk(getRelayOk());
		});
	}, []);
	useEffect(() => {
		probe(false);
		return () => {
			probeSeq.current += 1;
			unloadPreview();
		};
	}, [path]);
	useEffect(() => {
		let cancelled = false;
		let unregister;
		const tryClaim = () => {
			docIdFor(path).then((id) => {
				if (cancelled) return;
				if (unregister !== void 0) return;
				if (lookupActive(id) !== void 0) {
					setBlocked(true);
					return;
				}
				setBlocked(false);
				unregister = registerActive(id, { surface: onBack === void 0 ? "viewer" : "tab" });
			});
		};
		tryClaim();
		const stop = subscribeActive(tryClaim);
		return () => {
			cancelled = true;
			stop();
			unregister?.();
		};
	}, [path, onBack]);
	useEffect(() => {
		if (saveState !== "saved") return;
		const timer = window.setTimeout(() => {
			setSaveState("idle");
			setSaveMessage(null);
		}, 4e3);
		return () => {
			window.clearTimeout(timer);
		};
	}, [saveState]);
	const saveToDisk = async () => {
		if (busy) return;
		const app = PREVIEWABLE[ext];
		if (app === void 0) return;
		const docId = await docIdFor(path);
		setSaveState("saving");
		setSaveMessage(null);
		try {
			const data = await (await fetch(`${RELAY_BASE}/api/control/${app}/${docId}/export`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path })
			})).json();
			if (data.ok) {
				setSaveState("saved");
				setSaveMessage(`已保存到 ${data.path ?? path}`);
				await remountControl();
			} else if (data.error === "conflict") {
				setSaveState("conflict");
				setSaveMessage("文件已被外部修改，未覆盖 — 请点「从磁盘重载」后再保存");
			} else if (data.error === "executor not registered") {
				setSaveState("error");
				setSaveMessage("文档未在控制模式打开（执行器未注册）— 请重新打开预览");
			} else {
				setSaveState("error");
				setSaveMessage(`写入失败：${data.error ?? "未知错误"}`);
			}
		} catch (e) {
			setSaveState("error");
			setSaveMessage(`写入失败：${e instanceof Error ? e.message : String(e)}`);
		}
	};
	const reloadFromDisk = () => {
		if (busy) return;
		if (!window.confirm("从磁盘重新加载？未保存的编辑会丢失。")) return;
		remountControl();
	};
	const openInBrowser = () => {
		if (window.open(previewUrlFor(path, ext, false), "_blank", "noopener") === null) setPopupHint(true);
	};
	const goBack = () => {
		unloadPreview();
		onBack?.();
	};
	const toolbar = /* @__PURE__ */ jsxs("div", {
		className: genoffice_module_default.toolbar,
		children: [
			onBack !== void 0 && /* @__PURE__ */ jsxs("button", {
				type: "button",
				className: genoffice_module_default.btn,
				disabled: busy,
				onClick: goBack,
				children: [/* @__PURE__ */ jsx("svg", {
					...ROW_ICON_PROPS$1,
					children: /* @__PURE__ */ jsx("path", { d: "M10.5 3.5 6 8l4.5 4.5" })
				}), "返回"]
			}),
			/* @__PURE__ */ jsx("span", {
				className: genoffice_module_default.fileName,
				title: path,
				children: title
			}),
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: genoffice_module_default.btn,
				disabled: busy,
				title: "将当前编辑内容原子写回原文件",
				onClick: () => {
					saveToDisk();
				},
				children: [/* @__PURE__ */ jsx("svg", {
					...ROW_ICON_PROPS$1,
					children: /* @__PURE__ */ jsx("path", { d: "M11 2H4v12h12V5zM8 2v4h4V2M8 14V9h4v5" })
				}), saveState === "saving" ? "写入中…" : "写入磁盘"]
			}),
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: genoffice_module_default.btn,
				disabled: busy,
				title: "丢弃未保存编辑，从磁盘重新打开并重新武装控制模式",
				onClick: reloadFromDisk,
				children: [/* @__PURE__ */ jsx("svg", {
					...ROW_ICON_PROPS$1,
					children: /* @__PURE__ */ jsx("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11" })
				}), "从磁盘重载"]
			}),
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: genoffice_module_default.btn,
				style: { marginLeft: "auto" },
				disabled: busy,
				title: BROWSER_OPEN_TITLE,
				onClick: openInBrowser,
				children: [/* @__PURE__ */ jsx("svg", {
					...ROW_ICON_PROPS$1,
					children: /* @__PURE__ */ jsx("path", { d: "M6 3H3.5v9.5H13V10M9 3h4v4M13 3l-6 6" })
				}), "在浏览器中打开"]
			})
		]
	});
	const relayStrip = relayOk === false && /* @__PURE__ */ jsxs("div", {
		className: genoffice_module_default.hint,
		role: "status",
		children: ["GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。", /* @__PURE__ */ jsx("button", {
			type: "button",
			className: genoffice_module_default.btn,
			onClick: () => {
				probe(true);
			},
			children: "重新检查"
		})]
	});
	if (blocked) return /* @__PURE__ */ jsxs("div", {
		className: genoffice_module_default.panel,
		children: [
			toolbar,
			relayStrip,
			/* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				children: "该文档已在另一处打开 — 请先关掉另一侧，避免两个执行器抢注册"
			})
		]
	});
	if (yielded && renderBuiltin !== void 0) return /* @__PURE__ */ jsxs("div", {
		className: genoffice_module_default.panel,
		children: [
			toolbar,
			relayStrip,
			renderBuiltin()
		]
	});
	if (relayOk === null) return /* @__PURE__ */ jsxs("div", {
		className: genoffice_module_default.panel,
		children: [toolbar, /* @__PURE__ */ jsx("div", {
			className: genoffice_module_default.hint,
			children: "正在检查 GenOffice relay…"
		})]
	});
	if (!relayOk) {
		const recheck = /* @__PURE__ */ jsx("button", {
			type: "button",
			className: genoffice_module_default.btn,
			onClick: () => {
				probe(true);
			},
			children: "重新检查"
		});
		if (degradeMode === "auto" && renderBuiltin !== void 0) return /* @__PURE__ */ jsxs("div", {
			className: genoffice_module_default.panel,
			children: [
				toolbar,
				/* @__PURE__ */ jsxs("div", {
					className: genoffice_module_default.hint,
					role: "status",
					children: ["GenOffice relay 不可用 — 已切换内置预览。在仓库执行 `node web/server.mjs` 后可恢复控制模式。", recheck]
				}),
				renderBuiltin()
			]
		});
		return /* @__PURE__ */ jsxs("div", {
			className: genoffice_module_default.panel,
			children: [toolbar, /* @__PURE__ */ jsxs("div", {
				className: genoffice_module_default.hint,
				role: "status",
				children: [
					"GenOffice relay 不可用 — 控制模式需要 localhost:8787 上的中继。启动命令：`node web/server.mjs`",
					renderBuiltin !== void 0 && degradeMode === "manual" && /* @__PURE__ */ jsx("button", {
						type: "button",
						className: genoffice_module_default.btn,
						onClick: () => {
							setYielded(true);
						},
						children: "用内置预览打开"
					}),
					recheck
				]
			})]
		});
	}
	const url = previewUrlFor(path, ext, true, frameNonce);
	return /* @__PURE__ */ jsxs("div", {
		className: genoffice_module_default.panel,
		children: [
			toolbar,
			popupHint && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				children: "弹窗被拦截 — 请允许弹窗后重试"
			}),
			syncing && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				role: "status",
				children: "正在同步…"
			}),
			saveMessage !== null && saveState !== "idle" && !syncing && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				style: { color: saveState === "saved" ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-state-error-primary)" },
				children: saveState === "saving" ? "写入中…" : saveMessage
			}),
			previewError ? /* @__PURE__ */ jsxs("div", {
				className: genoffice_module_default.hint,
				children: ["预览加载失败", /* @__PURE__ */ jsx("button", {
					type: "button",
					className: genoffice_module_default.btn,
					disabled: busy,
					onClick: () => {
						remountControl();
					},
					children: "重试"
				})]
			}) : /* @__PURE__ */ jsx("iframe", {
				ref: iframeRef,
				src: url,
				className: genoffice_module_default.iframe,
				title,
				sandbox: "allow-scripts allow-same-origin allow-downloads",
				onLoad: () => {
					setPreviewLoaded(true);
					setSyncing(false);
				}
			}, frameNonce),
			!previewLoaded && !previewError && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				children: syncing ? "正在同步…" : "预览加载中…"
			}),
			/* @__PURE__ */ jsx(PreviewTimeout, {
				loaded: previewLoaded,
				onTimeout: () => {
					setPreviewError(true);
					setSyncing(false);
				}
			})
		]
	});
}
function PreviewTimeout({ loaded, onTimeout }) {
	useEffect(() => {
		if (loaded) return;
		const timer = window.setTimeout(onTimeout, 1e4);
		return () => {
			window.clearTimeout(timer);
		};
	}, [loaded]);
	return null;
}
//#endregion
//#region src/tabs/genoffice.tsx
/**
* GenOffice tab panel: relay-backed file browser + control-mode preview.
*
* Initial list uses session cwd (empty string = missing → homedir fallback).
* Path bar is a breadcrumb with type-to-jump (BR-008 / BR-009).
*/
function joinPath(a, b) {
	return a.endsWith("/") ? a + b : a + "/" + b;
}
const ROW_ICON_PROPS = {
	...TAB_ICON_PROPS,
	width: 14,
	height: 14
};
function FolderIcon() {
	return /* @__PURE__ */ jsx("svg", {
		...ROW_ICON_PROPS,
		children: /* @__PURE__ */ jsx("path", { d: "M2 4.5h4l1.5 2H14v6.5H2z" })
	});
}
function LinkIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		...ROW_ICON_PROPS,
		children: [/* @__PURE__ */ jsx("path", { d: "M6.5 5.5 10 2a2.4 2.4 0 0 1 3.4 3.4L9.9 9a2.4 2.4 0 0 1-3.4 0" }), /* @__PURE__ */ jsx("path", { d: "M9.5 10.5 6 14a2.4 2.4 0 0 1-3.4-3.4l3.5-3.5a2.4 2.4 0 0 1 3.4 0" })]
	});
}
function FileIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		...ROW_ICON_PROPS,
		children: [/* @__PURE__ */ jsx("path", { d: "M4 2h5l3 3v9H4z" }), /* @__PURE__ */ jsx("path", { d: "M9 2v3h3M6.5 8.5h3M6.5 11h3" })]
	});
}
function sessionCwd(cwd) {
	if (cwd === void 0 || cwd === "") return void 0;
	return cwd;
}
function crumbsOf(abs) {
	if (!abs.startsWith("/")) return [];
	const parts = abs.split("/").filter(Boolean);
	const out = [{
		label: "/",
		path: "/"
	}];
	let acc = "";
	for (const part of parts) {
		acc += `/${part}`;
		out.push({
			label: part,
			path: acc
		});
	}
	return out;
}
function PathBar(props) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(props.path);
	const [expanded, setExpanded] = useState(false);
	const inputRef = useRef(null);
	useEffect(() => {
		if (!editing) setDraft(props.path);
	}, [props.path, editing]);
	useEffect(() => {
		if (!editing) return;
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [editing]);
	const submit = () => {
		const raw = draft.trim();
		if (!raw.startsWith("/")) {
			props.onInvalid("请输入绝对路径（以 / 开头）");
			return;
		}
		props.onJump(raw);
		setEditing(false);
	};
	if (editing) return /* @__PURE__ */ jsx("div", {
		className: genoffice_module_default.pathBar,
		children: /* @__PURE__ */ jsx("input", {
			ref: inputRef,
			className: genoffice_module_default.pathInput,
			value: draft,
			"aria-label": "跳转到路径",
			onChange: (e) => {
				setDraft(e.target.value);
			},
			onKeyDown: (e) => {
				if (e.key === "Enter") submit();
				if (e.key === "Escape") setEditing(false);
			},
			onBlur: () => {
				setEditing(false);
			}
		})
	});
	const all = crumbsOf(props.path);
	const collapsed = !expanded && all.length > 5;
	const first = all[0];
	const shown = collapsed && first !== void 0 ? [
		first,
		{
			label: "…",
			path: ""
		},
		...all.slice(-3)
	] : all;
	return /* @__PURE__ */ jsx("div", {
		className: genoffice_module_default.pathBar,
		title: props.path,
		"aria-label": "当前路径",
		onClick: (e) => {
			if (e.target === e.currentTarget) {
				setDraft(props.path);
				setEditing(true);
			}
		},
		children: shown.map((c, i) => /* @__PURE__ */ jsx("button", {
			type: "button",
			className: genoffice_module_default.crumb,
			title: c.path || "展开完整路径",
			onClick: () => {
				if (c.label === "…") {
					setExpanded(true);
					return;
				}
				props.onJump(c.path);
			},
			children: c.label
		}, `${c.path}:${i}`))
	});
}
function GenOfficePanel(props) {
	const initialPath = props.tab.path;
	const cwd = sessionCwd(props.scope.cwd);
	const [view, setView] = useState({ kind: "list" });
	const [path, setPath] = useState("");
	const [parent, setParent] = useState(void 0);
	const [entries, setEntries] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [pathError, setPathError] = useState(null);
	const [fellHome, setFellHome] = useState(false);
	const [relayOk, setRelayOk] = useState(() => getRelayOk());
	const [occupiedHint, setOccupiedHint] = useState(null);
	const loadSeq = useRef(0);
	const loadList = async (nextPath, asHome = false) => {
		const seq = ++loadSeq.current;
		setLoading(true);
		setError(null);
		setPathError(null);
		try {
			const data = await (await fetch(`${RELAY_BASE}/api/dir?path=${encodeURIComponent(nextPath ?? "")}`)).json();
			if (seq !== loadSeq.current) return;
			if (!data.ok) {
				setPathError(data.error ?? "路径不可读");
				noteRelayOk(false);
			} else {
				setPath(data.path ?? "");
				setParent(data.parent);
				setEntries((data.entries ?? []).filter((e) => !e.hidden));
				setFellHome(asHome || nextPath === void 0 || nextPath === "");
				noteRelayOk(true);
			}
		} catch {
			if (seq !== loadSeq.current) return;
			setError("relay 不可用");
			noteRelayOk(false);
		} finally {
			if (seq === loadSeq.current) setLoading(false);
		}
	};
	const prevRelay = useRef(getRelayOk());
	useEffect(() => {
		return subscribeRelay(() => {
			const ok = getRelayOk();
			const was = prevRelay.current;
			prevRelay.current = ok;
			setRelayOk(ok);
			if (was === false && ok === true && view.kind === "list") loadList(path || cwd, cwd === void 0 && (path === "" || path === void 0));
		});
	}, [
		view.kind,
		path,
		cwd
	]);
	const mounted = useRef(false);
	useEffect(() => {
		if (mounted.current) return;
		mounted.current = true;
		if (initialPath !== void 0 && initialPath !== "") {
			openPreviewByPath(initialPath);
			loadList(cwd, cwd === void 0);
			return;
		}
		loadList(cwd, cwd === void 0);
	}, []);
	const openPreviewByPath = (absPath) => {
		const ext = extOf(absPath);
		if (PREVIEWABLE[ext] === void 0) return;
		const name = absPath.slice(Math.max(absPath.lastIndexOf("/"), absPath.lastIndexOf("\\")) + 1);
		setOccupiedHint(null);
		setView({
			kind: "preview",
			path: absPath,
			name,
			ext
		});
	};
	const pickFile = (entry) => {
		if (entry.dir || entry.symlink) {
			loadList(joinPath(path, entry.name), false);
			return;
		}
		const ext = entry.ext ?? "";
		if (PREVIEWABLE[ext] === void 0) return;
		const abs = joinPath(path, entry.name);
		docIdFor(abs).then((id) => {
			if (lookupActive(id) !== void 0) {
				setOccupiedHint("该文档已在另一处打开");
				return;
			}
			openPreviewByPath(abs);
		});
	};
	if (view.kind === "preview") return /* @__PURE__ */ jsx(ControlModeViewer, {
		path: view.path,
		title: view.name,
		ext: view.ext,
		onBack: () => {
			setView({ kind: "list" });
		}
	}, view.path);
	return /* @__PURE__ */ jsxs("div", {
		className: genoffice_module_default.panel,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: genoffice_module_default.toolbar,
				children: [
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: genoffice_module_default.btn,
						title: "回到主目录",
						onClick: () => {
							loadList(void 0, true);
						},
						children: [/* @__PURE__ */ jsx("svg", {
							...ROW_ICON_PROPS,
							children: /* @__PURE__ */ jsx("path", { d: "M2.5 7.5 8 2.5l5.5 5M4 6.5V14h8V6.5" })
						}), "主目录"]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: genoffice_module_default.btn,
						disabled: cwd === void 0,
						title: cwd === void 0 ? "当前会话没有项目目录" : "回到会话项目根",
						onClick: () => {
							if (cwd !== void 0) loadList(cwd, false);
						},
						children: "项目根"
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: genoffice_module_default.btn,
						disabled: parent === void 0,
						title: "上级目录",
						onClick: () => {
							if (parent !== void 0) loadList(parent, false);
						},
						children: [/* @__PURE__ */ jsx("svg", {
							...ROW_ICON_PROPS,
							children: /* @__PURE__ */ jsx("path", { d: "M8 13V3M4.5 6.5 8 3l3.5 3.5" })
						}), "上级"]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: genoffice_module_default.btn,
						title: "重新加载当前目录",
						onClick: () => {
							loadList(path, fellHome);
						},
						children: [/* @__PURE__ */ jsx("svg", {
							...ROW_ICON_PROPS,
							children: /* @__PURE__ */ jsx("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11" })
						}), "刷新"]
					}),
					/* @__PURE__ */ jsx(PathBar, {
						path,
						onJump: (abs) => {
							loadList(abs, false);
						},
						onInvalid: (msg) => {
							setPathError(msg);
						}
					}),
					fellHome && /* @__PURE__ */ jsx("span", {
						className: genoffice_module_default.homeNote,
						children: "已回落到主目录"
					})
				]
			}),
			relayOk === false && /* @__PURE__ */ jsxs("div", {
				className: genoffice_module_default.hint,
				role: "status",
				children: ["GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。", /* @__PURE__ */ jsx("button", {
					type: "button",
					className: genoffice_module_default.btn,
					onClick: () => {
						probeRelay(true);
					},
					children: "重新检查"
				})]
			}),
			loading && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				children: "加载中…"
			}),
			!loading && occupiedHint !== null && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				children: occupiedHint
			}),
			!loading && pathError !== null && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				children: pathError
			}),
			!loading && error !== null && /* @__PURE__ */ jsxs("div", {
				className: genoffice_module_default.hint,
				children: [error, /* @__PURE__ */ jsx("button", {
					type: "button",
					className: genoffice_module_default.btn,
					onClick: () => {
						loadList(path || cwd, fellHome);
					},
					children: "重试"
				})]
			}),
			!loading && error === null && entries !== null && entries.length === 0 && pathError === null && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.hint,
				children: "空目录"
			}),
			!loading && error === null && entries !== null && /* @__PURE__ */ jsx("div", {
				className: genoffice_module_default.list,
				children: entries.map((entry) => {
					const previewable = !entry.dir && !entry.symlink && PREVIEWABLE[entry.ext ?? ""] !== void 0;
					const clickable = entry.dir || entry.symlink || previewable;
					return /* @__PURE__ */ jsxs("div", {
						className: `${genoffice_module_default.row} ${clickable ? genoffice_module_default.rowClickable : genoffice_module_default.rowDisabled}`,
						title: entry.dir ? "进入目录" : entry.symlink ? "符号链接（可能指向目录）" : previewable ? "点击预览" : "仅桌面版可用",
						onClick: () => {
							pickFile(entry);
						},
						children: [
							/* @__PURE__ */ jsx("span", {
								className: genoffice_module_default.rowIcon,
								children: entry.dir ? /* @__PURE__ */ jsx(FolderIcon, {}) : entry.symlink ? /* @__PURE__ */ jsx(LinkIcon, {}) : /* @__PURE__ */ jsx(FileIcon, {})
							}),
							/* @__PURE__ */ jsx("span", {
								className: genoffice_module_default.rowName,
								children: entry.name
							}),
							!entry.dir && !previewable && !entry.symlink && /* @__PURE__ */ jsx("span", {
								className: genoffice_module_default.rowTag,
								children: "仅桌面版可用"
							})
						]
					}, entry.name);
				})
			})
		]
	});
}
//#endregion
//#region src/tabs/docx-control-viewer.tsx
/**
* FileViewer adapter: FileViewerProps → ControlModeViewer. One component
* covers every claimed extension; ext is derived from the path.
*/
function DocxControlViewer(props) {
	const ext = extOf(props.path);
	return /* @__PURE__ */ jsx(ControlModeViewer, {
		path: props.path,
		title: props.title,
		ext,
		renderBuiltin: () => {
			const upstreamId = UPSTREAM_VIEWER_ID[ext];
			const builtin = props.ctx.betterSidebar.getFileViewers().find((v) => v.id === upstreamId);
			if (builtin === void 0) return createElement("div", { className: genoffice_module_default.hint }, "内置预览不可用");
			return createElement(builtin.component, props);
		}
	});
}
//#endregion
//#region src/tabs/locales.ts
/**
* `tabs.genoffice` namespace dictionaries: the GenOffice tab's own copy.
* Each tab artifact owns its namespace — the sidebar core never holds other
* tabs' copy.
*/
/** Simplified Chinese dictionary (the key-set source of truth). */
const zh = { "tab.genoffice": "GenOffice" };
/** English dictionary, checked complete against the zh key set. */
const en = { "tab.genoffice": "GenOffice" };
/** Dictionary namespace owned by the genoffice tab artifact. */
const NS = "tabs.genoffice";
//#endregion
//#region src/client/index.ts
/**
* Client half of the GenOffice tab artifact: registers the file-browser tab
* and control-mode FileViewers (docx / xlsx / pptx) on `ctx.betterSidebar`. When the
* upstream service is absent the plugin still loads and skips registration
* (BR-003) — betterSidebar is requested via `ctx.inject` so a missing
* service never fail-louds the whole DSH tree.
*/
/** Locale is required; betterSidebar is awaited inside apply so its absence
*  skips registration instead of leaving this fiber PENDING (BR-003). */
const inject = ["locale"];
/**
* Register the GenOffice tab and claimed FileViewers when better-sidebar is present.
* @param ctx - client root context.
*/
function apply(ctx) {
	const t = ctx.locale.bind(NS);
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "dsh-tab-genoffice: dictionaries");
	ctx.inject(["betterSidebar"], (raw) => {
		const sidebarCtx = raw;
		const { betterSidebar } = sidebarCtx;
		sidebarCtx.effect(() => betterSidebar.registerTab({
			id: "dsh-artifact:genoffice",
			title: () => t("tab.genoffice"),
			icon: (size) => createElement(GenOfficeIcon, { size }),
			order: 20,
			single: true,
			component: (props) => createElement(GenOfficePanel, props)
		}), "dsh-tab-genoffice: registerTab");
		for (const ext of CLAIMED_EXTS) sidebarCtx.effect(() => betterSidebar.registerFileViewer({
			id: `dsh-artifact:genoffice-${ext}`,
			title: () => `GenOffice · .${ext}`,
			icon: (size) => createElement(GenOfficeIcon, { size }),
			exts: [ext],
			priority: 10,
			fetchStrategy: "none",
			component: DocxControlViewer
		}), `dsh-tab-genoffice: registerFileViewer:${ext}`);
	});
}
//#endregion
export { apply, inject };
