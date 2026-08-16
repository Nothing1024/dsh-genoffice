"use strict";
/**
 * GenOffice relay loopback: shared by the file-list panel and the control-mode
 * viewer. Probe state is a module-level store so both surfaces show one strip.
 */
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
exports.PREVIEWABLE = exports.RELAY_BASE = void 0;
exports.getRelayOk = getRelayOk;
exports.subscribeRelay = subscribeRelay;
exports.noteRelayOk = noteRelayOk;
exports.resetRelayStore = resetRelayStore;
exports.extOf = extOf;
exports.docIdFor = docIdFor;
exports.previewUrlFor = previewUrlFor;
exports.checkRelay = checkRelay;
exports.probeRelay = probeRelay;
exports.notifyHostSync = notifyHostSync;
/** The genoffice relay base (loopback; CORS loopback whitelist covers it). */
exports.RELAY_BASE = 'http://localhost:8787';
exports.PREVIEWABLE = {
    docx: 'docs',
    md: 'markdown',
    xlsx: 'sheets',
    pptx: 'slides',
    pdf: 'pdf',
};
var RELAY_THROTTLE_MS = 1500;
var relayOk = null;
var lastProbeAt = 0;
var inFlight = null;
var listeners = new Set();
function getRelayOk() {
    return relayOk;
}
function subscribeRelay(fn) {
    listeners.add(fn);
    return function () { listeners.delete(fn); };
}
function emitRelay() {
    for (var _i = 0, listeners_1 = listeners; _i < listeners_1.length; _i++) {
        var fn = listeners_1[_i];
        fn();
    }
}
/** Update the shared flag without a network round-trip (list fetch already proved it). */
function noteRelayOk(ok) {
    if (relayOk === ok)
        return;
    relayOk = ok;
    lastProbeAt = Date.now();
    emitRelay();
}
/** Test helper — not for production. */
function resetRelayStore() {
    relayOk = null;
    lastProbeAt = 0;
    inFlight = null;
}
function extOf(path) {
    var slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    var base = slash < 0 ? path : path.slice(slash + 1);
    var dot = base.lastIndexOf('.');
    return dot < 0 ? '' : base.slice(dot + 1).toLowerCase();
}
function docIdFor(absPath) {
    return __awaiter(this, void 0, void 0, function () {
        var digest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, crypto.subtle.digest('SHA-256', new TextEncoder().encode(absPath))];
                case 1:
                    digest = _a.sent();
                    return [2 /*return*/, __spreadArray([], new Uint8Array(digest), true).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('')];
            }
        });
    });
}
/** Control mode adds `control=1`; `_r` busts the iframe after save/reload (BR-014). */
function previewUrlFor(path, ext, control, nonce) {
    var app = exports.PREVIEWABLE[ext];
    if (app === undefined)
        return '';
    var target = encodeURIComponent("path:".concat(path));
    var extra = nonce !== undefined && nonce !== '' ? "&_r=".concat(encodeURIComponent(nonce)) : '';
    return "".concat(exports.RELAY_BASE, "/").concat(app, "/?").concat(control ? 'control=1&' : '', "open=").concat(target).concat(extra);
}
/** Raw health probe (no store). */
function checkRelay(signal) {
    return __awaiter(this, void 0, void 0, function () {
        var resp, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetch("".concat(exports.RELAY_BASE, "/api/dir?path="), signal === undefined ? undefined : { signal: signal })];
                case 1:
                    resp = _b.sent();
                    return [2 /*return*/, resp.ok];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/** Shared probe with throttle. `force` bypasses throttle (「重新检查」). */
function probeRelay() {
    return __awaiter(this, arguments, void 0, function (force, signal) {
        var now;
        if (force === void 0) { force = false; }
        return __generator(this, function (_a) {
            now = Date.now();
            if (!force && inFlight !== null)
                return [2 /*return*/, inFlight];
            if (!force && relayOk !== null && now - lastProbeAt < RELAY_THROTTLE_MS)
                return [2 /*return*/, relayOk];
            lastProbeAt = now;
            inFlight = checkRelay(signal).then(function (ok) {
                relayOk = ok;
                emitRelay();
                return ok;
            }).finally(function () {
                inFlight = null;
            });
            return [2 /*return*/, inFlight];
        });
    });
}
function notifyHostSync(path) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetch("".concat(window.location.origin, "/dsh-artifact/genoffice-sync"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: path }),
                        })];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
