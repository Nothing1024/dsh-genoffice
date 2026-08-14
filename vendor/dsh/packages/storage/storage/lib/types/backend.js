/**
 * Backend-facing vocabulary of the storage hub: a backend owns one medium
 * (a file-tree root, a database file) and exposes data-shape facets over it.
 * This module is the normative contract text for backend implementers; the
 * shared conformance suite in `tests/contract.ts` asserts every clause.
 * @module @deepseek-ai/dsh-storage/src/backend
 */
/** Allowed shape for unit and table names: safe as a file name and as a SQL identifier segment without escaping. */
export const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/;
//# sourceMappingURL=backend.js.map