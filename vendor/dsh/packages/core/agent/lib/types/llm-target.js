/**
 * Agent-scoped LLM target snapshot shared by interactive front doors.
 * @module @deepseek-ai/dsh-agent/llm-target
 */
/**
 * Couple one mutable target to agent-scoped prompt assembly and request routing.
 * Prompt assembly snapshots the selected target before delegating, then applies
 * its route to prompt variables and its route/effort to request config so a
 * concurrent switch takes effect on a later step instead of splitting the two
 * surfaces. An absent selected effort clears any inherited effort so a model
 * switch can restore that target's provider/default behavior.
 *
 * @param agentCtx - The target agent's scoped context.
 * @param target - Mutable selection owned by the calling front door.
 * @returns Disposer for both scoped waterfall listeners.
 */
export function installAgentLlmTarget(agentCtx, target) {
    const disposeAssembly = agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
        const selected = target.current;
        const assembled = await next();
        target.assembled = selected;
        if (selected === undefined)
            return assembled;
        return {
            ...assembled,
            variables: {
                ...assembled.variables,
                provider: selected.provider,
                model: selected.model,
            },
        };
    });
    const disposeRequest = agentCtx.on('agent/request', async (_payload, next) => {
        const resolved = await next();
        const selected = target.assembled;
        if (selected === undefined)
            return resolved;
        const { reasoningEffort: _inheritedEffort, ...withoutInheritedEffort } = resolved;
        return {
            ...withoutInheritedEffort,
            provider: selected.provider,
            model: selected.model,
            ...selected.reasoningEffort === undefined
                ? {}
                : { reasoningEffort: selected.reasoningEffort },
        };
    });
    return () => {
        disposeAssembly();
        disposeRequest();
    };
}
//# sourceMappingURL=llm-target.js.map