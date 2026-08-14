/**
 * The globally named `list_agents` tool: a thin model-facing adapter over
 * the continuable projection of `ctx.subagents.listChildren()`. It is
 * separately loadable from the
 * root `send_message` plugin because it additionally requires the session
 * query service — a deployment may use `send_message` without loading session
 * query, and this plugin remains inactive until that service is available.
 * @module @deepseek-ai/dsh-tool-subagent-control/list-agents
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
export const name = 'tool-subagent-list-agents';
export const inject = ['tools', 'subagents', 'sessionQuery'];
/**
 * Register the `list_agents` tool.
 * @param ctx - context carrying the tool registry, subagent service, and session query.
 */
export function apply(ctx) {
    ctx.tools.register(defineTool({
        name: 'list_agents',
        description: 'List your continuable background subagents by durable id and label. Status is a snapshot of the stored '
            + 'record: running means the subagent session is currently live in this process, complete means '
            + 'it exists only in storage and a `send_message` starts a new turn on the same conversation. '
            + 'The snapshot is not a delivery promise — `send_message` performs the authoritative check and '
            + 'may still fail. Children that could not be read are reported as diagnostics instead of being '
            + 'silently dropped.',
        parameters: {},
        output: {
            schema: {
                type: 'array',
                items: {
                    oneOf: [
                        {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                kind: { type: 'string', required: true, enum: ['child'] },
                                id: { type: 'string', required: true },
                                label: { type: 'string', required: true },
                                status: { type: 'string', required: true, enum: ['running', 'complete'] },
                            },
                        },
                        {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                kind: { type: 'string', required: true, enum: ['diagnostic'] },
                                id: { type: 'string', required: true },
                                reason: { type: 'string', required: true, enum: ['corrupt', 'unsupported', 'unavailable'] },
                            },
                        },
                    ],
                },
            },
            render: (_args, entries) => [{
                    type: 'text',
                    text: entries.length === 0
                        ? '(no subagents)'
                        : entries.map(entry => entry.kind === 'child'
                            ? `${entry.id} [${entry.status}] — ${entry.label}`
                            : `${entry.id} [diagnostic: ${entry.reason}]`).join('\n'),
                }],
        },
        async execute(_args, exec) {
            const parent = exec.agent;
            if (!parent) {
                // Non-agent callers have no session whose children could be listed.
                throw new Error('list_agents requires a calling agent (exec.agent was undefined)');
            }
            // The registry drains started tool bodies, so the scan must observe the
            // call's signal rather than finish a slow catalog after cancellation.
            const entries = await ctx.subagents.listChildren(parent.id, exec.signal);
            const visible = [];
            for (const entry of entries) {
                if (entry.kind === 'diagnostic') {
                    visible.push(entry);
                }
                else if (entry.mode === 'continuable') {
                    visible.push({
                        kind: 'child',
                        id: entry.id,
                        label: entry.label,
                        status: entry.activity === 'running' ? 'running' : 'complete',
                    });
                }
            }
            return visible;
        },
    }));
}
//# sourceMappingURL=list-agents.js.map