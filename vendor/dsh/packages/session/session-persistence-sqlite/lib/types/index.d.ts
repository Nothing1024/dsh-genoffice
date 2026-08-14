/**
 * SQLite durable session-persistence backend. It maps each session header and
 * event to rows, and delegates write-path orchestration to
 * {@link PersistenceCoordinator}. It has no independent per-session artifact,
 * so its locator returns `undefined`.
 * @module @deepseek-ai/dsh-session-persistence-sqlite
 */
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { SessionPersistence, type PersistenceBackend, type SessionLocation, type SessionPersistenceSnapshot, type SessionInspection, type SessionPersistenceRevision as PersistenceRevision, type StoredPrefix, type StoredSuffix } from '@deepseek-ai/dsh-session-persistence';
import type { SessionEvent, SessionId, SessionHeader, SessionPreparation } from '@deepseek-ai/dsh-session';
import { type JournalMode } from './schema.ts';
export { SCHEMA_VERSION } from './schema.ts';
/** Plugin configuration. */
export interface Config {
    /**
     * Filesystem path to the SQLite database file. The special value `:memory:`
     * opens an in-process database (tests). On filesystems with POSIX modes,
     * missing directories and databases are created owner-only; existing path
     * modes are preserved. Filesystem setup errors other than an existing database
     * fail initialization. The backend does not protect confidentiality or
     * integrity when another principal can replace the database entry in its
     * parent directory.
     */
    path: string;
    /**
     * SQLite `journal_mode` pragma. `wal` (the default) is the recorded
     * durability model; pick a rollback-journal mode (`delete`/`truncate`/
     * `persist`) on filesystems where WAL's shared-memory files do not work
     * (network mounts). See {@link JournalMode}.
     */
    journalMode?: JournalMode;
    /** Maximum cold Session preparations retained for history-to-resume reuse. */
    preparedSessionCacheSize?: number;
    /** Fixed live-event coalescing window; not a backend completion deadline. */
    writeBatchMaxDelayMs?: number;
}
/**
 * The SQLite persistence backend. Load as a plugin; it registers as
 * `ctx.sessionPersistence` and (via the coordinator) installs the write-path
 * listeners. Its torn-tail marker is the seq to delete from.
 */
export declare class SqliteSessionPersistence extends SessionPersistence implements PersistenceBackend<number> {
    config: Config;
    readonly supportsRawArtifacts = false;
    static inject: string[];
    static Config: z<Config>;
    /**
     * Backend label for the coordinator's dispose diagnostics. Intentionally
     * shadows cordis `Service.name` (set to `'sessionPersistence'` by the base);
     * see the JSONL backend for why this does not affect service resolution.
     */
    readonly name = "session-persistence-sqlite";
    private db;
    private storeIdentity;
    private ready;
    private coordinator;
    constructor(ctx: Context, config: Config);
    private openDb;
    /** SQLite has one database, not an independent local artifact per session. */
    locate(_meta: SessionHeader): SessionLocation | undefined;
    create(meta: SessionHeader): Promise<void>;
    append(id: SessionId, events: readonly SessionEvent[]): Promise<void>;
    prepare(id: SessionId, signal?: AbortSignal): Promise<SessionPreparation>;
    load(id: SessionId): Promise<SessionInspection>;
    inspect(id: SessionId, signal?: AbortSignal): Promise<SessionInspection>;
    readFrom(id: SessionId, fromSeq: number, signal?: AbortSignal): Promise<{
        meta: SessionHeader;
        events: SessionEvent[];
    }>;
    /** Read a stored prefix by id (ids are globally unique — no scope to scan). */
    loadStored(id: SessionId, signal?: AbortSignal): Promise<StoredPrefix<number> | undefined>;
    /** Read one row's revision without loading its events. */
    readStoredRevision(id: SessionId, signal?: AbortSignal): Promise<PersistenceRevision | undefined>;
    /**
     * Seek-capable suffix read: SQL selects `seq >= fromSeq` directly, so the
     * read scales with the suffix, not the log. Torn rows past the preserved
     * region are dropped, never repaired (non-mutating read).
     */
    loadStoredFrom(id: SessionId, fromSeq: number, signal?: AbortSignal): Promise<StoredSuffix | undefined>;
    /**
     * Read a session's row + ordered events into a {@link StoredPrefix}. The
     * torn-tail marker is the seq from which a never-committed tail must be deleted
     * (`scanRows` already returns it as `number | undefined`).
     */
    private readPrefix;
    /**
     * Durably append a batch in ONE transaction: materialize the sessions row (if
     * lazy) and INSERT every event, or roll back entirely. The transaction is the
     * atomicity + durability boundary, so a mid-batch failure (a UNIQUE violation
     * on a duplicated seq) leaves the stored log untouched.
     */
    appendBatch(meta: SessionHeader, events: readonly SessionEvent[], isMaterialized: boolean): Promise<void>;
    /**
     * Make a crash repair durable in ONE transaction: DELETE the torn tail (from
     * `tornMarker`) and INSERT the synthetic `closers`. After COMMIT the stored rows
     * == the balanced log.
     */
    commitRepair(meta: SessionHeader, tornMarker: number | undefined, closers: readonly SessionEvent[]): Promise<void>;
    /** List all materialized sessions' metadata (every row is a materialized session). */
    list(signal?: AbortSignal): Promise<SessionHeader[]>;
    /** List metadata with a source-qualified monotonic revision per session. */
    listSnapshots(signal?: AbortSignal): Promise<SessionPersistenceSnapshot[]>;
    /** Close the database handle (awaited by the coordinator's dispose, post-drain). */
    close(): Promise<void>;
    /** Fetch a session's row, or undefined if absent. */
    private rowFor;
    /**
     * Insert-or-replace a session's metadata row. The only caller is the first
     * materializing `appendBatch`, so writing the row IS the materialization (its
     * existence is the signal `list` reads).
     */
    private writeRow;
}
export default SqliteSessionPersistence;
//# sourceMappingURL=index.d.ts.map