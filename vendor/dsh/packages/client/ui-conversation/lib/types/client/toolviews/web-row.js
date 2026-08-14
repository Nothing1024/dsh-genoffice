import { jsx as _jsx } from "react/jsx-runtime";
import { IconBrowseOutline16, IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { webCardModel } from "../contract/web-card-model.js";
import { toolRowModel } from "../contract/tool-call-model.js";
import { ToolRow } from "../chat/ToolRow.js";
import { NS } from "../locales.js";
/** web_fetch reads one URL; web_search queries. Titles are figma literals. */
const WEB_TITLES = {
    web_search: 'Search',
    web_fetch: 'Fetch',
};
/**
 * Web row: icon + Search/Fetch · {summary} in the shared ToolRow chrome, with
 * the completed retrieval's web card as the row's collapsed-by-default card
 * body. The row discriminates on `toolName` only to pick its icon and title.
 */
export function WebRow({ toolName, block, inspect, t }) {
    const model = toolRowModel(toolName, block);
    const web = webCardModel(block);
    const icon = toolName === 'web_fetch' ? _jsx(IconBrowseOutline16, { size: 14 }) : _jsx(IconSearchOutline16, { size: 14 });
    return (_jsx(ToolRow, { t: t, variant: model.variant, toolName: toolName, icon: icon, title: WEB_TITLES[toolName] ?? model.title, summary: model.summary, body: null, output: model.output, errorSummary: model.errorSummary, web: web, state: model.state, inspect: inspect }));
}
/**
 * The web rows follow the chat toolview declaration across activation and
 * reload. One WebRow component registers under both web tool names.
 */
export const webToolview = {
    name: 'web-toolview',
    inject: ['slots'],
    /**
     * Register the web row under both web tool names' keyed toolview holes.
     * @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
     */
    apply(ctx) {
        ctx.slots.inject('conversation.chat.toolview', function* () {
            yield ctx.slots.register({ name: 'conversation.chat.toolview', key: 'web_search', locale: NS }, WebRow);
            yield ctx.slots.register({ name: 'conversation.chat.toolview', key: 'web_fetch', locale: NS }, WebRow);
        });
    },
};
//# sourceMappingURL=web-row.js.map