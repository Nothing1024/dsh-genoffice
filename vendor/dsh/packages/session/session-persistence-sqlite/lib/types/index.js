/**
 * SQLite durable session-persistence backend. It maps each session header and
 * event to rows, and delegates write-path orchestration to
 * {@link PersistenceCoordinator}. It has no independent per-session artifact,
 * so its locator returns `undefined`.
 * @module @deepseek-ai/dsh-session-persistence-sqlite
 */
import z from '@deepseek-ai/schemastery';
import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DEFAULT_PREPARED_SESSION_CACHE_SIZE, DEFAULT_WRITE_BATCH_MAX_DELAY_MS, MAX_WRITE_BATCH_DELAY_MS, SessionPersistence, SessionPersistenceRevision, PersistenceCoordinator, } from '@deepseek-ai/dsh-session-persistence';
import { openDatabase, rowToMeta, scanRows, } from "./schema.js";
export { SCHEMA_VERSION } from "./schema.js";
/**
 * Serialize an event's optional envelope fields for SQL binding. The surface
 * fields are nullable TEXT columns — null when the event has no surface
 * metadata (non-surface events, events written before surface support); the
 * ignorable marker is a nullable INTEGER column — `1` iff the envelope carries
 * `ignorable: true`.
 */
function envelopeBindings(event) {
    const se = event;
    return [
        se.sourceEventSeqs ? JSON.stringify(se.sourceEventSeqs) : null,
        se.surfaceOp !== undefined ? JSON.stringify(se.surfaceOp) : null,
        event.ignorable === true ? 1 : null,
    ];
}
/** Build the source-qualified revision shared by full and lightweight reads. */
function sqliteRevision(storeIdentity, row) {
    return SessionPersistenceRevision(`${storeIdentity}:incarnation:${row.incarnation}:revision:${row.revision}`);
}
/**
 * Exclusively create a missing database file with owner-only permissions.
 * Existing files retain their modes, and errors other than `EEXIST` propagate.
 * `DatabaseSync` reopens by path, so this does not protect confidentiality or
 * integrity when another principal can replace the database entry in its parent
 * directory.
 */
async function createDatabaseFile(path) {
    try {
        const handle = await open(path, 'wx', 0o600);
        await handle.close();
    }
    catch (error) {
        if (error.code !== 'EEXIST')
            throw error;
    }
}
/**
 * The SQLite persistence backend. Load as a plugin; it registers as
 * `ctx.sessionPersistence` and (via the coordinator) installs the write-path
 * listeners. Its torn-tail marker is the seq to delete from.
 */
