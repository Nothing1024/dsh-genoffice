/**
 * store domain contract. Method signatures are the source of truth:
 * unary methods take the RpcRequest<P> narrow form and the impl echoes rpcId;
 * everything else references RequestPayload<'store.*'> / ResponseValue<'store.*'>.
 *
 * Wire shapes mirror the @dsh/store-core contract (BR-001): the platform
 * patch must not depend on the out-of-tree store plugin package, so the
 * payload entity types are re-declared here and stay shape-identical to
 * StoreService's results — `store.list`→list、`store.read`→read、
 * `store.write`→write、`store.history`→history、`store.search`→search、
 * `store.stat`→stat.
 */
import type { RpcRequest, RpcResponse } from './rpc.ts';
/** Free-form document metadata; values are strings (JSON-serializable). */
export type StoreMeta = Record<string, string>;
/** One read result, rendered by the GUI viewer (BR-004 truncation applies client-side). */
export interface StoreReadResult {
    /** UTF-8 document content. */
    content: string;
    /** db backend: the version read (head when `ver` omitted). */
    ver?: number;
    /** File backend: the resolved real path. */
    path?: string;
    /** File backend: last-modified time (epoch millis). */
    mtime?: number;
    /** Document metadata snapshot (db backend). */
    meta?: StoreMeta;
    /** Content byte length. */
    bytes: number;
}
/** One write result. */
export interface StoreWriteResult {
    /** The key written. */
    key: string;
    /** db backend: the new version number. */
    version?: number;
    /** File backend: the real path written. */
    path?: string;
}
/** One row of a `store.list` result. */
export interface StoreDocInfo {
    /** Document key. */
    id: string;
    /** Document kind (meta.kind), when recorded. */
    kind?: string;
    /** Document title (meta.title), when recorded. */
    title?: string;
    /** db backend: current head version. */
    headVer?: number;
    /** Last write time (epoch millis). */
    updatedAt?: number;
    /** First write time (epoch millis). */
    createdAt?: number;
}
/** One row of a `store.history` result. */
export interface StoreVersionInfo {
    /** Version number, ascending. */
    ver: number;
    /** Version creation time (epoch millis). */
    createdAt: number;
    /** Metadata snapshot recorded with this version. */
    meta?: StoreMeta;
}
/** One hit of a `store.search` result. */
export interface StoreSearchHit {
    /** Matching document key. */
    id: string;
    /** Document title, when recorded. */
    title?: string;
    /** Snippet around the first match. */
    snippet?: string;
    /** Rank (lower is better). */
    rank?: number;
}
/** One `store.stat` result. */
export interface StoreStat {
    /** The key. */
    key: string;
    /** db backend: head version. */
    headVer?: number;
    /** Content byte length of the head/current content. */
    bytes?: number;
    /** Last write / file mtime (epoch millis). */
    mtime?: number;
    /** Document kind (meta.kind), when recorded. */
    kind?: string;
    /** Document title (meta.title), when recorded. */
    title?: string;
}
/**
 * The store RPC domain: the GUI face of the one-time `ctx.store` service
 * (BR-001). Failures return structured RpcError with the StoreError code
 * verbatim (BR-002) — `path-denied` / `not-found` / `version-not-found` /
 * `unknown-scheme` / `invalid-key` / `payload-too-large` / `invalid-query` /
 * `unsupported` / `corrupt-store` and the rest of the store vocabulary.
 */
export interface StoreApi {
    /** List documents under one scheme (db / file); an empty store returns `[]` (BR-003). */
    list(request: RpcRequest<{
        scheme: string;
    }>): Promise<RpcResponse<{
        items: StoreDocInfo[];
    }>>;
    /** Read a document; `ver` selects a db version (default head) (BR-004). */
    read(request: RpcRequest<{
        uri: string;
        ver?: number;
    }>): Promise<RpcResponse<StoreReadResult>>;
    /** Write a document: db backend appends a version, file backend writes the real file. */
    write(request: RpcRequest<{
        uri: string;
        content: string;
        meta?: StoreMeta;
    }>): Promise<RpcResponse<StoreWriteResult>>;
    /** List versions of a db document; file backends raise `unsupported`. */
    history(request: RpcRequest<{
        uri: string;
    }>): Promise<RpcResponse<{
        items: StoreVersionInfo[];
    }>>;
    /** Full-text search within one scheme; no hits return `[]` (BR-003 non-error). */
    search(request: RpcRequest<{
        scheme: string;
        query: string;
        limit?: number;
    }>): Promise<RpcResponse<{
        items: StoreSearchHit[];
    }>>;
    /** Stat a document. */
    stat(request: RpcRequest<{
        uri: string;
    }>): Promise<RpcResponse<StoreStat>>;
}
//# sourceMappingURL=store.d.ts.map