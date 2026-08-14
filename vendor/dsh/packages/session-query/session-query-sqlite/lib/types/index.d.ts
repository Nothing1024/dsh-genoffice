/**
 * Concrete session-query service with SQLite FTS5 over the live-preferred corpus.
 *
 * @module @deepseek-ai/dsh-session-query-sqlite
 */
import { Context, Service } from 'cordis';
import z from 'schemastery';
import SessionQueryService from '@deepseek-ai/dsh-session-query';
import type { Config as SessionQueryConfig, SessionEventSearchPage, SessionEventSearchRequest, SessionSearchExecContext, SessionSearchHit, SessionSearchPage, SessionSearchRequest } from '@deepseek-ai/dsh-session-query';
import { type JournalMode } from './schema.ts';
export { SESSION_QUERY_SQLITE_APPLICATION_ID, SESSION_QUERY_SQLITE_SCHEMA_VERSION, type JournalMode, } from './schema.ts';
/** Boot-context slot for a launcher-owned absolute path to this process's derived query index. */
export declare const SESSION_QUERY_SQLITE_PATH_KEY = "launcherSessionQueryPath";
declare module 'cordis' {
    interface Context {
        /** Launcher-owned absolute path to this process's disposable derived query index. */
        launcherSessionQueryPath?: string;
    }
}
/** Default result page size. */
export declare const SESSION_QUERY_SQLITE_DEFAULT_LIMIT = 20;
/** Maximum accepted result page size. */
export declare const SESSION_QUERY_SQLITE_MAX_LIMIT = 100;
/** Default maximum snippet length in Unicode code points. */
export declare const SESSION_QUERY_SQLITE_SNIPPET_CHARS = 240;
/** SQLite module/handle opening phase. */
export type OpenAt = 'startup' | 'first-search';
/** Combined session-query configuration backed by SQLite full-text search. */
export interface Config extends SessionQueryConfig {
    /**
     * Dedicated derived-index path; `:memory:` is supported for ephemeral
     * indexes. Missing directories and database files are created owner-only on
     * POSIX filesystems; existing modes are preserved.
     */
    path: string;
    /** Open the SQLite module and handle at service activation or the first search. Defaults to `startup`. */
    openAt?: OpenAt;
    /** SQLite journal mode. Defaults to `wal`. */
    journalMode?: JournalMode;
    /** Page size when a request omits `limit`. At most `Number.MAX_SAFE_INTEGER - 1`; defaults to 20. */
    defaultLimit?: number;
    /** Largest accepted page size. At most `Number.MAX_SAFE_INTEGER - 1`; defaults to 100. */
    maxLimit?: number;
    /** Maximum snippet length in Unicode code points. Defaults to 240. */
    snippetChars?: number;
    /** Maximum concurrent persisted-log inspections in one inherited batch read. Defaults to 4. */
    persistedInspectConcurrency?: number;
}
interface ResolvedConfig {
    path: string;
    openAt: OpenAt;
    journalMode: JournalMode;
    defaultLimit: number;
    maxLimit: number;
    snippetChars: number;
    readWindowMax: number;
    persistedInspectConcurrency: number;
}
/** Concrete SQLite owner of the combined `ctx.sessionQuery` service. */
export declare class SessionQuerySqlite extends SessionQueryService {
    static inject: string[];
    static Config: z<Config>;
    /** Validated and defaulted backend configuration. */
    readonly config: ResolvedConfig;
    private readonly _instance;
    private _ready;
    private _db;
    private _persistenceBinding;
    private _lastPersistenceIdentity;
    private _persistenceEpoch;
    private _globalGeneration;
    private _localGeneration;
    private _tail;
    private _closed;
    private _closePromise;
    private readonly _optionalPersistenceFiber;
    constructor(ctx: Context, config: Config);
    /** Open eagerly only when activation owns the configured readiness boundary. */
    protected [Service.init](): Promise<void>;
    searchSessions(request: SessionSearchRequest, exec?: SessionSearchExecContext): Promise<SessionSearchPage<SessionSearchHit>>;
    searchEvents(request: SessionEventSearchRequest, exec?: SessionSearchExecContext): Promise<SessionEventSearchPage>;
    /** Close the database after every accepted operation reaches quiescence. */
    close(): Promise<void>;
    private _close;
    private _open;
    private _ensureReady;
    private _serialized;
    private _reconcile;
    private _observeStable;
    private _mainGeneration;
    private _deleteSession;
    private _replacePersistedSession;
    private _replaceLiveSession;
    private _querySessions;
    private _queryEvents;
    private _targetObservation;
    private _sessionHit;
    private _eventHit;
    private _requireDb;
    private _isClosed;
}
export default SessionQuerySqlite;
//# sourceMappingURL=index.d.ts.map