export class SqliteSessionPersistence extends SessionPersistence {
    config;
    supportsRawArtifacts = false;
    static inject = ['sessions'];
    static Config = z.object({
        path: z.string().required(),
        journalMode: z.union(['wal', 'delete', 'truncate', 'persist']).default('wal'),
        preparedSessionCacheSize: z.number().step(1).min(1).default(DEFAULT_PREPARED_SESSION_CACHE_SIZE),
        writeBatchMaxDelayMs: z.number().step(1).min(1).max(MAX_WRITE_BATCH_DELAY_MS)
            .default(DEFAULT_WRITE_BATCH_MAX_DELAY_MS),
    });
    /**
     * Backend label for the coordinator's dispose diagnostics. Intentionally
     * shadows cordis `Service.name` (set to `'sessionPersistence'` by the base);
     * see the JSONL backend for why this does not affect service resolution.
     */
    name = 'session-persistence-sqlite';
    db;
    storeIdentity;
    ready;
    coordinator;
    constructor(ctx, config) {
        super(ctx);
        this.config = config;
        // Programmatic wrappers may construct the backend without Schemastery normalization.
        const preparedSessionCacheSize = config.preparedSessionCacheSize
            ?? DEFAULT_PREPARED_SESSION_CACHE_SIZE;
        const writeBatchMaxDelayMs = config.writeBatchMaxDelayMs
            ?? DEFAULT_WRITE_BATCH_MAX_DELAY_MS;
        // Open asynchronously so directory creation does not block plugin apply;
        // every storage hook awaits the same readiness promise.
        this.ready = this.openDb(config.path, config.journalMode);
        this.coordinator = new PersistenceCoordinator(this.ctx, this, {
            preparedSessionCacheSize,
            writeBatchMaxDelayMs,
        });
    }
    async openDb(path, journalMode) {
        const actual = path === ':memory:' ? path : resolve(path);
        if (actual !== ':memory:') {
            await mkdir(dirname(actual), { recursive: true, mode: 0o700 });
            await createDatabaseFile(actual);
        }
        this.db = openDatabase(actual, journalMode);
        try {
            const row = this.db.prepare('SELECT store_id FROM persistence_state WHERE singleton = 1').get();
            /* v8 ignore next -- openDatabase inserts the singleton before returning. */
            if (row === undefined) {
                throw new Error(`session database at "${actual}" has no store identity`);
            }
            if (row.store_id.length === 0) {
                throw new Error(`session database at "${actual}" has no valid store identity`);
            }
            if (actual !== ':memory:') {
                const identity = statSync(actual, { bigint: true });
                this.storeIdentity = `file:${identity.dev}:${identity.ino}:${identity.birthtimeNs}:store:${row.store_id}`;
            }
            else {
                this.storeIdentity = `memory:store:${row.store_id}`;
            }
        }
        catch (error) {
            this.db.close();
            throw error;
        }
    }
    // --- SessionPersistence service API (delegated to the coordinator) ---
    /** SQLite has one database, not an independent local artifact per session. */
    locate(_meta) {
        return undefined;
    }
    create(meta) {
        return this.coordinator.create(meta);
    }
    append(id, events) {
        return this.coordinator.append(id, events);
    }
    prepare(id, signal) {
        return this.coordinator.prepare(id, signal);
    }
    load(id) {
        return this.coordinator.load(id);
    }
    inspect(id, signal) {
        return this.coordinator.inspect(id, signal);
    }
    readFrom(id, fromSeq, signal) {
        return this.coordinator.readFrom(id, fromSeq, signal);
    }
    // One method serves both public `list` and the backend hook; delegating it to
    // the coordinator would call this hook recursively.
    // --- PersistenceBackend hooks (the SQLite storage primitives) ---
    /** Read a stored prefix by id (ids are globally unique — no scope to scan). */
    loadStored(id, signal) {
        return this.readPrefix(id, signal);
    }
    /** Read one row's revision without loading its events. */
    async readStoredRevision(id, signal) {
        signal?.throwIfAborted();
        await this.ready;
        signal?.throwIfAborted();
        const row = this.rowFor(id);
        return row === undefined ? undefined : sqliteRevision(this.storeIdentity, row);
    }
    /**
     * Seek-capable suffix read: SQL selects `seq >= fromSeq` directly, so the
     * read scales with the suffix, not the log. Torn rows past the preserved
     * region are dropped, never repaired (non-mutating read).
     */
    async loadStoredFrom(id, fromSeq, signal) {
        signal?.throwIfAborted();
        await this.ready;
        signal?.throwIfAborted();
        const row = this.rowFor(id);
        if (row === undefined)
            return undefined;
        const meta = rowToMeta(row);
        const eventRows = this.db
            .prepare('SELECT seq, type, time, data, source_event_seqs, surface_op, ignorable FROM events WHERE session_id = ? AND seq >= ? ORDER BY seq')
            .all(id, fromSeq);
        signal?.throwIfAborted();
        const { preserved } = scanRows(eventRows, fromSeq);
        return { meta, events: preserved };
    }
    /**
     * Read a session's row + ordered events into a {@link StoredPrefix}. The
     * torn-tail marker is the seq from which a never-committed tail must be deleted
     * (`scanRows` already returns it as `number | undefined`).
     */
    async readPrefix(id, signal) {
        signal?.throwIfAborted();
        await this.ready;
        signal?.throwIfAborted();
        this.db.exec('BEGIN');
        let snapshot;
        try {
            const row = this.rowFor(id);
            if (row !== undefined) {
                const eventRows = this.db
                    .prepare('SELECT seq, type, time, data, source_event_seqs, surface_op, ignorable FROM events WHERE session_id = ? ORDER BY seq')
                    .all(id);
                snapshot = { row, eventRows };
            }
            this.db.exec('COMMIT');
        }
        catch (error) {
            /* v8 ignore start -- synchronous read failures only need transaction cleanup before propagation. */
            this.db.exec('ROLLBACK');
            throw error;
            /* v8 ignore stop */
        }
        signal?.throwIfAborted();
        if (snapshot === undefined)
            return undefined;
        const { row, eventRows } = snapshot;
        const { preserved, tornFrom } = scanRows(eventRows);
        return {
            meta: rowToMeta(row),
            events: preserved,
            revision: sqliteRevision(this.storeIdentity, row),
            ...tornFrom !== undefined ? { tornMarker: tornFrom } : {},
        };
    }
    /**
     * Durably append a batch in ONE transaction: materialize the sessions row (if
     * lazy) and INSERT every event, or roll back entirely. The transaction is the
     * atomicity + durability boundary, so a mid-batch failure (a UNIQUE violation
     * on a duplicated seq) leaves the stored log untouched.
     */
    async appendBatch(meta, events, isMaterialized) {
        await this.ready;
        const insertEvent = this.db.prepare('INSERT INTO events (session_id, seq, type, time, data, source_event_seqs, surface_op, ignorable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        this.db.exec('BEGIN');
        try {
            if (!isMaterialized)
                this.writeRow(meta);
            for (const event of events) {
                const [surfaceSeqs, surfaceOp, ignorable] = envelopeBindings(event);
                insertEvent.run(meta.id, event.seq, event.type, event.time, JSON.stringify(event.data), surfaceSeqs, surfaceOp, ignorable);
            }
            this.db.prepare('UPDATE sessions SET revision = revision + 1 WHERE id = ?').run(meta.id);
            this.db.exec('COMMIT');
        }
        catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
    /**
     * Make a crash repair durable in ONE transaction: DELETE the torn tail (from
     * `tornMarker`) and INSERT the synthetic `closers`. After COMMIT the stored rows
     * == the balanced log.
     */
    async commitRepair(meta, tornMarker, closers) {
        await this.ready;
        this.db.exec('BEGIN');
        try {
            if (tornMarker !== undefined) {
                this.db.prepare('DELETE FROM events WHERE session_id = ? AND seq >= ?').run(meta.id, tornMarker);
            }
            if (closers.length > 0) {
                const insertEvent = this.db.prepare('INSERT INTO events (session_id, seq, type, time, data, source_event_seqs, surface_op, ignorable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                for (const event of closers) {
                    const [surfaceSeqs, surfaceOp, ignorable] = envelopeBindings(event);
                    insertEvent.run(meta.id, event.seq, event.type, event.time, JSON.stringify(event.data), surfaceSeqs, surfaceOp, ignorable);
                }
            }
            if (tornMarker !== undefined || closers.length > 0) {
                this.db.prepare('UPDATE sessions SET revision = revision + 1 WHERE id = ?').run(meta.id);
            }
            this.db.exec('COMMIT');
        }
        catch (error) {
            // The DELETE+INSERT cannot collide (a row at a closer's seq is preserved or
            // deleted as torn first); this rolls back a DB-level failure (disk full,
            // etc.), unreachable in test.
            /* v8 ignore start */
            this.db.exec('ROLLBACK');
            throw error;
            /* v8 ignore stop */
        }
    }
    /** List all materialized sessions' metadata (every row is a materialized session). */
    async list(signal) {
        signal?.throwIfAborted();
        await this.ready;
        signal?.throwIfAborted();
        const rows = this.db
            .prepare('SELECT * FROM sessions')
            .all();
        signal?.throwIfAborted();
        return rows.map(rowToMeta);
    }
    /** List metadata with a source-qualified monotonic revision per session. */
    async listSnapshots(signal) {
        signal?.throwIfAborted();
        await this.ready;
        signal?.throwIfAborted();
        const rows = this.db.prepare('SELECT * FROM sessions').all();
        signal?.throwIfAborted();
        return rows.map(row => ({
            header: rowToMeta(row),
            revision: SessionPersistenceRevision(`${this.storeIdentity}:incarnation:${row.incarnation}:revision:${row.revision}`),
        }));
    }
    /** Close the database handle (awaited by the coordinator's dispose, post-drain). */
    async close() {
        await this.ready;
        this.db.close();
    }
    // --- row helpers ---
    /** Fetch a session's row, or undefined if absent. */
    rowFor(id) {
        return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    }
    /**
     * Insert-or-replace a session's metadata row. The only caller is the first
     * materializing `appendBatch`, so writing the row IS the materialization (its
     * existence is the signal `list` reads).
     */
    writeRow(meta) {
        this.db.prepare(`
      INSERT INTO sessions
        (id, version, created_at, cwd, parent_session, seed_length, origin, delegation_depth, agent_preset, incarnation, revision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
        created_at = excluded.created_at,
        cwd = excluded.cwd,
        parent_session = excluded.parent_session,
        seed_length = excluded.seed_length,
        origin = excluded.origin,
        delegation_depth = excluded.delegation_depth,
        agent_preset = excluded.agent_preset
    `).run(meta.id, meta.version, meta.createdAt, meta.cwd ?? null, meta.parentSession ?? null, meta.seedLength ?? null, meta.origin ?? null, meta.delegationDepth ?? null, meta.agentPreset ?? null, randomUUID());
    }
}
export default SqliteSessionPersistence;
//# sourceMappingURL=index.js.map