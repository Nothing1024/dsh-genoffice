/**
 * store domain zod schemas (names derived from map keys: storeListRequestSchema /
 * storeListValueSchema). Wire shapes mirror the @dsh/store-core contract —
 * the second-level S→C parse (UNARY_VALUE_SCHEMAS) and the handler's request
 * parse both anchor here, so the GUI client and the store facade agree on the
 * same JSON shape (BR-001).
 */
import { z } from 'zod';
/** A scheme (backend id) must be a non-empty string. */
export const storeSchemeSchema = z.string().min(1);
/** A store URI reference must be a non-empty string (parse/validation lives in the facade). */
export const storeUriSchema = z.string().min(1);
/** A db version selector, when present, must be a positive integer. */
export const storeVerSchema = z.number().int().positive();
/** Free-form metadata: string values only. */
export const storeMetaSchema = z.record(z.string(), z.string());
/** store.list request payload. */
export const storeListRequestSchema = z.object({
    scheme: storeSchemeSchema,
});
/** One store.list row. */
export const storeDocInfoSchema = z.object({
    id: z.string(),
    kind: z.string().optional(),
    title: z.string().optional(),
    headVer: z.number().optional(),
    updatedAt: z.number().optional(),
    createdAt: z.number().optional(),
});
/** store.list response value. */
export const storeListValueSchema = z.object({
    items: z.array(storeDocInfoSchema),
});
/** store.read request payload. */
export const storeReadRequestSchema = z.object({
    uri: storeUriSchema,
    ver: storeVerSchema.optional(),
});
/** store.read response value. */
export const storeReadValueSchema = z.object({
    content: z.string(),
    ver: z.number().optional(),
    path: z.string().optional(),
    mtime: z.number().optional(),
    meta: storeMetaSchema.optional(),
    bytes: z.number(),
});
/** store.write request payload (content may be empty for a placeholder document). */
export const storeWriteRequestSchema = z.object({
    uri: storeUriSchema,
    content: z.string(),
    meta: storeMetaSchema.optional(),
});
/** store.write response value. */
export const storeWriteValueSchema = z.object({
    key: z.string(),
    version: z.number().optional(),
    path: z.string().optional(),
});
/** store.history request payload. */
export const storeHistoryRequestSchema = z.object({
    uri: storeUriSchema,
});
/** One store.history row. */
export const storeVersionInfoSchema = z.object({
    ver: z.number(),
    createdAt: z.number(),
    meta: storeMetaSchema.optional(),
});
/** store.history response value. */
export const storeHistoryValueSchema = z.object({
    items: z.array(storeVersionInfoSchema),
});
/** Fixed wire bound for one search query (mirrors the sessions domain bound). */
const STORE_SEARCH_QUERY_MAX_CHARS = 500;
/** store.search request payload. */
export const storeSearchRequestSchema = z.object({
    scheme: storeSchemeSchema,
    query: z.string().trim().min(1).max(STORE_SEARCH_QUERY_MAX_CHARS)
        .refine(query => !query.includes('\0'), { message: 'search query must not contain NUL' }),
    limit: z.number().int().positive().max(100).optional(),
});
/** One store.search hit. */
export const storeSearchHitSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    snippet: z.string().optional(),
    rank: z.number().optional(),
});
/** store.search response value. */
export const storeSearchValueSchema = z.object({
    items: z.array(storeSearchHitSchema),
});
/** store.stat request payload. */
export const storeStatRequestSchema = z.object({
    uri: storeUriSchema,
});
/** store.stat response value. */
export const storeStatValueSchema = z.object({
    key: z.string(),
    headVer: z.number().optional(),
    bytes: z.number().optional(),
    mtime: z.number().optional(),
    kind: z.string().optional(),
    title: z.string().optional(),
});
//# sourceMappingURL=store.schema.js.map