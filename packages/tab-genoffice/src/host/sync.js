"use strict";
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYNC_WINDOW_MS = exports.SYNC_ROUTE = void 0;
exports.markSyncWindow = markSyncWindow;
exports.isInSyncWindow = isInSyncWindow;
exports.clearSyncWindow = clearSyncWindow;
exports.resetSyncWindows = resetSyncWindows;
exports.handleSyncRequest = handleSyncRequest;
exports.applySyncRoute = applySyncRoute;
var lookup_ts_1 = require("./lookup.ts");
exports.SYNC_ROUTE = '/dsh-artifact/genoffice-sync';
exports.SYNC_WINDOW_MS = 8000;
var windows = new Map();
var LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
function markSyncWindow(path, now) {
    if (now === void 0) { now = Date.now(); }
    if (!path.startsWith('/'))
        return;
    windows.set(path, now + exports.SYNC_WINDOW_MS);
}
function isInSyncWindow(path, now) {
    if (now === void 0) { now = Date.now(); }
    var exp = windows.get(path);
    if (exp === undefined)
        return false;
    if (now > exp) {
        windows.delete(path);
        return false;
    }
    return true;
}
function clearSyncWindow(path) {
    windows.delete(path);
}
/** Test helper. */
function resetSyncWindows() {
    windows.clear();
}
function readBody(req) {
    return __awaiter(this, void 0, void 0, function () {
        var chunks, chunk, e_1_1;
        var _a, req_1, req_1_1;
        var _b, e_1, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    chunks = [];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 6, 7, 12]);
                    _a = true, req_1 = __asyncValues(req);
                    _e.label = 2;
                case 2: return [4 /*yield*/, req_1.next()];
                case 3:
                    if (!(req_1_1 = _e.sent(), _b = req_1_1.done, !_b)) return [3 /*break*/, 5];
                    _d = req_1_1.value;
                    _a = false;
                    chunk = _d;
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    _e.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _e.trys.push([7, , 10, 11]);
                    if (!(!_a && !_b && (_c = req_1.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _c.call(req_1)];
                case 8:
                    _e.sent();
                    _e.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12: return [2 /*return*/, Buffer.concat(chunks).toString('utf8')];
            }
        });
    });
}
function handleSyncRequest(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var origin, path, body, _a, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    origin = req.headers.origin;
                    if (origin !== undefined && !LOOPBACK_ORIGIN.test(origin)) {
                        res.writeHead(403).end();
                        return [2 /*return*/];
                    }
                    if (((_d = req.method) !== null && _d !== void 0 ? _d : 'GET') !== 'POST') {
                        res.writeHead(405).end();
                        return [2 /*return*/];
                    }
                    path = '';
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, readBody(req)];
                case 2:
                    body = _b.apply(_a, [_e.sent()]);
                    path = typeof body.path === 'string' ? body.path : '';
                    return [3 /*break*/, 4];
                case 3:
                    _c = _e.sent();
                    res.writeHead(400).end();
                    return [2 /*return*/];
                case 4:
                    if (!path.startsWith('/')) {
                        res.writeHead(400).end();
                        return [2 /*return*/];
                    }
                    markSyncWindow(path);
                    res.writeHead(204).end();
                    return [2 /*return*/];
            }
        });
    });
}
function applySyncRoute(ctx) {
    var mount = function (http) {
        return http.register({
            kind: 'exact',
            path: exports.SYNC_ROUTE,
            handler: function (req, res) { void handleSyncRequest(req, res); },
        });
    };
    var existing = (0, lookup_ts_1.lookupHttpServer)(ctx);
    if (existing !== undefined) {
        ctx.effect(function () { return mount(existing); });
        return;
    }
    ctx.inject(['httpServer'], function (c) { return mount(c.httpServer); });
}
