/**
 * store domain zod schemas (names derived from map keys: storeListRequestSchema /
 * storeListValueSchema). Wire shapes mirror the @dsh/store-core contract —
 * the second-level S→C parse (UNARY_VALUE_SCHEMAS) and the handler's request
 * parse both anchor here, so the GUI client and the store facade agree on the
 * same JSON shape (BR-001).
 */
import { z } from 'zod';
import type { ResponseValue } from './rpc-map.ts';
import type { Wire } from './rpc.schema.ts';
import type { StoreDocInfo, StoreMeta, StoreReadResult, StoreSearchHit, StoreStat, StoreVersionInfo, StoreWriteResult } from './store.ts';
/** A scheme (backend id) must be a non-empty string. */
export declare const storeSchemeSchema: z.ZodString;
/** A store URI reference must be a non-empty string (parse/validation lives in the facade). */
export declare const storeUriSchema: z.ZodString;
/** A db version selector, when present, must be a positive integer. */
export declare const storeVerSchema: z.ZodNumber;
/** Free-form metadata: string values only. */
export declare const storeMetaSchema: z.ZodType<StoreMeta>;
/** store.list request payload. */
export declare const storeListRequestSchema: z.ZodObject<{
    scheme: z.ZodString;
}, z.core.$strip>;
/** One store.list row. */
export declare const storeDocInfoSchema: z.ZodType<Wire<StoreDocInfo>>;
/** store.list response value. */
export declare const storeListValueSchema: z.ZodType<Wire<ResponseValue<'store.list'>>>;
/** store.read request payload. */
export declare const storeReadRequestSchema: z.ZodObject<{
    uri: z.ZodString;
    ver: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** store.read response value. */
export declare const storeReadValueSchema: z.ZodType<Wire<StoreReadResult>>;
/** store.write request payload (content may be empty for a placeholder document). */
export declare const storeWriteRequestSchema: z.ZodObject<{
    uri: z.ZodString;
    content: z.ZodString;
    meta: z.ZodOptional<z.ZodType<StoreMeta, unknown, z.core.$ZodTypeInternals<StoreMeta, unknown>>>;
}, z.core.$strip>;
/** store.write response value. */
export declare const storeWriteValueSchema: z.ZodType<Wire<StoreWriteResult>>;
/** store.history request payload. */
export declare const storeHistoryRequestSchema: z.ZodObject<{
    uri: z.ZodString;
}, z.core.$strip>;
/** One store.history row. */
export declare const storeVersionInfoSchema: z.ZodType<Wire<StoreVersionInfo>>;
/** store.history response value. */
export declare const storeHistoryValueSchema: z.ZodType<Wire<ResponseValue<'store.history'>>>;
/** store.search request payload. */
export declare const storeSearchRequestSchema: z.ZodObject<{
    scheme: z.ZodString;
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** One store.search hit. */
export declare const storeSearchHitSchema: z.ZodType<Wire<StoreSearchHit>>;
/** store.search response value. */
export declare const storeSearchValueSchema: z.ZodType<Wire<ResponseValue<'store.search'>>>;
/** store.stat request payload. */
export declare const storeStatRequestSchema: z.ZodObject<{
    uri: z.ZodString;
}, z.core.$strip>;
/** store.stat response value. */
export declare const storeStatValueSchema: z.ZodType<Wire<StoreStat>>;
//# sourceMappingURL=store.schema.d.ts.map