import { jsx as _jsx } from "react/jsx-runtime";
import { IconBrowseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { readCardModel } from "../contract/read-card-model.js";
import { toolRowModel } from "../contract/tool-call-model.js";
import { ToolRow } from "../chat/ToolRow.js";
import { NS } from "../locales.js";
/**
 * Read row: icon + Read · {path} in the shared ToolRow chrome, with the file's
 * read card as the row's collapsed-by-default card body. The summary path is an
 * openable host link when the row names a single file.
 */
export function ReadRow({ toolName, block, cwd, openFile, inspect, t }) {
    const model = toolRowModel(toolName, block, cwd);
    const read = readCardModel(block, cwd);
    return (_jsx(ToolRow, { t: t, variant: model.variant, toolName: toolName, icon: _jsx(IconBrowseOutline16, { size: 14 }), title: model.title, summary: model.summary, body: null, output: model.output, errorSummary: model.errorSummary, read: read, state: model.state, filePath: model.filePath, onOpenFile: openFile, inspect: inspect }));
}
/**
 * The read row as a plain registrant plugin following the chat toolview
 * declaration across independent activation and reload lifetimes.
 */
export const readToolview = {
    name: 'read-toolview',
    inject: ['slots'],
    /**
     * Register the read row into the chat view's keyed toolview hole.
     * @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
     */
    apply(ctx) {
        ctx.slots.inject('conversation.chat.toolview', () => ctx.slots.register({ name: 'conversation.chat.toolview', key: 'read', locale: NS }, ReadRow));
    },
};
//# sourceMappingURL=read-row.js.map