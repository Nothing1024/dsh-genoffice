import z from "@deepseek-ai/schemastery";
import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DEFAULT_PREPARED_SESSION_CACHE_SIZE, DEFAULT_WRITE_BATCH_MAX_DELAY_MS, MAX_WRITE_BATCH_DELAY_MS, PersistenceCoordinator, SessionPersistence, SessionPersistenceRevision } from "@deepseek-ai/dsh-session-persistence";
import { DatabaseSync } from "node:sqlite";
//#region lib/types/schema.js
/**
* Schema + load-time helpers for the SQLite session-persistence backend: the
* DDL (a store-identity row, `sessions` metadata, and a 1:1 `events` row per
* `SessionEvent`), the database open/configure step, and the last-`turn/end`
* cut that gives the SQLite backend the SAME crash-tail-on-load semantics as
* the JSONL backend.
*
* @module dsh-session-persistence-sqlite/schema
*/
/**
* The on-disk schema version. Bumped only on a breaking change to the table
* layout; orthogonal to a session's own `version` (which versions the EVENT
* vocabulary, stored per session in the `sessions` row).
*/
const SCHEMA_VERSION = 15;
/** SQLite application id protecting unrelated databases from persistence writes. */
const SESSION_PERSISTENCE_SQLITE_APPLICATION_ID = 1146308688;
/**
* Open the database and apply its schema and pragmas. An empty database with a
* zero `user_version` is initialized at {@link SCHEMA_VERSION}; a nonempty
* unversioned database and every other non-current version reject rather than
* being migrated in place.
* @param path - the SQLite database file to open (created when absent).
* @param journalMode - validated journal pragma.
* @returns the open handle with pragmas applied and all three tables ensured.
*/
function openDatabase(path, journalMode) {
	const db = new DatabaseSync(path);
	try {
		configureDatabase(db, path, journalMode);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}
function configureDatabase(db, path, journalMode) {
	db.exec("PRAGMA foreign_keys = ON");
	let began = false;
	try {
		db.exec("BEGIN IMMEDIATE");
		began = true;
		const { user_version: onDisk } = db.prepare("PRAGMA user_version").get();
		const { application_id: applicationId } = db.prepare("PRAGMA application_id").get();
		const { count: userObjectCount } = db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'").get();
		if (onDisk === 0 && (applicationId !== 0 || userObjectCount > 0)) throw new Error(`session database at "${path}" has an unversioned schema or application identity`);
		if (onDisk !== 0 && onDisk !== 15) throw new Error(`session database at "${path}" has schema version ${onDisk}, incompatible with this build (15)`);
		if (onDisk === 15 && applicationId !== 1146308688) throw new Error(`session database at "${path}" has application id ${applicationId}, expected ${SESSION_PERSISTENCE_SQLITE_APPLICATION_ID}`);
		db.exec(`
      CREATE TABLE IF NOT EXISTS persistence_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        store_id  TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sessions (
        id               TEXT PRIMARY KEY,
        version          INTEGER NOT NULL,
        created_at       INTEGER NOT NULL,
        cwd              TEXT,
        parent_session   TEXT,
        seed_length      INTEGER,
        origin           TEXT,
        delegation_depth INTEGER,
        agent_preset    TEXT,
        incarnation      TEXT NOT NULL,
        revision         INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS events (
        session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        seq               INTEGER NOT NULL,
        type              TEXT NOT NULL,
        time              INTEGER NOT NULL,
        data              TEXT NOT NULL,
        source_event_seqs TEXT,
        surface_op        TEXT,
        ignorable         INTEGER,
        PRIMARY KEY (session_id, seq)
      ) STRICT
    `);
		db.prepare("INSERT OR IGNORE INTO persistence_state (singleton, store_id) VALUES (1, ?)").run(randomUUID());
		if (onDisk === 0) {
			db.exec(`PRAGMA application_id = ${SESSION_PERSISTENCE_SQLITE_APPLICATION_ID}`);
			db.exec(`PRAGMA user_version = 15`);
		}
		db.exec("COMMIT");
		began = false;
	} catch (error) {
		/* v8 ignore next -- a BEGIN failure leaves no transaction to roll back. */
		if (began)
 /* v8 ignore next 5 -- preserve the original schema failure if SQLite also refuses rollback. */
		try {
			db.exec("ROLLBACK");
		} catch {}
		throw error;
	}
	db.exec(`PRAGMA journal_mode = ${journalMode.toUpperCase()}`);
}
/**
* Reconstruct the {@link SessionHeader} from a `sessions` row.
* @param row - the `sessions` table row.
* @returns the header, `NULL` columns mapped to omitted optional fields.
*/
function rowToMeta(row) {
	if (!Number.isSafeInteger(row.created_at) || row.created_at < 0) throw new Error("stored session createdAt must be a non-negative safe integer");
	return {
		version: row.version,
		id: row.id,
		createdAt: row.created_at,
		...row.cwd !== null ? { cwd: row.cwd } : {},
		...row.parent_session !== null ? { parentSession: row.parent_session } : {},
		...row.seed_length !== null ? { seedLength: row.seed_length } : {},
		...row.origin !== null ? { origin: row.origin } : {},
		...row.delegation_depth !== null ? { delegationDepth: row.delegation_depth } : {},
		...row.agent_preset !== null ? { agentPreset: row.agent_preset } : {}
	};
}
/**
* Reconstruct a {@link SessionEvent} from an `events` row (parses `data`).
* @param row - the `events` table row; `data` and the surface columns hold JSON text.
* @returns the reconstructed event; throws when a JSON column fails to parse
*   ({@link scanRows} treats that as a hole, not corruption, in the tail).
*/
function rowToEvent(row) {
	const surfaceFields = {
		...row.source_event_seqs !== null ? { sourceEventSeqs: JSON.parse(row.source_event_seqs) } : {},
		...row.surface_op !== null ? { surfaceOp: JSON.parse(row.surface_op) } : {}
	};
	const ignorableField = row.ignorable === 1 ? { ignorable: true } : {};
	return {
		type: row.type,
		seq: row.seq,
		time: row.time,
		data: JSON.parse(row.data),
		...surfaceFields,
		...ignorableField
	};
}
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
function scanRows(rows, base = 0) {
	const parsed = rows.map((row) => {
		try {
			return {
				ok: true,
				event: rowToEvent(row)
			};
		} catch {
			return { ok: false };
		}
	});
	let lastTurnEnd = -1;
	for (let i = parsed.length - 1; i >= 0; i--) if (parsed[i]?.ok && rows[i]?.type === "turn/end") {
		lastTurnEnd = i;
		break;
	}
	const preserved = [];
	for (let i = 0; i < rows.length; i++) {
		const p = parsed[i];
		if (!p?.ok || p.event === void 0) {
			if (i <= lastTurnEnd) throw new Error(`corrupt session log: unparsable committed event at seq ${rows[i]?.seq}`);
			break;
		}
		if (p.event.seq !== base + i) {
			if (i <= lastTurnEnd) throw new Error(`corrupt session log: seq gap in committed region (expected ${base + i}, got ${p.event.seq})`);
			break;
		}
		preserved.push(p.event);
	}
	return preserved.length < rows.length ? {
		preserved,
		tornFrom: base + preserved.length
	} : { preserved };
}
//#endregion
//#region lib/types/index.js
/**
* SQLite durable session-persistence backend. It maps each session header and
* event to rows, and delegates write-path orchestration to
* {@link PersistenceCoordinator}. It has no independent per-session artifact,
* so its locator returns `undefined`.
* @module @deepseek-ai/dsh-session-persistence-sqlite
*/
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
		se.surfaceOp !== void 0 ? JSON.stringify(se.surfaceOp) : null,
		event.ignorable === true ? 1 : null
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
		await (await open(path, "wx", 384)).close();
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
	}
}
/**
* The SQLite persistence backend. Load as a plugin; it registers as
* `ctx.sessionPersistence` and (via the coordinator) installs the write-path
* listeners. Its torn-tail marker is the seq to delete from.
*/
var SqliteSessionPersistence = class extends SessionPersistence {
	config;
	supportsRawArtifacts = false;
	static inject = ["sessions"];
	static Config = z.object({
		path: z.string().required(),
		journalMode: z.union([
			"wal",
			"delete",
			"truncate",
			"persist"
		]).default("wal"),
		preparedSessionCacheSize: z.number().step(1).min(1).default(DEFAULT_PREPARED_SESSION_CACHE_SIZE),
		writeBatchMaxDelayMs: z.number().step(1).min(1).max(MAX_WRITE_BATCH_DELAY_MS).default(DEFAULT_WRITE_BATCH_MAX_DELAY_MS)
	});
	/**
	* Backend label for the coordinator's dispose diagnostics. Intentionally
	* shadows cordis `Service.name` (set to `'sessionPersistence'` by the base);
	* see the JSONL backend for why this does not affect service resolution.
	*/
	name = "session-persistence-sqlite";
	db;
	storeIdentity;
	ready;
	coordinator;
	constructor(ctx, config) {
		super(ctx);
		this.config = config;
		const preparedSessionCacheSize = config.preparedSessionCacheSize ?? DEFAULT_PREPARED_SESSION_CACHE_SIZE;
		const writeBatchMaxDelayMs = config.writeBatchMaxDelayMs ?? DEFAULT_WRITE_BATCH_MAX_DELAY_MS;
		this.ready = this.openDb(config.path, config.journalMode);
		this.coordinator = new PersistenceCoordinator(this.ctx, this, {
			preparedSessionCacheSize,
			writeBatchMaxDelayMs
		});
	}
	async openDb(path, journalMode) {
		const actual = path === ":memory:" ? path : resolve(path);
		if (actual !== ":memory:") {
			await mkdir(dirname(actual), {
				recursive: true,
				mode: 448
			});
			await createDatabaseFile(actual);
		}
		this.db = openDatabase(actual, journalMode);
		try {
			const row = this.db.prepare("SELECT store_id FROM persistence_state WHERE singleton = 1").get();
			/* v8 ignore next -- openDatabase inserts the singleton before returning. */
			if (row === void 0) throw new Error(`session database at "${actual}" has no store identity`);
			if (row.store_id.length === 0) throw new Error(`session database at "${actual}" has no valid store identity`);
			if (actual !== ":memory:") {
				const identity = statSync(actual, { bigint: true });
				this.storeIdentity = `file:${identity.dev}:${identity.ino}:${identity.birthtimeNs}:store:${row.store_id}`;
			} else this.storeIdentity = `memory:store:${row.store_id}`;
		} catch (error) {
			this.db.close();
			throw error;
		}
	}
	/** SQLite has one database, not an independent local artifact per session. */
	locate(_meta) {}
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
		return row === void 0 ? void 0 : sqliteRevision(this.storeIdentity, row);
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
		if (row === void 0) return void 0;
		const meta = rowToMeta(row);
		const eventRows = this.db.prepare("SELECT seq, type, time, data, source_event_seqs, surface_op, ignorable FROM events WHERE session_id = ? AND seq >= ? ORDER BY seq").all(id, fromSeq);
		signal?.throwIfAborted();
		const { preserved } = scanRows(eventRows, fromSeq);
		return {
			meta,
			events: preserved
		};
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
		this.db.exec("BEGIN");
		let snapshot;
		try {
			const row = this.rowFor(id);
			if (row !== void 0) snapshot = {
				row,
				eventRows: this.db.prepare("SELECT seq, type, time, data, source_event_seqs, surface_op, ignorable FROM events WHERE session_id = ? ORDER BY seq").all(id)
			};
			this.db.exec("COMMIT");
		} catch (error) {
			/* v8 ignore start -- synchronous read failures only need transaction cleanup before propagation. */
			this.db.exec("ROLLBACK");
			throw error;
		}
		signal?.throwIfAborted();
		if (snapshot === void 0) return void 0;
		const { row, eventRows } = snapshot;
		const { preserved, tornFrom } = scanRows(eventRows);
		return {
			meta: rowToMeta(row),
			events: preserved,
			revision: sqliteRevision(this.storeIdentity, row),
			...tornFrom !== void 0 ? { tornMarker: tornFrom } : {}
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
		const insertEvent = this.db.prepare("INSERT INTO events (session_id, seq, type, time, data, source_event_seqs, surface_op, ignorable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
		this.db.exec("BEGIN");
		try {
			if (!isMaterialized) this.writeRow(meta);
			for (const event of events) {
				const [surfaceSeqs, surfaceOp, ignorable] = envelopeBindings(event);
				insertEvent.run(meta.id, event.seq, event.type, event.time, JSON.stringify(event.data), surfaceSeqs, surfaceOp, ignorable);
			}
			this.db.prepare("UPDATE sessions SET revision = revision + 1 WHERE id = ?").run(meta.id);
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
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
		this.db.exec("BEGIN");
		try {
			if (tornMarker !== void 0) this.db.prepare("DELETE FROM events WHERE session_id = ? AND seq >= ?").run(meta.id, tornMarker);
			if (closers.length > 0) {
				const insertEvent = this.db.prepare("INSERT INTO events (session_id, seq, type, time, data, source_event_seqs, surface_op, ignorable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
				for (const event of closers) {
					const [surfaceSeqs, surfaceOp, ignorable] = envelopeBindings(event);
					insertEvent.run(meta.id, event.seq, event.type, event.time, JSON.stringify(event.data), surfaceSeqs, surfaceOp, ignorable);
				}
			}
			if (tornMarker !== void 0 || closers.length > 0) this.db.prepare("UPDATE sessions SET revision = revision + 1 WHERE id = ?").run(meta.id);
			this.db.exec("COMMIT");
		} catch (error) {
			/* v8 ignore start */
			this.db.exec("ROLLBACK");
			throw error;
		}
	}
	/** List all materialized sessions' metadata (every row is a materialized session). */
	async list(signal) {
		signal?.throwIfAborted();
		await this.ready;
		signal?.throwIfAborted();
		const rows = this.db.prepare("SELECT * FROM sessions").all();
		signal?.throwIfAborted();
		return rows.map(rowToMeta);
	}
	/** List metadata with a source-qualified monotonic revision per session. */
	async listSnapshots(signal) {
		signal?.throwIfAborted();
		await this.ready;
		signal?.throwIfAborted();
		const rows = this.db.prepare("SELECT * FROM sessions").all();
		signal?.throwIfAborted();
		return rows.map((row) => ({
			header: rowToMeta(row),
			revision: SessionPersistenceRevision(`${this.storeIdentity}:incarnation:${row.incarnation}:revision:${row.revision}`)
		}));
	}
	/** Close the database handle (awaited by the coordinator's dispose, post-drain). */
	async close() {
		await this.ready;
		this.db.close();
	}
	/** Fetch a session's row, or undefined if absent. */
	rowFor(id) {
		return this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
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
};
//#endregion
export { SCHEMA_VERSION, SqliteSessionPersistence, SqliteSessionPersistence as default };
