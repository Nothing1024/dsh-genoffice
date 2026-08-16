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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.createControlTools = createControlTools;
exports.registeredToolNames = registeredToolNames;
/**
 * Host tools: GenOffice control plane via relay POST /api/control/<app>/<docId>/…
 *
 * Registration is filtered by CAPABILITY (BR-001 / BR-015). The table still
 * lists all 81 entries; DSH_GENOFFICE_ALL_TOOLS=1 re-opens the filter.
 * Write-back only through *_save and the tab button (BR-011).
 */
var dsh_tools_1 = require("@deepseek-ai/dsh-tools");
var capability_ts_1 = require("./capability.ts");
var errors_ts_1 = require("./errors.ts");
var sync_ts_1 = require("./sync.ts");
var tool_schema_ts_1 = require("./tool-schema.ts");
var RELAY_BASE = 'http://localhost:8787';
var CONTROL_TIMEOUT_MS = 70000;
function sha256Hex(s) {
    return __awaiter(this, void 0, void 0, function () {
        var digest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))];
                case 1:
                    digest = _a.sent();
                    return [2 /*return*/, __spreadArray([], new Uint8Array(digest), true).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('')];
            }
        });
    });
}
function describeEntry(entry, cap, allTools) {
    var d = entry.description;
    if (cap === undefined)
        return d;
    if (allTools && cap.netEgress)
        d = "\u3010\u4F1A\u5411\u516C\u7F51\u53D1\u8D77\u8BF7\u6C42\u3011".concat(d);
    if (allTools && cap.handover === 'dsh:web_search')
        d = "\u3010\u5DF2\u4EA4\u8FD8 DSH\uFF0C\u8BF7\u6539\u7528 web_search\u3011".concat(d);
    if (allTools && cap.handover === 'dsh:pending')
        d = "\u3010\u5DF2\u5212\u5F52 DSH \u4FA7\uFF0C\u672C\u5305\u4E0D\u63D0\u4F9B\u3011".concat(d);
    if (cap.status === 'partial')
        d = "\u3010\u90E8\u5206\u53EF\u7528\u3011".concat(d);
    if (cap.status === 'guarded') {
        d = "\u3010\u4E0A\u6E38\u5B88\u536B\u3011\u7A7A\u767D\u6216\u5143\u7D20\u8FC7\u5C11\u7684 deck \u4E0A\u4F1A\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u6539\u5199\u5DF2\u6709\u9875\u9762\u3002".concat(d);
    }
    return d;
}
function shouldRegister(entry, opts) {
    if (opts.allTools)
        return true;
    var cap = (0, capability_ts_1.capabilityOf)(entry.app, entry.skillName);
    if (cap === undefined || !(0, capability_ts_1.isExposed)(cap))
        return false;
    if (entry.name === 'docx_insert_image' && !opts.assetsAvailable)
        return false;
    return true;
}
function fail(error, path, kind) {
    var input = { error: error };
    if (path !== undefined)
        input.path = path;
    if (kind !== undefined)
        input.kind = kind;
    throw new Error((0, errors_ts_1.classifyControlError)(input).message);
}
function callRelay(entry, input, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var path, docId, _strip, skillInput, resp, e_1, text, data, execution;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    path = String((_a = input.path) !== null && _a !== void 0 ? _a : '');
                    if (!path.startsWith('/'))
                        fail('path 必须是目标文件的本机绝对路径', path, 'local');
                    if ((0, sync_ts_1.isInSyncWindow)(path))
                        fail('sync window', path, 'sync');
                    return [4 /*yield*/, sha256Hex(path)];
                case 1:
                    docId = _g.sent();
                    _strip = input.path, skillInput = __rest(input, ["path"]);
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, fetch("".concat(RELAY_BASE, "/api/control/").concat(entry.app, "/").concat(docId, "/tool"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: signal,
                            body: JSON.stringify({ call: { id: crypto.randomUUID(), name: entry.skillName, input: skillInput } }),
                        })];
                case 3:
                    resp = _g.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _g.sent();
                    fail(e_1 instanceof Error ? e_1.message : String(e_1), path, 'fetch');
                    return [3 /*break*/, 5];
                case 5:
                    if (!!resp.ok) return [3 /*break*/, 7];
                    return [4 /*yield*/, resp.text().catch(function () { return ''; })];
                case 6:
                    text = _g.sent();
                    fail("relay \u8FD4\u56DE HTTP ".concat(resp.status).concat(text ? ": ".concat(text) : ''), path, 'fetch');
                    _g.label = 7;
                case 7: return [4 /*yield*/, resp.json()];
                case 8:
                    data = (_g.sent());
                    if (!data.ok)
                        fail(String((_b = data.error) !== null && _b !== void 0 ? _b : 'unknown error'), path, 'relay');
                    execution = (_c = data.execution) !== null && _c !== void 0 ? _c : {};
                    if (execution.isError) {
                        fail(String((_d = execution.output) !== null && _d !== void 0 ? _d : 'executor error'), path, 'executor');
                    }
                    return [2 /*return*/, {
                            ok: true,
                            output: String((_e = execution.output) !== null && _e !== void 0 ? _e : ''),
                            summary: String((_f = execution.summary) !== null && _f !== void 0 ? _f : entry.skillName),
                        }];
            }
        });
    });
}
function saveViaRelay(entry, input, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var path, docId, resp, e_2, text, data;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    path = String((_a = input.path) !== null && _a !== void 0 ? _a : '');
                    if (!path.startsWith('/'))
                        fail('path 必须是目标文件的本机绝对路径', path, 'local');
                    if ((0, sync_ts_1.isInSyncWindow)(path))
                        fail('sync window', path, 'sync');
                    return [4 /*yield*/, sha256Hex(path)];
                case 1:
                    docId = _d.sent();
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, fetch("".concat(RELAY_BASE, "/api/control/").concat(entry.app, "/").concat(docId, "/export"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: signal,
                            body: JSON.stringify({ path: path }),
                        })];
                case 3:
                    resp = _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_2 = _d.sent();
                    fail(e_2 instanceof Error ? e_2.message : String(e_2), path, 'fetch');
                    return [3 /*break*/, 5];
                case 5:
                    if (!!resp.ok) return [3 /*break*/, 7];
                    return [4 /*yield*/, resp.text().catch(function () { return ''; })];
                case 6:
                    text = _d.sent();
                    fail("relay \u8FD4\u56DE HTTP ".concat(resp.status).concat(text ? ": ".concat(text) : ''), path, 'fetch');
                    _d.label = 7;
                case 7: return [4 /*yield*/, resp.json()];
                case 8:
                    data = (_d.sent());
                    if (!data.ok)
                        fail(String((_b = data.error) !== null && _b !== void 0 ? _b : 'unknown error'), path, 'relay');
                    (0, sync_ts_1.markSyncWindow)(path);
                    return [2 /*return*/, { ok: true, output: "\u5DF2\u4FDD\u5B58\u5230 ".concat((_c = data.path) !== null && _c !== void 0 ? _c : path), summary: '已保存' }];
            }
        });
    });
}
var READ_SKILLS = new Set([
    'get_document_context',
    'read_blocks',
    'web_search',
    'image_search',
    'get_workbook_context',
    'read_range',
    'load_guide',
    'read_formats',
    'read_sheet_features',
    'read_cells',
    'get_deck_context',
    'read_slide',
    'analyze_media',
    'list_style_templates',
    'read_pages',
    'search_text',
    'goto_page',
    'list_page_images',
    'list_form_fields',
    'get_outline',
]);
function callKindFor(entry) {
    if ((0, tool_schema_ts_1.isSaveEntry)(entry))
        return 'execute';
    if (READ_SKILLS.has(entry.skillName))
        return 'read';
    return 'edit';
}
function executeInsertImage(entry, input, signal, assets) {
    return __awaiter(this, void 0, void 0, function () {
        var path, imagePath, published, e_3, _drop, rest;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    path = String((_a = input.path) !== null && _a !== void 0 ? _a : '');
                    imagePath = String((_b = input.imagePath) !== null && _b !== void 0 ? _b : '');
                    if (assets === undefined || assets === null || !assets.available) {
                        fail('资产通道不可用：当前组合没有 httpServer', path, 'capability');
                    }
                    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                        fail('插图只接受本机路径，不接受公网 URL（BR-016）', path, 'local');
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, assets.publish(imagePath)];
                case 2:
                    published = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_3 = _c.sent();
                    fail(e_3 instanceof Error ? e_3.message : String(e_3), path, 'local');
                    return [3 /*break*/, 4];
                case 4:
                    _c.trys.push([4, , 6, 7]);
                    _drop = input.imagePath, rest = __rest(input, ["imagePath"]);
                    return [4 /*yield*/, callRelay(entry, __assign(__assign({}, rest), { url: published.url }), signal)];
                case 5: return [2 /*return*/, _c.sent()];
                case 6:
                    published.dispose();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/** Build the control tool definitions from the contract mirror table. */
function createControlTools(opts) {
    var _a, _b;
    if (opts === void 0) { opts = {}; }
    var allTools = (_a = opts.allTools) !== null && _a !== void 0 ? _a : process.env.DSH_GENOFFICE_ALL_TOOLS === '1';
    var assetsAvailable = ((_b = opts.assets) === null || _b === void 0 ? void 0 : _b.available) === true;
    return tool_schema_ts_1.CONTROL_TOOL_TABLE.filter(function (entry) { return shouldRegister(entry, { allTools: allTools, assetsAvailable: assetsAvailable }); }).map(function (entry) {
        var isSave = (0, tool_schema_ts_1.isSaveEntry)(entry);
        var cap = (0, capability_ts_1.capabilityOf)(entry.app, entry.skillName);
        return (0, dsh_tools_1.defineTool)({
            name: entry.name,
            description: describeEntry(entry, cap, allTools),
            parameters: entry.parameters,
            timeoutMs: CONTROL_TIMEOUT_MS,
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        ok: { type: 'boolean', required: true },
                        output: { type: 'string', required: true },
                        summary: { type: 'string', required: true },
                    },
                },
                render: function (_args, value) { return [{ type: 'text', text: value.output }]; },
            },
            presentCall: function (args) {
                var _a;
                return ({
                    card: 'generic',
                    title: entry.name,
                    kind: callKindFor(entry),
                    rawInput: String((_a = args.path) !== null && _a !== void 0 ? _a : ''),
                });
            },
            presentResult: function (_args, result) { return ({
                card: 'generic',
                title: result.isError ? "".concat(entry.name, " \u5931\u8D25") : entry.name,
            }); },
            execute: function (args, exec) {
                return __awaiter(this, void 0, void 0, function () {
                    var input, result_1, result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                input = args;
                                if (!(entry.name === 'docx_insert_image')) return [3 /*break*/, 2];
                                return [4 /*yield*/, executeInsertImage(entry, input, exec.signal, opts.assets)];
                            case 1: return [2 /*return*/, _a.sent()];
                            case 2:
                                if (!isSave) return [3 /*break*/, 4];
                                return [4 /*yield*/, saveViaRelay(entry, input, exec.signal)];
                            case 3:
                                result_1 = _a.sent();
                                return [2 /*return*/, { ok: result_1.ok, output: result_1.output, summary: result_1.summary }];
                            case 4: return [4 /*yield*/, callRelay(entry, input, exec.signal)];
                            case 5:
                                result = _a.sent();
                                return [2 /*return*/, { ok: result.ok, output: result.output, summary: result.summary }];
                        }
                    });
                });
            },
        });
    });
}
function registeredToolNames(opts) {
    if (opts === void 0) { opts = {}; }
    return createControlTools(opts).map(function (tool) { return tool.name; });
}
