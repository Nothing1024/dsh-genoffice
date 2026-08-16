"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenOfficePanel = GenOfficePanel;
/**
 * GenOffice tab panel: relay-backed file browser + control-mode preview.
 *
 * Initial list uses session cwd (empty string = missing → homedir fallback).
 * Path bar is a breadcrumb with type-to-jump (BR-008 / BR-009).
 */
var react_1 = require("react");
var icon_tsx_1 = require("./icon.tsx");
var relay_ts_1 = require("./relay.ts");
var control_mode_tsx_1 = require("./control-mode.tsx");
var doc_registry_ts_1 = require("./doc-registry.ts");
var genoffice_module_css_1 = require("./genoffice.module.css");
function joinPath(a, b) {
    return a.endsWith('/') ? a + b : a + '/' + b;
}
var ROW_ICON_PROPS = __assign(__assign({}, icon_tsx_1.TAB_ICON_PROPS), { width: 14, height: 14 });
function FolderIcon() {
    return (<svg {...ROW_ICON_PROPS}>
      <path d="M2 4.5h4l1.5 2H14v6.5H2z"/>
    </svg>);
}
function LinkIcon() {
    return (<svg {...ROW_ICON_PROPS}>
      <path d="M6.5 5.5 10 2a2.4 2.4 0 0 1 3.4 3.4L9.9 9a2.4 2.4 0 0 1-3.4 0"/>
      <path d="M9.5 10.5 6 14a2.4 2.4 0 0 1-3.4-3.4l3.5-3.5a2.4 2.4 0 0 1 3.4 0"/>
    </svg>);
}
function FileIcon() {
    return (<svg {...ROW_ICON_PROPS}>
      <path d="M4 2h5l3 3v9H4z"/>
      <path d="M9 2v3h3M6.5 8.5h3M6.5 11h3"/>
    </svg>);
}
function sessionCwd(cwd) {
    if (cwd === undefined || cwd === '')
        return undefined;
    return cwd;
}
function crumbsOf(abs) {
    if (!abs.startsWith('/'))
        return [];
    var parts = abs.split('/').filter(Boolean);
    var out = [{ label: '/', path: '/' }];
    var acc = '';
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        acc += "/".concat(part);
        out.push({ label: part, path: acc });
    }
    return out;
}
function PathBar(props) {
    var _a = (0, react_1.useState)(false), editing = _a[0], setEditing = _a[1];
    var _b = (0, react_1.useState)(props.path), draft = _b[0], setDraft = _b[1];
    var _c = (0, react_1.useState)(false), expanded = _c[0], setExpanded = _c[1];
    var inputRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        if (!editing)
            setDraft(props.path);
    }, [props.path, editing]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (!editing)
            return;
        (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        (_b = inputRef.current) === null || _b === void 0 ? void 0 : _b.select();
    }, [editing]);
    var submit = function () {
        var raw = draft.trim();
        if (!raw.startsWith('/')) {
            props.onInvalid('请输入绝对路径（以 / 开头）');
            return;
        }
        props.onJump(raw);
        setEditing(false);
    };
    if (editing) {
        return (<div className={genoffice_module_css_1.default.pathBar}>
        <input ref={inputRef} className={genoffice_module_css_1.default.pathInput} value={draft} aria-label="跳转到路径" onChange={function (e) { setDraft(e.target.value); }} onKeyDown={function (e) {
                if (e.key === 'Enter')
                    submit();
                if (e.key === 'Escape')
                    setEditing(false);
            }} onBlur={function () { setEditing(false); }}/>
      </div>);
    }
    var all = crumbsOf(props.path);
    var collapsed = !expanded && all.length > 5;
    var first = all[0];
    var shown = collapsed && first !== undefined
        ? __spreadArray([first, { label: '…', path: '' }], all.slice(-3), true) : all;
    return (<div className={genoffice_module_css_1.default.pathBar} title={props.path} aria-label="当前路径" onClick={function (e) {
            if (e.target === e.currentTarget) {
                setDraft(props.path);
                setEditing(true);
            }
        }}>
      {shown.map(function (c, i) { return (<button key={"".concat(c.path, ":").concat(i)} type="button" className={genoffice_module_css_1.default.crumb} title={c.path || '展开完整路径'} onClick={function () {
                if (c.label === '…') {
                    setExpanded(true);
                    return;
                }
                props.onJump(c.path);
            }}>
          {c.label}
        </button>); })}
    </div>);
}
function GenOfficePanel(props) {
    var _this = this;
    var initialPath = props.tab.path;
    var cwd = sessionCwd(props.scope.cwd);
    var _a = (0, react_1.useState)({ kind: 'list' }), view = _a[0], setView = _a[1];
    var _b = (0, react_1.useState)(''), path = _b[0], setPath = _b[1];
    var _c = (0, react_1.useState)(undefined), parent = _c[0], setParent = _c[1];
    var _d = (0, react_1.useState)(null), entries = _d[0], setEntries = _d[1];
    var _e = (0, react_1.useState)(false), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)(null), error = _f[0], setError = _f[1];
    var _g = (0, react_1.useState)(null), pathError = _g[0], setPathError = _g[1];
    var _h = (0, react_1.useState)(false), fellHome = _h[0], setFellHome = _h[1];
    var _j = (0, react_1.useState)(function () { return (0, relay_ts_1.getRelayOk)(); }), relayOk = _j[0], setRelayOk = _j[1];
    var _k = (0, react_1.useState)(null), occupiedHint = _k[0], setOccupiedHint = _k[1];
    var loadSeq = (0, react_1.useRef)(0);
    var loadList = function (nextPath_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([nextPath_1], args_1, true), void 0, function (nextPath, asHome) {
            var seq, resp, data, _a;
            var _b, _c, _d;
            if (asHome === void 0) { asHome = false; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        seq = ++loadSeq.current;
                        setLoading(true);
                        setError(null);
                        setPathError(null);
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 4, 5, 6]);
                        return [4 /*yield*/, fetch("".concat(relay_ts_1.RELAY_BASE, "/api/dir?path=").concat(encodeURIComponent(nextPath !== null && nextPath !== void 0 ? nextPath : '')))];
                    case 2:
                        resp = _e.sent();
                        return [4 /*yield*/, resp.json()];
                    case 3:
                        data = (_e.sent());
                        if (seq !== loadSeq.current)
                            return [2 /*return*/];
                        if (!data.ok) {
                            setPathError((_b = data.error) !== null && _b !== void 0 ? _b : '路径不可读');
                            (0, relay_ts_1.noteRelayOk)(false);
                        }
                        else {
                            setPath((_c = data.path) !== null && _c !== void 0 ? _c : '');
                            setParent(data.parent);
                            setEntries(((_d = data.entries) !== null && _d !== void 0 ? _d : []).filter(function (e) { return !e.hidden; }));
                            setFellHome(asHome || nextPath === undefined || nextPath === '');
                            (0, relay_ts_1.noteRelayOk)(true);
                        }
                        return [3 /*break*/, 6];
                    case 4:
                        _a = _e.sent();
                        if (seq !== loadSeq.current)
                            return [2 /*return*/];
                        setError('relay 不可用');
                        (0, relay_ts_1.noteRelayOk)(false);
                        return [3 /*break*/, 6];
                    case 5:
                        if (seq === loadSeq.current)
                            setLoading(false);
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    var prevRelay = (0, react_1.useRef)((0, relay_ts_1.getRelayOk)());
    (0, react_1.useEffect)(function () {
        return (0, relay_ts_1.subscribeRelay)(function () {
            var ok = (0, relay_ts_1.getRelayOk)();
            var was = prevRelay.current;
            prevRelay.current = ok;
            setRelayOk(ok);
            if (was === false && ok === true && view.kind === 'list') {
                void loadList(path || cwd, cwd === undefined && (path === '' || path === undefined));
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view.kind, path, cwd]);
    var mounted = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(function () {
        if (mounted.current)
            return;
        mounted.current = true;
        if (initialPath !== undefined && initialPath !== '') {
            openPreviewByPath(initialPath);
            void loadList(cwd, cwd === undefined);
            return;
        }
        void loadList(cwd, cwd === undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
    }, []);
    var openPreviewByPath = function (absPath) {
        var ext = (0, relay_ts_1.extOf)(absPath);
        var app = relay_ts_1.PREVIEWABLE[ext];
        if (app === undefined)
            return;
        var name = absPath.slice(Math.max(absPath.lastIndexOf('/'), absPath.lastIndexOf('\\')) + 1);
        setOccupiedHint(null);
        setView({ kind: 'preview', path: absPath, name: name, ext: ext });
    };
    var pickFile = function (entry) {
        var _a;
        if (entry.dir || entry.symlink) {
            void loadList(joinPath(path, entry.name), false);
            return;
        }
        var ext = (_a = entry.ext) !== null && _a !== void 0 ? _a : '';
        if (relay_ts_1.PREVIEWABLE[ext] === undefined)
            return;
        var abs = joinPath(path, entry.name);
        void (0, relay_ts_1.docIdFor)(abs).then(function (id) {
            if ((0, doc_registry_ts_1.lookupActive)(id) !== undefined) {
                setOccupiedHint('该文档已在另一处打开');
                return;
            }
            openPreviewByPath(abs);
        });
    };
    if (view.kind === 'preview') {
        return (<control_mode_tsx_1.ControlModeViewer key={view.path} path={view.path} title={view.name} ext={view.ext} onBack={function () { setView({ kind: 'list' }); }}/>);
    }
    return (<div className={genoffice_module_css_1.default.panel}>
      <div className={genoffice_module_css_1.default.toolbar}>
        <button type="button" className={genoffice_module_css_1.default.btn} title="回到主目录" onClick={function () { void loadList(undefined, true); }}>
          <svg {...ROW_ICON_PROPS}><path d="M2.5 7.5 8 2.5l5.5 5M4 6.5V14h8V6.5"/></svg>
          主目录
        </button>
        <button type="button" className={genoffice_module_css_1.default.btn} disabled={cwd === undefined} title={cwd === undefined ? '当前会话没有项目目录' : '回到会话项目根'} onClick={function () { if (cwd !== undefined)
        void loadList(cwd, false); }}>
          项目根
        </button>
        <button type="button" className={genoffice_module_css_1.default.btn} disabled={parent === undefined} title="上级目录" onClick={function () { if (parent !== undefined)
        void loadList(parent, false); }}>
          <svg {...ROW_ICON_PROPS}><path d="M8 13V3M4.5 6.5 8 3l3.5 3.5"/></svg>
          上级
        </button>
        <button type="button" className={genoffice_module_css_1.default.btn} title="重新加载当前目录" onClick={function () { void loadList(path, fellHome); }}>
          <svg {...ROW_ICON_PROPS}><path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11"/></svg>
          刷新
        </button>
        <PathBar path={path} onJump={function (abs) { void loadList(abs, false); }} onInvalid={function (msg) { setPathError(msg); }}/>
        {fellHome && <span className={genoffice_module_css_1.default.homeNote}>已回落到主目录</span>}
      </div>
      {relayOk === false && (<div className={genoffice_module_css_1.default.hint} role="status">
          GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。
          <button type="button" className={genoffice_module_css_1.default.btn} onClick={function () { void (0, relay_ts_1.probeRelay)(true); }}>重新检查</button>
        </div>)}
      {loading && <div className={genoffice_module_css_1.default.hint}>加载中…</div>}
      {!loading && occupiedHint !== null && (<div className={genoffice_module_css_1.default.hint}>{occupiedHint}</div>)}
      {!loading && pathError !== null && (<div className={genoffice_module_css_1.default.hint}>{pathError}</div>)}
      {!loading && error !== null && (<div className={genoffice_module_css_1.default.hint}>
          {error}
          <button type="button" className={genoffice_module_css_1.default.btn} onClick={function () { void loadList(path || cwd, fellHome); }}>重试</button>
        </div>)}
      {!loading && error === null && entries !== null && entries.length === 0 && pathError === null && (<div className={genoffice_module_css_1.default.hint}>空目录</div>)}
      {!loading && error === null && entries !== null && (<div className={genoffice_module_css_1.default.list}>
          {entries.map(function (entry) {
                var _a;
                var previewable = !entry.dir && !entry.symlink && relay_ts_1.PREVIEWABLE[(_a = entry.ext) !== null && _a !== void 0 ? _a : ''] !== undefined;
                var clickable = entry.dir || entry.symlink || previewable;
                return (<div key={entry.name} className={"".concat(genoffice_module_css_1.default.row, " ").concat(clickable ? genoffice_module_css_1.default.rowClickable : genoffice_module_css_1.default.rowDisabled)} title={entry.dir ? '进入目录' : entry.symlink ? '符号链接（可能指向目录）' : previewable ? '点击预览' : '仅桌面版可用'} onClick={function () { pickFile(entry); }}>
                <span className={genoffice_module_css_1.default.rowIcon}>
                  {entry.dir ? <FolderIcon /> : entry.symlink ? <LinkIcon /> : <FileIcon />}
                </span>
                <span className={genoffice_module_css_1.default.rowName}>{entry.name}</span>
                {!entry.dir && !previewable && !entry.symlink && <span className={genoffice_module_css_1.default.rowTag}>仅桌面版可用</span>}
              </div>);
            })}
        </div>)}
    </div>);
}
