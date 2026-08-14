/**
 * Types shared by task producers, the registry, and control surfaces. The
 * service implementation lives in `./index.ts`.
 * @module @deepseek-ai/dsh-tasks/types
 */
/**
 * Brand a string as a {@link TaskId}.
 * @param id - the raw task-id string (the registry generates `<kind>-N`).
 * @returns the same string, branded; no validation is performed.
 */
export function TaskId(id) {
    return id;
}
//# sourceMappingURL=types.js.map