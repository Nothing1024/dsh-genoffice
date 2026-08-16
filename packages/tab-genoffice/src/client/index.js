"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
exports.apply = apply;
/**
 * Client half of the GenOffice tab artifact: registers the file-browser tab
 * and control-mode FileViewers (docx / xlsx / pptx) on `ctx.betterSidebar`. When the
 * upstream service is absent the plugin still loads and skips registration
 * (BR-003) — betterSidebar is requested via `ctx.inject` so a missing
 * service never fail-louds the whole DSH tree.
 */
var react_1 = require("react");
var genoffice_tsx_1 = require("../tabs/genoffice.tsx");
var icon_tsx_1 = require("../tabs/icon.tsx");
var docx_control_viewer_tsx_1 = require("../tabs/docx-control-viewer.tsx");
var coexist_ts_1 = require("../tabs/coexist.ts");
var locales_ts_1 = require("../tabs/locales.ts");
/** Locale is required; betterSidebar is awaited inside apply so its absence
 *  skips registration instead of leaving this fiber PENDING (BR-003). */
exports.inject = ['locale'];
/**
 * Register the GenOffice tab and claimed FileViewers when better-sidebar is present.
 * @param ctx - client root context.
 */
function apply(ctx) {
    var t = ctx.locale.bind(locales_ts_1.NS);
    ctx.effect(function () { return ctx.locale.register(locales_ts_1.NS, { zh: locales_ts_1.zh, en: locales_ts_1.en }); }, 'dsh-tab-genoffice: dictionaries');
    ctx.inject(['betterSidebar'], function (raw) {
        var sidebarCtx = raw;
        var betterSidebar = sidebarCtx.betterSidebar;
        sidebarCtx.effect(function () { return betterSidebar.registerTab({
            id: 'dsh-artifact:genoffice',
            title: function () { return t('tab.genoffice'); },
            icon: function (size) { return (0, react_1.createElement)(icon_tsx_1.GenOfficeIcon, { size: size }); },
            order: 20,
            single: true,
            // Enable/disable appears automatically in the Side card settings
            // inventory from title + icon; we have no extra PrefsSchema toggles.
            component: function (props) { return (0, react_1.createElement)(genoffice_tsx_1.GenOfficePanel, props); },
        }); }, 'dsh-tab-genoffice: registerTab');
        var _loop_1 = function (ext) {
            sidebarCtx.effect(function () { return betterSidebar.registerFileViewer({
                id: "dsh-artifact:genoffice-".concat(ext),
                title: function () { return "GenOffice \u00B7 .".concat(ext); },
                icon: function (size) { return (0, react_1.createElement)(icon_tsx_1.GenOfficeIcon, { size: size }); },
                exts: [ext],
                priority: 10,
                fetchStrategy: 'none',
                component: docx_control_viewer_tsx_1.DocxControlViewer,
            }); }, "dsh-tab-genoffice: registerFileViewer:".concat(ext));
        };
        for (var _i = 0, CLAIMED_EXTS_1 = coexist_ts_1.CLAIMED_EXTS; _i < CLAIMED_EXTS_1.length; _i++) {
            var ext = CLAIMED_EXTS_1[_i];
            _loop_1(ext);
        }
    });
}
