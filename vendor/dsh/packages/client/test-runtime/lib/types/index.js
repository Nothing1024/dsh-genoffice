/**
 * jsdom slot test runtime: a real small runtime — Cordis `Context`, the
 * runtime `SlotsService`, and the web-react renderer — assembled around
 * test-owned session/workspace doubles, so feature specs exercise
 * declaration, registration, scope, store, inject, rendering, updates, and
 * disposal without hand-building the machinery per suite.
 *
 * Not part of the product plugin graph (no `dshClient`); feature packages
 * depend on it in devDependencies only. It copies no SlotCore/renderer/store
 * machinery — everything mounts the production implementations.
 * @module @deepseek-ai/dsh-client-test-runtime
 */
/* oxlint-disable typescript/no-redundant-type-constituents --
 * `keyof SlotMap & string` is the declare-merge key pattern (see ui-slots):
 * this compilation unit sees only the runtime's 'root' row, but consumer
 * programs merge their own keys in; the rule fires on the narrow-map view. */
import { Context, Inject } from 'cordis';
import { createElement, Fragment, useSyncExternalStore } from 'react';
import { act, render, within } from '@testing-library/react';
import { SlotsService } from '@deepseek-ai/dsh-client-runtime/client';
import { createSlotRenderer } from '@deepseek-ai/dsh-client-web-react';
import { registerDomSnapshotSerializer } from "./snapshot.js";
import { TestSessions } from "./sessions.js";
import { TestWorkspaces } from "./workspaces.js";
export { domSnapshotSerializer, registerDomSnapshotSerializer } from "./snapshot.js";
export { FixtureSession, TestSessions } from "./sessions.js";
export { TestWorkspaces } from "./workspaces.js";
export { conversationSnapshot, workspaceListState } from "./fixtures.js";
export { makeTranslate } from "./translate.js";
export { usePinnedBrowserLanguages } from "./locale-env.js";
/**
 * Owner-props cell behind the auto frame: one external store the frame
 * subscribes to, so {@link SlotTestRuntime.renderSlot} and
 * {@link SlotView.update} drive React through the standard uSES seam.
 */
class OwnerPropsCell {
    owners = new Map();
    listeners = new Set();
    version = 0;
    /** Snapshot version for uSES pairing (bumped on every set). */
    getVersion = () => this.version;
    /**
     * Subscribe to owner-props changes.
     * @param fn - change callback.
     * @returns unsubscribe.
     */
    subscribe = (fn) => {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    };
    /**
     * Install or replace one key's owner props and notify (synchronous; the
     * caller wraps in act).
     * @param key - slot key.
     * @param owner - owner props share.
     */
    set(key, owner) {
        this.owners.set(key, owner);
        this.version += 1;
        for (const fn of [...this.listeners])
            fn();
    }
    /** Keys with supplied owner props, in first-supply order. */
    entries() {
        return [...this.owners.entries()];
    }
}
/**
 * The test-owned 'root' occupant: declares the child slots a suite needs
 * through the REAL `slots.register`, with a caller-supplied minimal frame —
 * the runtime never guesses a feature's page structure.
 */
export class TestRoot {
    slots;
    stabilize;
    disposeEntry;
    /**
     * @param slots - the runtime SlotsService.
     * @param stabilize - the owning runtime's act wrapper.
     */
    constructor(slots, stabilize) {
        this.slots = slots;
        this.stabilize = stabilize;
    }
    /**
     * Register the root frame, declaring (and thereby claiming) the child
     * slots. One declaration per runtime — a second call fails loud in the
     * core ('root' is a single slot).
     * @param children - child-slot declaration table (declaration + render authorization + runtime spec).
     * @param frame - minimal frame component; its props derive from the declared keys (composed-props contract).
     * @returns completion of the act-wrapped registration.
     */
    async declare(children, frame) {
        await this.stabilize(() => {
            // Erased hop (same pattern as SlotsService's own implementation arm);
            // the declare signature above is the typed seam.
            this.disposeEntry = this.slots.register({ name: 'root', children }, frame);
        });
    }
    /** Remove the root registration and collapse its declarations (runtime dispose path). */
    release() {
        this.disposeEntry?.();
        this.disposeEntry = undefined;
    }
}
/**
 * The assembled test runtime. Obtain via {@link SlotTestRuntime.create};
 * dispose with {@link SlotTestRuntime.dispose} (afterEach). Public mutators
 * are act-wrapped throughout — tests never handle SlotCore microtask
 * batching or React act themselves.
 */
