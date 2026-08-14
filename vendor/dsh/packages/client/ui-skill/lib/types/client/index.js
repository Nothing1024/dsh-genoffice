/** Required services: slash registry, routed sessions, and the wire face. */
export const inject = ['slash', 'connection', 'sessions'];
/**
 * Client plugin body: register the '/' skill source over the root wire face.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    const skills = ctx.get('connection').api.skills;
    const sessions = ctx.get('sessions');
    // Session-keyed catalog cache; single-flight per key. Plugin-closure state:
    // the fiber effect below is its teardown boundary.
    const fetches = new Map();
    // Per-session lexicon invalidation listeners (subscribeLexicon consumers).
    const lexiconListeners = new Map();
    const notifyLexicon = (sessionId) => {
        for (const listener of [...(lexiconListeners.get(sessionId) ?? [])]) {
            try {
                listener();
            }
            catch (error) {
                // Contain listener failures: settlement notifies from an ignored
                // promise chain (a throw would surface as an unhandled rejection)
                // and one faulty consumer must not starve the others.
                console.error('[ui-skill] lexicon listener failed:', error);
            }
        }
    };
    const fetchCatalog = (sessionId) => {
        if (sessions.subagentAddress(sessionId) !== undefined)
            return Promise.resolve([]);
        const existing = fetches.get(sessionId);
        if (existing !== undefined)
            return existing.promise;
        const abort = new AbortController();
        const promise = (async () => {
            const { result } = await skills.list({ sessionId }, abort.signal);
            if (!result.ok) {
                throw new Error(`skill.list failed: ${result.error.code}: ${result.error.message}`);
            }
            return result.value.skills;
        })();
        const entry = { promise, abort };
        fetches.set(sessionId, entry);
        promise.then(
        // Settled snapshot backs the synchronous lexicon reads.
        (skills) => {
            entry.settled = skills;
            notifyLexicon(sessionId);
        }, 
        // A failed fetch must not poison the key: the next consumer retries.
        () => {
            if (fetches.get(sessionId) === entry)
                fetches.delete(sessionId);
        });
        return promise;
    };
    const invalidate = (key) => {
        const entry = fetches.get(key);
        if (entry === undefined)
            return;
        fetches.delete(key);
        entry.abort.abort();
        notifyLexicon(key);
    };
    const clearAll = () => {
        for (const key of [...fetches.keys()])
            invalidate(key);
    };
    const source = {
        trigger: '/',
        name: 'skill',
        order: 2,
        async candidates(session, { query, signal }) {
            const skills = await fetchCatalog(session.sessionId);
            // Superseded keystroke: the shared fetch stays warm, this caller yields.
            if (signal.aborted)
                return [];
            return skills
                .filter(skill => skill.name.startsWith(query))
                .map(skill => ({ name: skill.name, description: skill.description }));
        },
        warm(session) {
            // Fire-and-forget scope-birth prewarm; the shared fetch reports
            // through candidates.
            fetchCatalog(session.sessionId).catch(() => { });
        },
        lexicon(session) {
            return fetches.get(session.sessionId)?.settled?.map(skill => skill.name);
        },
        subscribeLexicon(session, listener) {
            const key = session.sessionId;
            const listeners = lexiconListeners.get(key) ?? new Set();
            listeners.add(listener);
            lexiconListeners.set(key, listeners);
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0)
                    lexiconListeners.delete(key);
            };
        },
        onPick({ candidate }) {
            // Decision 21: plain-text reference — the literal lands in the draft
            // and ships to the model verbatim (trailing space closes the token).
            // Legacy path (decision 21), retained for the removal cut, no longer reached:
            // return { insert: { source: 'skill', ref: candidate.name, label: candidate.name, clipboardText: `/${candidate.name}` } }
            return { text: `/${candidate.name} ` };
        },
        codec: {
            clipboardText: ref => `/${ref}`,
            serialize: ref => Promise.resolve(`<skill>${ref}</skill>`),
        },
    };
    const slash = ctx.get('slash');
    ctx.on('connection/reset', clearAll);
    ctx.effect(() => {
        const unregister = slash.registerSource(source);
        return () => {
            unregister();
            clearAll();
        };
    }, 'ui-skill: source');
}
//# sourceMappingURL=index.js.map