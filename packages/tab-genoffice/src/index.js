"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = exports.name = void 0;
exports.apply = apply;
var assets_ts_1 = require("./host/assets.ts");
var prompt_ts_1 = require("./host/prompt.ts");
var sync_ts_1 = require("./host/sync.ts");
var tools_ts_1 = require("./host/tools.ts");
/** Plugin name (host half). */
exports.name = 'dsh-tab-genoffice';
/** Required services: the host tool registry. httpServer / systemPrompt are nested. */
exports.inject = ['tools'];
/**
 * Plugin host body.
 * @param ctx - host root context.
 */
function apply(ctx) {
    (0, prompt_ts_1.applyPrompt)(ctx);
    (0, sync_ts_1.applySyncRoute)(ctx);
    var assets = (0, assets_ts_1.createAssetChannel)(ctx);
    for (var _i = 0, _a = (0, tools_ts_1.createControlTools)({ assets: assets }); _i < _a.length; _i++) {
        var tool = _a[_i];
        ctx.tools.register(tool);
    }
}