export class SlotTestRuntime {
    /** The runtime's Cordis root (escape hatch: extra services via `ctx.provide`, raw `ctx.plugin` mounts). */
    ctx;
    /** The production SlotsService mounted on {@link SlotTestRuntime.ctx}. */
    slots;
    /** The test-owned 'root' occupant. */
    root;
    /** Sessions double (list/current observable, cells, scopes, behavior faces). */
    sessions;
    /** Workspaces double (list observable, recorded intent actions). */
    workspaces;
    stabilizer = async (fn) => {
        await act(async () => { await fn(); });
    };
    host;
    views = [];
    handles = [];
    disposed = false;
    /** Auto-frame state ({@link SlotTestRuntime.declare} / {@link SlotTestRuntime.renderSlot}). */
    ownerCell = new OwnerPropsCell();
    autoDeclared = new Set();
    autoRootView;
    constructor(ctx, slots) {
        this.ctx = ctx;
        this.slots = slots;
        this.root = new TestRoot(slots, this.stabilizer);
        this.sessions = new TestSessions(this.stabilizer, ctx);
        this.workspaces = new TestWorkspaces(this.stabilizer);
        ctx.provide('sessions', this.sessions);
        ctx.provide('workspaces', this.workspaces);
        // Capturing install: the production renderer does the rendering; the
        // wrapper only takes the host face for storeOf (no machinery copied).
        const renderer = createSlotRenderer();
        slots.install({
            renderRoot: (host, ownerProps) => {
                this.host = host;
                return renderer.renderRoot(host, ownerProps);
            },
        });
    }
    /**
     * Assemble a runtime: real Context, mounted SlotsService, installed
     * renderer, and the session/workspace doubles provided as services.
     * @returns the ready runtime.
     */
    static async create() {
        registerDomSnapshotSerializer();
        const ctx = new Context();
        const fiber = ctx.plugin(SlotsService);
        await fiber.await();
        return new SlotTestRuntime(ctx, ctx.get('slots'));
    }
    /**
     * Provide an extra service the feature under test injects (e.g. a layout
     * fake). Sugar over `ctx.provide`, typed against the Context declaration
     * merge: for a declared service name the fake must be a subset of that
     * service's outward face (Partial — supply only what the feature calls),
     * so a production face change breaks the fake at compile time. Undeclared
     * names stay unchecked (ad-hoc test services).
     * @param name - service name.
     * @param value - service implementation (test double).
     */
    provide(name, value) {
        this.ctx.provide(name, value);
    }
    /**
     * Mount a feature plugin on a real fiber. Required services are prechecked
     * so a missing provider fails loud instead of suspending the fiber forever
     * (deliberate load-order suspension tests use `ctx.plugin` directly).
     * @param plugin - plugin value (function, class, or `{ inject, apply }` object).
     * @returns handle owning the fiber's explicit disposal.
     */
    async mount(plugin) {
        const required = Object.keys(Inject.resolve(plugin.inject));
        const missing = required.filter(name => this.ctx.get(name) === undefined);
        if (missing.length > 0) {
            throw new Error(`mount would suspend: missing service(s) ${missing.join(', ')} — provide() them first`);
        }
        const fiber = this.ctx.plugin(plugin);
        await this.stabilizer(async () => {
            await fiber.await();
        });
        let disposed = false;
        const handle = {
            fiber,
            dispose: async () => {
                if (disposed)
                    return;
                disposed = true;
                await this.stabilizer(() => { return fiber.dispose(); });
            },
        };
        this.handles.push(handle);
        return handle;
    }
    /**
     * Render the root slot tree through the ctx-level entry (the shell's own
     * seam): `ctx.slots.renderSlot('root', {})` under Testing Library.
     * @returns the Testing Library view.
     */
    renderRoot() {
        const view = render(createElement(Fragment, null, this.slots.renderSlot('root', {})));
        this.views.push(view);
        return view;
    }
    /**
     * Declare child slots under an auto-generated root frame — the single-slot
     * mounting path for local DOM snapshots. Each key later supplied through
     * {@link SlotTestRuntime.renderSlot} renders inside its own
     * `<div data-slot="<key>">` wrapper (the snapshot root). Mutually exclusive
     * with {@link TestRoot.declare} ('root' is a single slot); one call per
     * runtime.
     * @param children - child-slot declaration table (same contract as TestRoot.declare).
     * @returns completion of the act-wrapped registration.
     */
    async declare(children) {
        for (const key of Object.keys(children))
            this.autoDeclared.add(key);
        const cell = this.ownerCell;
        const AutoFrame = (props) => {
            useSyncExternalStore(cell.subscribe, cell.getVersion);
            return createElement(Fragment, null, cell.entries().map(([key, owner]) => createElement('div', { 'data-slot': key, key }, props.renderSlot(key, owner))));
        };
        await this.root.declare(children, AutoFrame);
    }
    /**
     * Render one declared slot with its owner props and return the local view.
     * The whole root tree mounts through the production assembly path
     * (renderer, scope providers, store axis); only this key's output lands in
     * the returned container. Call again with another key to view a sibling
     * slot of the same tree.
     * @param key - a key declared through {@link SlotTestRuntime.declare}.
     * @param owner - owner props share for the render site.
     * @returns the slot-local view (snapshot container, scoped queries, owner updates).
     */
    renderSlot(key, owner) {
        if (!this.autoDeclared.has(key)) {
            throw new Error(`renderSlot('${key}') without declare() — declare the key first (or use root.declare for a custom frame)`);
        }
        const install = (next) => {
            // Synchronous cell write inside act: the frame re-renders through uSES.
            act(() => {
                this.ownerCell.set(key, next);
            });
        };
        install(owner);
        this.autoRootView ??= this.renderRoot();
        const container = this.autoRootView.container.querySelector(`[data-slot="${key}"]`);
        if (!(container instanceof HTMLElement)) {
            throw new Error(`renderSlot('${key}'): the auto frame rendered no wrapper — was the runtime already disposed?`);
        }
        return { container, view: within(container), update: install };
    }
    /**
     * Resolve the store instance the renderer would hand a slot's component
     * (identity assertions, action-driven writes). Requires a prior
     * {@link SlotTestRuntime.renderRoot} — the host face exists only inside the
     * installed renderer, exactly as in production.
     * @param key - slot key whose first entry declares the store.
     * @param scopeKey - session id for session-scope slots; omit for root scope.
     * @returns the live store instance.
     */
    storeOf(key, scopeKey) {
        if (this.host === undefined) {
            throw new Error('storeOf before renderRoot() — the host face exists only inside the installed renderer');
        }
        const entry = this.host.entriesOf(key)[0];
        if (entry === undefined)
            throw new Error(`storeOf('${key}'): no registration on the ledger`);
        const instance = this.host.storeOf(entry, scopeKey);
        if (instance === undefined)
            throw new Error(`storeOf('${key}'): the entry declares no store`);
        return instance;
    }
    /**
     * Flush pending ledger/store notifications inside act — for mutations made
     * outside the runtime's own methods (e.g. a direct `slots.register`).
     * @returns completion of the act pass.
     */
    async flush() {
        await this.stabilizer(() => { });
    }
    /**
     * Tear down: unmount React trees first, then dispose feature fibers, the
     * root registration, minted session scopes, and persisted test state.
     * Idempotent.
     * @returns completion of the teardown.
     */
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.autoRootView = undefined;
        for (const view of this.views.splice(0))
            view.unmount();
        for (const handle of this.handles.splice(0))
            await handle.dispose();
        this.root.release();
        await this.sessions.disposeScopes();
        localStorage.clear();
    }
}
//# sourceMappingURL=index.js.map