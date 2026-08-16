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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlModeViewer = ControlModeViewer;
/**
 * The single control-mode surface: health probe, iframe, toolbar (save /
 * reload-from-disk / browser-open / back), and relay-down degrade.
 */
var react_1 = require("react");
var icon_tsx_1 = require("./icon.tsx");
var coexist_ts_1 = require("./coexist.ts");
var doc_registry_ts_1 = require("./doc-registry.ts");
var relay_ts_1 = require("./relay.ts");
var genoffice_module_css_1 = require("./genoffice.module.css");
var ROW_ICON_PROPS = __assign(__assign({}, icon_tsx_1.TAB_ICON_PROPS), { width: 14, height: 14 });
var BROWSER_OPEN_TITLE = '离开控制模式；网页版 AI 面板可直连第三方模型服务商，可能出网';
function ControlModeViewer(props) {
    var _this = this;
    var _a;
    var path = props.path, title = props.title, ext = props.ext, onBack = props.onBack, renderBuiltin = props.renderBuiltin;
    var degradeMode = (_a = props.degradeMode) !== null && _a !== void 0 ? _a : coexist_ts_1.DEGRADE_MODE;
    var _b = (0, react_1.useState)(function () { return (0, relay_ts_1.getRelayOk)(); }), relayOk = _b[0], setRelayOk = _b[1];
    var _c = (0, react_1.useState)(false), yielded = _c[0], setYielded = _c[1];
    var _d = (0, react_1.useState)(false), blocked = _d[0], setBlocked = _d[1];
    var _e = (0, react_1.useState)(false), previewLoaded = _e[0], setPreviewLoaded = _e[1];
    var _f = (0, react_1.useState)(false), previewError = _f[0], setPreviewError = _f[1];
    var _g = (0, react_1.useState)(function () { return crypto.randomUUID(); }), frameNonce = _g[0], setFrameNonce = _g[1];
    var _h = (0, react_1.useState)(false), syncing = _h[0], setSyncing = _h[1];
    var _j = (0, react_1.useState)(false), popupHint = _j[0], setPopupHint = _j[1];
    var _k = (0, react_1.useState)('idle'), saveState = _k[0], setSaveState = _k[1];
    var _l = (0, react_1.useState)(null), saveMessage = _l[0], setSaveMessage = _l[1];
    var iframeRef = (0, react_1.useRef)(null);
    var probeSeq = (0, react_1.useRef)(0);
    var busy = saveState === 'saving' || syncing;
    var unloadPreview = function () {
        var prev = iframeRef.current;
        if (prev !== null)
            prev.src = 'about:blank';
    };
    var remountControl = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSyncing(true);
                    setPreviewLoaded(false);
                    setPreviewError(false);
                    return [4 /*yield*/, (0, relay_ts_1.notifyHostSync)(path)];
                case 1:
                    _a.sent();
                    setFrameNonce(crypto.randomUUID());
                    return [2 /*return*/];
            }
        });
    }); };
    var probe = function (force) {
        if (force === void 0) { force = true; }
        var seq = ++probeSeq.current;
        setRelayOk(null);
        setYielded(false);
        var ac = new AbortController();
        void (0, relay_ts_1.probeRelay)(force, ac.signal).then(function (ok) {
            if (seq !== probeSeq.current)
                return;
            setRelayOk(ok);
        });
    };
    (0, react_1.useEffect)(function () {
        return (0, relay_ts_1.subscribeRelay)(function () { setRelayOk((0, relay_ts_1.getRelayOk)()); });
    }, []);
    (0, react_1.useEffect)(function () {
        probe(false);
        return function () {
            probeSeq.current += 1;
            unloadPreview();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- remount per path via key
    }, [path]);
    (0, react_1.useEffect)(function () {
        var cancelled = false;
        var unregister;
        var tryClaim = function () {
            void (0, relay_ts_1.docIdFor)(path).then(function (id) {
                if (cancelled)
                    return;
                if (unregister !== undefined)
                    return;
                if ((0, doc_registry_ts_1.lookupActive)(id) !== undefined) {
                    setBlocked(true);
                    return;
                }
                setBlocked(false);
                unregister = (0, doc_registry_ts_1.registerActive)(id, { surface: onBack === undefined ? 'viewer' : 'tab' });
            });
        };
        tryClaim();
        var stop = (0, doc_registry_ts_1.subscribeActive)(tryClaim);
        return function () {
            cancelled = true;
            stop();
            unregister === null || unregister === void 0 ? void 0 : unregister();
        };
    }, [path, onBack]);
    (0, react_1.useEffect)(function () {
        if (saveState !== 'saved')
            return;
        var timer = window.setTimeout(function () {
            setSaveState('idle');
            setSaveMessage(null);
        }, 4000);
        return function () { window.clearTimeout(timer); };
    }, [saveState]);
    var saveToDisk = function () { return __awaiter(_this, void 0, void 0, function () {
        var app, docId, resp, data, e_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (busy)
                        return [2 /*return*/];
                    app = relay_ts_1.PREVIEWABLE[ext];
                    if (app === undefined)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, relay_ts_1.docIdFor)(path)];
                case 1:
                    docId = _c.sent();
                    setSaveState('saving');
                    setSaveMessage(null);
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 8, , 9]);
                    return [4 /*yield*/, fetch("".concat(relay_ts_1.RELAY_BASE, "/api/control/").concat(app, "/").concat(docId, "/export"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: path }),
                        })];
                case 3:
                    resp = _c.sent();
                    return [4 /*yield*/, resp.json()];
                case 4:
                    data = (_c.sent());
                    if (!data.ok) return [3 /*break*/, 6];
                    setSaveState('saved');
                    setSaveMessage("\u5DF2\u4FDD\u5B58\u5230 ".concat((_a = data.path) !== null && _a !== void 0 ? _a : path));
                    return [4 /*yield*/, remountControl()];
                case 5:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 6:
                    if (data.error === 'conflict') {
                        setSaveState('conflict');
                        setSaveMessage('文件已被外部修改，未覆盖 — 请点「从磁盘重载」后再保存');
                    }
                    else if (data.error === 'executor not registered') {
                        setSaveState('error');
                        setSaveMessage('文档未在控制模式打开（执行器未注册）— 请重新打开预览');
                    }
                    else {
                        setSaveState('error');
                        setSaveMessage("\u5199\u5165\u5931\u8D25\uFF1A".concat((_b = data.error) !== null && _b !== void 0 ? _b : '未知错误'));
                    }
                    _c.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    e_1 = _c.sent();
                    setSaveState('error');
                    setSaveMessage("\u5199\u5165\u5931\u8D25\uFF1A".concat(e_1 instanceof Error ? e_1.message : String(e_1)));
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var reloadFromDisk = function () {
        if (busy)
            return;
        if (!window.confirm('从磁盘重新加载？未保存的编辑会丢失。'))
            return;
        void remountControl();
    };
    var openInBrowser = function () {
        var win = window.open((0, relay_ts_1.previewUrlFor)(path, ext, false), '_blank', 'noopener');
        if (win === null)
            setPopupHint(true);
    };
    var goBack = function () {
        unloadPreview();
        onBack === null || onBack === void 0 ? void 0 : onBack();
    };
    var toolbar = (<div className={genoffice_module_css_1.default.toolbar}>
      {onBack !== undefined && (<button type="button" className={genoffice_module_css_1.default.btn} disabled={busy} onClick={goBack}>
          <svg {...ROW_ICON_PROPS}><path d="M10.5 3.5 6 8l4.5 4.5"/></svg>
          返回
        </button>)}
      <span className={genoffice_module_css_1.default.fileName} title={path}>{title}</span>
      <button type="button" className={genoffice_module_css_1.default.btn} disabled={busy} title="将当前编辑内容原子写回原文件" onClick={function () { void saveToDisk(); }}>
        <svg {...ROW_ICON_PROPS}><path d="M11 2H4v12h12V5zM8 2v4h4V2M8 14V9h4v5"/></svg>
        {saveState === 'saving' ? '写入中…' : '写入磁盘'}
      </button>
      <button type="button" className={genoffice_module_css_1.default.btn} disabled={busy} title="丢弃未保存编辑，从磁盘重新打开并重新武装控制模式" onClick={reloadFromDisk}>
        <svg {...ROW_ICON_PROPS}><path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11"/></svg>
        从磁盘重载
      </button>
      <button type="button" className={genoffice_module_css_1.default.btn} style={{ marginLeft: 'auto' }} disabled={busy} title={BROWSER_OPEN_TITLE} onClick={openInBrowser}>
        <svg {...ROW_ICON_PROPS}><path d="M6 3H3.5v9.5H13V10M9 3h4v4M13 3l-6 6"/></svg>
        在浏览器中打开
      </button>
    </div>);
    var relayStrip = relayOk === false && (<div className={genoffice_module_css_1.default.hint} role="status">
      GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。
      <button type="button" className={genoffice_module_css_1.default.btn} onClick={function () { probe(true); }}>重新检查</button>
    </div>);
    if (blocked) {
        return (<div className={genoffice_module_css_1.default.panel}>
        {toolbar}
        {relayStrip}
        <div className={genoffice_module_css_1.default.hint}>该文档已在另一处打开 — 请先关掉另一侧，避免两个执行器抢注册</div>
      </div>);
    }
    if (yielded && renderBuiltin !== undefined) {
        return (<div className={genoffice_module_css_1.default.panel}>
        {toolbar}
        {relayStrip}
        {renderBuiltin()}
      </div>);
    }
    if (relayOk === null) {
        return (<div className={genoffice_module_css_1.default.panel}>
        {toolbar}
        <div className={genoffice_module_css_1.default.hint}>正在检查 GenOffice relay…</div>
      </div>);
    }
    if (!relayOk) {
        var recheck = (<button type="button" className={genoffice_module_css_1.default.btn} onClick={function () { probe(true); }}>重新检查</button>);
        if (degradeMode === 'auto' && renderBuiltin !== undefined) {
            return (<div className={genoffice_module_css_1.default.panel}>
          {toolbar}
          <div className={genoffice_module_css_1.default.hint} role="status">
            GenOffice relay 不可用 — 已切换内置预览。在仓库执行 `node web/server.mjs` 后可恢复控制模式。
            {recheck}
          </div>
          {renderBuiltin()}
        </div>);
        }
        return (<div className={genoffice_module_css_1.default.panel}>
        {toolbar}
        <div className={genoffice_module_css_1.default.hint} role="status">
          GenOffice relay 不可用 — 控制模式需要 localhost:8787 上的中继。启动命令：`node web/server.mjs`
          {renderBuiltin !== undefined && degradeMode === 'manual' && (<button type="button" className={genoffice_module_css_1.default.btn} onClick={function () { setYielded(true); }}>
              用内置预览打开
            </button>)}
          {recheck}
        </div>
      </div>);
    }
    var url = (0, relay_ts_1.previewUrlFor)(path, ext, true, frameNonce);
    return (<div className={genoffice_module_css_1.default.panel}>
      {toolbar}
      {popupHint && <div className={genoffice_module_css_1.default.hint}>弹窗被拦截 — 请允许弹窗后重试</div>}
      {syncing && <div className={genoffice_module_css_1.default.hint} role="status">正在同步…</div>}
      {saveMessage !== null && saveState !== 'idle' && !syncing && (<div className={genoffice_module_css_1.default.hint} style={{ color: saveState === 'saved' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' }}>
          {saveState === 'saving' ? '写入中…' : saveMessage}
        </div>)}
      {previewError
            ? (<div className={genoffice_module_css_1.default.hint}>
            预览加载失败
            <button type="button" className={genoffice_module_css_1.default.btn} disabled={busy} onClick={function () { void remountControl(); }}>重试</button>
          </div>)
            : (<iframe key={frameNonce} ref={iframeRef} src={url} className={genoffice_module_css_1.default.iframe} title={title} sandbox="allow-scripts allow-same-origin allow-downloads" onLoad={function () {
                    setPreviewLoaded(true);
                    setSyncing(false);
                }}/>)}
      {!previewLoaded && !previewError && <div className={genoffice_module_css_1.default.hint}>{syncing ? '正在同步…' : '预览加载中…'}</div>}
      <PreviewTimeout loaded={previewLoaded} onTimeout={function () { setPreviewError(true); setSyncing(false); }}/>
    </div>);
}
function PreviewTimeout(_a) {
    var loaded = _a.loaded, onTimeout = _a.onTimeout;
    (0, react_1.useEffect)(function () {
        if (loaded)
            return;
        var timer = window.setTimeout(onTimeout, 10000);
        return function () { window.clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- arm once per preview
    }, [loaded]);
    return null;
}
