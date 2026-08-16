"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupService = lookupService;
exports.lookupHttpServer = lookupHttpServer;
exports.lookupSystemPrompt = lookupSystemPrompt;
function lookupService(ctx, pred) {
    var _a, _b;
    var reflect = ((_a = ctx.root) !== null && _a !== void 0 ? _a : ctx).reflect;
    var store = reflect === null || reflect === void 0 ? void 0 : reflect.store;
    if (store === undefined)
        return undefined;
    for (var _i = 0, _c = Reflect.ownKeys(store); _i < _c.length; _i++) {
        var key = _c[_i];
        var value = (_b = store[key]) === null || _b === void 0 ? void 0 : _b.value;
        if (pred(value))
            return value;
    }
    return undefined;
}
function lookupHttpServer(ctx) {
    return lookupService(ctx, function (v) {
        return typeof v === 'object' && v !== null && typeof v.register === 'function'
            && typeof v.port === 'number';
    });
}
function lookupSystemPrompt(ctx) {
    return lookupService(ctx, function (v) {
        return typeof v === 'object' && v !== null && typeof v.section === 'function';
    });
}
