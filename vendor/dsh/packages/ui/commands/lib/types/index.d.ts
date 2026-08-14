/**
 * Plugin-owned human-command registry shared by interactive UI adapters.
 * @module @deepseek-ai/dsh-commands
 */
import { Context, Service } from 'cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { CommandId } from './brand.ts';
export { CommandId } from './brand.ts';
export declare const name = "commands";
/**
 * Producer record for one command invocation (the `command/run` event's
 * provenance slot). Merge-extensible sum type mirroring `MessageSourceMap`'s
 * shape; minimal today because every executor caller is a human-facing UI
 * surface dispatching a human-typed line, so the sole variant is `user`.
 */
export interface CommandSourceMap {
    user: {
        kind: 'user';
    };
}
/** The union over {@link CommandSourceMap} — who issued a command line. */
export type CommandSource = CommandSourceMap[keyof CommandSourceMap];
/** Immutable metadata for a command's optional unstructured input. */
export interface CommandInputDescriptor {
    /** Placeholder shown before the user supplies free-form input. */
    readonly hint: string;
}
/** Invocation passed to one registered command handler. */
export interface CommandInvocation {
    /** Exact agent whose human-facing surface received the command. */
    readonly agent: Agent;
    /** Exact text following the registered command name, including separator whitespace. */
    readonly rawInput: string;
    /** Cancellation signal owned by the dispatching UI request. */
    readonly signal: AbortSignal;
}
/** Expected command outcome rendered directly by the dispatching UI. */
export type CommandResult = {
    readonly kind: 'success';
    readonly text?: string;
} | {
    readonly kind: 'error';
    readonly text: string;
};
/**
 * One settled command execution: the handler's normalized result plus the
 * lifecycle pairing id minted for its `command/run`/`command/done` records,
 * so a dispatching surface can correlate the RPC-level acknowledgment with
 * the flow node those events produce.
 */
export interface CommandExecution {
    /** Pairing id carried by this execution's lifecycle events. */
    readonly commandId: CommandId;
    /** The handler's normalized outcome. */
    readonly result: CommandResult;
}
/** Plugin-owned command registration. */
export interface CommandDefinition {
    /** Lowercase command name without the leading slash. */
    readonly name: string;
    /** Human-readable summary used in discovery UI. */
    readonly description: string;
    /** Optional free-form input hint advertised to capable clients. */
    readonly input?: CommandInputDescriptor;
    /** Execute against the receiving agent without sending the command to the model. */
    readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>;
}
/** Handler-free immutable command view returned to UI adapters. */
export interface CommandDescriptor {
    /** Lowercase command name without the leading slash. */
    readonly name: string;
    /** Human-readable summary used in discovery UI. */
    readonly description: string;
    /** Optional free-form input hint advertised to capable clients. */
    readonly input?: CommandInputDescriptor;
}
/** Syntactically valid slash command before registry resolution. */
export interface ParsedCommand {
    /** Lowercase command name without the leading slash. */
    readonly name: string;
    /** Exact text following the command name. */
    readonly rawInput: string;
}
declare module '@deepseek-ai/dsh-session' {
    interface SessionEventMap {
        /**
         * A resolved slash command entered its handler. Log-only (never model
         * surface); paired with `command/done` by `commandId`, mirroring the
         * `tool/call`↔`tool/result` pairing. The payload is structured — `name`
         * and `args` are `parseCommand`'s own split (name and verbatim rawInput,
         * separator whitespace included), so a consumer (a projection unit
         * folding its own command records, a rich command card) never re-parses
         * a line.
         */
        'command/run': {
            commandId: CommandId;
            name: string;
            args: string;
            source: CommandSource;
        };
        /**
         * The paired command settled. `kind`/`text` carry the handler's verbatim
         * outcome (a thrown/aborted handler settles as `kind: 'error'` with the
         * rendered failure); presentation stays client-computed at render time.
         */
        'command/done': {
            commandId: CommandId;
            kind: 'success' | 'error';
            text?: string;
        };
    }
}
declare module 'cordis' {
    interface Context {
        commands: CommandService;
    }
    interface Events {
        /**
         * A command was registered or unregistered. This is an unfiltered registry
         * notification because a global or scoped change may affect any UI view.
         * Observer failures are contained and cannot veto the registry mutation.
         * @mode emit
         */
        'commands/change'(): void;
    }
}
/**
 * Parse an exact slash command without normalizing its trailing input.
 *
 * @param line - Complete candidate command line.
 * @returns The parsed command, or `undefined` when the line is not a command.
 */
export declare function parseCommand(line: string): ParsedCommand | undefined;
/**
 * Human-command registry. Plain-context definitions are global; definitions
 * registered through a command-injected child of an agent context shadow
 * globals for that agent.
 */
export declare class CommandService extends Service {
    private readonly layers;
    /** Monotonic per-instance counter behind {@link mintCommandId}. */
    private commandSeq;
    /** Instance token keeping minted ids unique across process restarts over one resumed log. */
    private readonly instanceToken;
    constructor(ctx: Context);
    /**
     * Register a global or calling-agent-scoped command.
     * @param definition - discovery metadata and direct UI handler.
     * @returns the exact effect disposer that unregisters this definition.
     */
    register(definition: CommandDefinition): () => void;
    /**
     * List the effective immutable command descriptors for one agent.
     * @param agent - exact receiving agent and scoped-layer key.
     * @returns name-sorted descriptors after scoped shadowing.
     */
    list(agent: Agent): readonly CommandDescriptor[];
    /**
     * Resolve one effective command definition.
     * @param agent - exact receiving agent and scoped-layer key.
     * @param name - command name without a slash.
     * @returns the scoped shadow or global definition.
     */
    find(agent: Agent, name: string): CommandDefinition | undefined;
    /**
     * Parse and execute a known command without sending it to the model.
     *
     * A resolved command's lifecycle is logged: `command/run` is appended
     * before the handler is invoked and `command/done` after settlement (a
     * thrown or aborted handler settles as `kind: 'error'`). Both are direct
     * log-only appends — no turn wraps them, and persistence drains them at
     * ordinary checkpoints. Admission misses (syntax or unknown name) log
     * nothing — they never entered a handler. A `command/run` append failure
     * fails the execution loud; a `command/done` append failure on the
     * handler-failure path is contained so the handler's own error stays the
     * reported failure.
     *
     * @param agent - exact receiving agent.
     * @param line - complete slash-command line.
     * @param signal - cancellation signal owned by the UI request.
     * @returns the settled execution (result + lifecycle pairing id), or
     *   `undefined` when syntax or name does not resolve.
     */
    execute(agent: Agent, line: string, signal: AbortSignal): Promise<CommandExecution | undefined>;
    /** Mint the next pairing id (monotonic; instance-token-prefixed so a resumed log never repeats one). */
    private mintCommandId;
    /**
     * Append one log-only lifecycle event directly: no turn is opened for it and
     * no flush is forced — persistence observes the eager `session/event` path
     * and drains at ordinary checkpoints and teardown, like every other
     * standalone plugin event.
     */
    private appendLifecycle;
    /** Resolve global definitions followed by exact scoped shadows. */
    private view;
    /** Notify every registry observer without making UI refresh load-bearing. */
    private notifyChange;
}
export default CommandService;
//# sourceMappingURL=index.d.ts.map