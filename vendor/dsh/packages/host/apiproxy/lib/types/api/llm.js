/**
 * llm domain contract: host-scoped provider topology for configuration
 * surfaces. `llm.providers` merges the configurable-provider directory
 * (which providers CAN be configured, and where their settings live) with the
 * live route registry; `llm.models` is the session-independent model catalog
 * (the same groups as `session.models`, without the per-session current
 * target). Both invalidate on the `host/models-changed` frame.
 */
export {};
//# sourceMappingURL=llm.js.map