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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ASSET_BYTES = exports.TOKEN_TTL_MS = exports.ASSET_PREFIX = void 0;
exports.createAssetStore = createAssetStore;
exports.serveAsset = serveAsset;
exports.createAssetChannel = createAssetChannel;
/**
 * One-shot loopback asset channel for `docx_insert_image` (BR-016).
 * Token dies on first GET or after TTL; missing httpServer → channel unavailable.
 *
 * Reads bytes with node:fs — this plugin has no `ctx.fs` service.
 */
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_crypto_1 = require("node:crypto");
var lookup_ts_1 = require("./lookup.ts");
exports.ASSET_PREFIX = '/dsh-artifact/genoffice-asset';
exports.TOKEN_TTL_MS = 60000;
exports.MAX_ASSET_BYTES = 20 * 1024 * 1024;
var MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
};
function assertSafeImagePath(absPath) {
    if (!absPath.startsWith('/')) {
        throw new Error('imagePath 必须是本机绝对路径');
    }
    if (absPath.split('/').includes('..')) {
        throw new Error('imagePath 不得包含 ..');
    }
    if (/^https?:\/\//i.test(absPath)) {
        throw new Error('插图只接受本机路径，不接受公网 URL（BR-016）');
    }
    var ext = (0, node_path_1.extname)(absPath).toLowerCase();
    if (MIME[ext] === undefined) {
        throw new Error('仅支持 png / jpeg / webp / gif');
    }
    return ext;
}
function createAssetStore(opts) {
    var _a, _b;
    var ttl = (_a = opts === null || opts === void 0 ? void 0 : opts.ttlMs) !== null && _a !== void 0 ? _a : exports.TOKEN_TTL_MS;
    var now = (_b = opts === null || opts === void 0 ? void 0 : opts.now) !== null && _b !== void 0 ? _b : Date.now;
    var tokens = new Map();
    return {
        publish: function (absPath, bind) {
            return __awaiter(this, void 0, void 0, function () {
                var ext, st, token, host, url;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ext = assertSafeImagePath(absPath);
                            return [4 /*yield*/, (0, promises_1.stat)(absPath)];
                        case 1:
                            st = _a.sent();
                            if (!st.isFile())
                                throw new Error('imagePath 不是文件');
                            if (st.size > exports.MAX_ASSET_BYTES)
                                throw new Error('图片超过 20MB');
                            void ext;
                            token = (0, node_crypto_1.randomUUID)();
                            tokens.set(token, { absPath: absPath, expires: now() + ttl });
                            host = bind.host === '0.0.0.0' ? '127.0.0.1' : bind.host;
                            url = "http://".concat(host, ":").concat(bind.port).concat(exports.ASSET_PREFIX, "/").concat(token);
                            return [2 /*return*/, {
                                    url: url,
                                    token: token,
                                    dispose: function () { tokens.delete(token); },
                                }];
                    }
                });
            });
        },
        take: function (token, at) {
            var row = tokens.get(token);
            if (row === undefined)
                return undefined;
            tokens.delete(token);
            if ((at !== null && at !== void 0 ? at : now()) > row.expires)
                return undefined;
            return row;
        },
        peek: function (token) {
            return tokens.get(token);
        },
        clear: function () {
            tokens.clear();
        },
    };
}
function serveAsset(store, req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var pathname, prefix, token, row, ext, type, buf, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (((_b = req.method) !== null && _b !== void 0 ? _b : 'GET') !== 'GET' && ((_c = req.method) !== null && _c !== void 0 ? _c : '') !== 'HEAD') {
                        res.writeHead(405).end();
                        return [2 /*return*/];
                    }
                    pathname = '';
                    try {
                        pathname = new URL((_d = req.url) !== null && _d !== void 0 ? _d : '/', 'http://127.0.0.1').pathname;
                    }
                    catch (_f) {
                        res.writeHead(400).end();
                        return [2 /*return*/];
                    }
                    prefix = "".concat(exports.ASSET_PREFIX, "/");
                    if (!pathname.startsWith(prefix)) {
                        res.writeHead(404).end();
                        return [2 /*return*/];
                    }
                    token = pathname.slice(prefix.length);
                    if (!/^[0-9a-f-]{36}$/i.test(token)) {
                        res.writeHead(404).end();
                        return [2 /*return*/];
                    }
                    row = store.take(token);
                    if (row === undefined) {
                        res.writeHead(404).end();
                        return [2 /*return*/];
                    }
                    ext = (0, node_path_1.extname)(row.absPath).toLowerCase();
                    type = MIME[ext];
                    if (type === undefined) {
                        res.writeHead(404).end();
                        return [2 /*return*/];
                    }
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readFile)(row.absPath)];
                case 2:
                    buf = _e.sent();
                    if (buf.length > exports.MAX_ASSET_BYTES) {
                        res.writeHead(404).end();
                        return [2 /*return*/];
                    }
                    res.writeHead(200, {
                        'Content-Type': type,
                        'Content-Length': buf.length,
                        'Cache-Control': 'no-store',
                    });
                    res.end(buf);
                    return [3 /*break*/, 4];
                case 3:
                    _a = _e.sent();
                    res.writeHead(404).end();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Prefer `reflect.get` when the service is already provided (external plugins
 * often cannot `inject()` undeclared services). Fall back to nested inject so
 * Electron compositions without httpServer still load.
 */
function createAssetChannel(ctx) {
    var store = createAssetStore();
    var bind = { host: '127.0.0.1', port: 0, ready: false };
    var mount = function (http) {
        bind.host = http.host === '0.0.0.0' ? '127.0.0.1' : http.host;
        bind.port = http.port;
        bind.ready = true;
        var disposeRoute = http.register({
            kind: 'prefix',
            path: exports.ASSET_PREFIX,
            handler: function (req, res) { void serveAsset(store, req, res); },
        });
        return function () {
            bind.ready = false;
            disposeRoute();
            store.clear();
        };
    };
    var existing = (0, lookup_ts_1.lookupHttpServer)(ctx);
    if (existing !== undefined) {
        ctx.effect(function () { return mount(existing); });
    }
    else {
        ctx.inject(['httpServer'], function (c) { return mount(c.httpServer); });
    }
    return {
        get available() {
            return bind.ready;
        },
        publish: function (absPath) {
            if (!bind.ready) {
                return Promise.reject(new Error('资产通道不可用：当前组合没有 httpServer'));
            }
            return store.publish(absPath, { host: bind.host, port: bind.port });
        },
    };
}
