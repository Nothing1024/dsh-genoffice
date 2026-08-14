/**
 * Execution types for the bash executor seam. Background task semantics belong
 * to `@deepseek-ai/dsh-tasks`; this seam exposes only process handles. The
 * managed-environment and captured-output vocabulary is owned by the
 * subprocess seam and re-exported here so bash consumers keep one import
 * root.
 * @module dsh-bash/types
 */
export { DSH_ENV_PREFIX } from '@deepseek-ai/dsh-subprocess';
//# sourceMappingURL=types.js.map