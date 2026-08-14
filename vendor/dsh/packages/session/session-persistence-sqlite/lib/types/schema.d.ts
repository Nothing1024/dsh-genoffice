/**
 * Schema + load-time helpers for the SQLite session-persistence backend: the
 * DDL (a store-identity row, `sessions` metadata, and a 1:1 `events` row per
 * `SessionEvent`), the database open/configure step, and the last-`turn/end`
 * cut that gives the SQLite backend the SAME crash-tail-on-load semantics as
 * the JSONL backend.
 *
 * @module dsh-session-persistence-sqlite/schema
 */
import { DatabaseSync } from 'node:sqlite';
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session';
/**
 * The on-disk schema version. Bumped only on a breaking change to the table
 * layout; orthogonal to a session's own `version` (which versions the EVENT
 * vocabulary, stored per session in the `sessions` row).
 */
export declare const SCHEMA_VERSION = 15;
/** SQLite application id protecting unrelated databases from persistence writes. */
export declare const SESSION_PERSISTENCE_SQLITE_APPLICATION_ID = 1146308688;
/**
 * A row of the `sessions` table — the out-of-log metadata ({@link SessionHeader}).
 * The row's EXISTENCE is the materialization signal: it is written only by the
 * first `append` (lazy materialization), so a created-but-never-appended
 * session has no row and is absent from `list`, mirroring the JSONL
 * backend's "no file until first append".
 */
export interface SessionRow {
    id: string;
    version: number;
    created_at: number;
    cwd: string | null;
    parent_session: string | null;
    seed_length: number | null;
    origin: 'subagent' | null;
    /** Stable identity assigned when this log is materialized. */
    incarnation: string;
    /** Monotonic log-change token incremented in each mutating transaction. */
    revision: number;
    delegation_depth: number | null;
    agent_preset: string | null;
}
/** An `events` table row: one `SessionEvent` mapped 1:1 (`data` is JSON text). */
export interface EventRow {
    seq: number;
    type: string;
    time: number;
    data: string;
    /** JSON-encoded `number[]` — the event's sourceEventSeqs, or null. */
    source_event_seqs: string | null;
    /** JSON-encoded `SurfaceOp` — how the event entered the surface, or null. */
    surface_op: string | null;
    /** `1` iff the event carries the envelope's `ignorable: true` marker, else null. */
    ignorable: number | null;
}
/**
 * Journal modes the backend will run under. `wal` is the default and the
 * durability model the persistence ADR records; the rollback-journal modes
 * (`delete`/`truncate`/`persist`) exist for filesystems where WAL's
 * shared-memory files do not work (network mounts). `memory`/`off` are
 * excluded: dropping journal durability silently contradicts what this
 * backend promises.
 */
export type JournalMode = 'wal' | 'delete' | 'truncate' | 'persist';
/**
 * Open the database and apply its schema and pragmas. An empty database with a
 * zero `user_version` is initialized at {@link SCHEMA_VERSION}; a nonempty
 * unversioned database and every other non-current version reject rather than
 * being migrated in place.
 * @param path - the SQLite database file to open (created when absent).
 * @param journalMode - validated journal pragma.
 * @returns the open handle with pragmas applied and all three tables ensured.
 */
export declare function openDatabase(path: string, journalMode: JournalMode): DatabaseSync;
/**
 * Reconstruct the {@link SessionHeader} from a `sessions` row.
 * @param row - the `sessions` table row.
 * @returns the header, `NULL` columns mapped to omitted optional fields.
 */
export declare function rowToMeta(row: SessionRow): SessionHeader;
/**
 * Reconstruct a {@link SessionEvent} from an `events` row (parses `data`).
 * @param row - the `events` table row; `data` and the surface columns hold JSON text.
 * @returns the reconstructed event; throws when a JSON column fails to parse
 *   ({@link scanRows} treats that as a hole, not corruption, in the tail).
 */
export declare function rowToEvent(row: EventRow): SessionEvent;
/**
 * Find the preserved prefix of ordered event rows. Fully written rows in an
 * interrupted final turn remain in the prefix. The first unparsable row or seq
 * gap after the last `turn/end` marks a tolerated torn tail; the same hole in
 * the committed region rejects.
 *
 * @param rows - one session's event rows, ordered by seq ascending.
 * @param base - the seq the first row is expected to carry; `0` for a whole
 *   log, the requested `fromSeq` for a suffix read (`loadStoredFrom`).
 * @returns the preserved event prefix, plus `tornFrom` — the seq the physical
 *   delete starts at — when a torn tail exists.
 */
export declare function scanRows(rows: readonly EventRow[], base?: number): {
    preserved: SessionEvent[];
    tornFrom?: number;
};
//# sourceMappingURL=schema.d.ts.map