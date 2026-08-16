"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGenOfficePromptText = buildGenOfficePromptText;
exports.applyPrompt = applyPrompt;
var lookup_ts_1 = require("./lookup.ts");
var capability_ts_1 = require("./capability.ts");
var APP_LABEL = {
    docs: 'docx',
    markdown: 'markdown',
    sheets: 'xlsx',
    slides: 'pptx',
    pdf: 'pdf',
};
function appOf(key) {
    return key.split(':')[0];
}
function skillOf(key) {
    return key.slice(key.indexOf(':') + 1);
}
function reasonOf(entry) {
    if (entry.handover === 'dsh:web_search')
        return '已交还 DSH，请用 web_search';
    if (entry.handover === 'dsh:pending')
        return '已划归 DSH 侧其它工具，本包不提供';
    if (entry.status === 'bridge-missing')
        return '网页桥接缺失';
    if (entry.status === 'state-locked')
        return '控制面状态门锁死';
    if (entry.status === 'cloud-only')
        return '依赖云生成 / 桌面版';
    if (entry.status === 'relay-fetch')
        return '会经 relay 出网';
    if (entry.status === 'guarded')
        return '空白 deck 会被上游守卫拒绝';
    if (entry.status === 'partial')
        return '部分可用';
    return entry.status;
}
/** Generated from CAPABILITY — do not maintain a second handwritten inventory. */
function buildGenOfficePromptText() {
    var _a;
    var exposed = [];
    var blocked = [];
    for (var _i = 0, _b = Object.entries(capability_ts_1.CAPABILITY); _i < _b.length; _i++) {
        var _c = _b[_i], key = _c[0], entry = _c[1];
        var label = "".concat(APP_LABEL[appOf(key)], ":").concat(skillOf(key));
        if ((0, capability_ts_1.isExposed)(entry))
            exposed.push(label);
        else
            blocked.push("".concat(label, "\uFF08").concat(reasonOf(entry), "\uFF09"));
    }
    var byApp = {};
    for (var _d = 0, exposed_1 = exposed; _d < exposed_1.length; _d++) {
        var name_1 = exposed_1[_d];
        var colon = name_1.indexOf(':');
        var app = name_1.slice(0, colon);
        var skill = name_1.slice(colon + 1);
        var list = (_a = byApp[app]) !== null && _a !== void 0 ? _a : (byApp[app] = []);
        list.push(skill);
    }
    var can = Object.entries(byApp)
        .map(function (_a) {
        var app = _a[0], skills = _a[1];
        return "".concat(app, "\uFF1A").concat(skills.join('、'));
    })
        .join('\n');
    return [
        '本机 GenOffice 是 web 部署，不是桌面版。工具只改已经在控制模式打开的文档；写盘只有 *_save 或界面「写入磁盘」。',
        "\u53EF\u505A\uFF1A\n".concat(can),
        "\u4E0D\u53EF\u505A\uFF08\u4E0D\u8981\u8C03\u7528\u3001\u4E0D\u8981\u5411\u7528\u6237\u627F\u8BFA\uFF09\uFF1A\n".concat(blocked.join('；')),
        '需要联网资料时用 DSH 自己的 web_search。GenOffice 侧没有检索工具。',
        '图片：不提供搜图与生图。本地已有图片时用 docx_insert_image，参数 imagePath 为本机绝对路径。',
        '「在浏览器中打开」会离开控制模式；网页版 AI 面板可直连第三方模型服务商，可能出网。',
    ].join('\n');
}
function applyPrompt(ctx) {
    var text = buildGenOfficePromptText();
    var mount = function (sp) {
        return sp.section({ name: 'tool:genoffice', order: 150, text: text });
    };
    var existing = (0, lookup_ts_1.lookupSystemPrompt)(ctx);
    if (existing !== undefined) {
        ctx.effect(function () { return mount(existing); });
        return;
    }
    ctx.inject(['systemPrompt'], function (c) { return mount(c.systemPrompt); });
}
