"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxControlViewer = DocxControlViewer;
/**
 * FileViewer adapter: FileViewerProps → ControlModeViewer. One component
 * covers every claimed extension; ext is derived from the path.
 */
var react_1 = require("react");
var control_mode_tsx_1 = require("./control-mode.tsx");
var coexist_ts_1 = require("./coexist.ts");
var relay_ts_1 = require("./relay.ts");
var genoffice_module_css_1 = require("./genoffice.module.css");
function DocxControlViewer(props) {
    var ext = (0, relay_ts_1.extOf)(props.path);
    return (<control_mode_tsx_1.ControlModeViewer path={props.path} title={props.title} ext={ext} renderBuiltin={function () {
            var upstreamId = coexist_ts_1.UPSTREAM_VIEWER_ID[ext];
            var builtin = props.ctx.betterSidebar.getFileViewers().find(function (v) { return v.id === upstreamId; });
            if (builtin === undefined) {
                return (0, react_1.createElement)('div', { className: genoffice_module_css_1.default.hint }, '内置预览不可用');
            }
            return (0, react_1.createElement)(builtin.component, props);
        }}/>);
}
