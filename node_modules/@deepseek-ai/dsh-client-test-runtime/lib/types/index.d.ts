/**
 * jsdom slot test runtime: a real small runtime — Cordis `Context`, the
 * runtime `SlotRegistry`, and the web-react renderer — assembled around
 * test-owned session/workspace doubles, so feature specs exercise
 * declaration, registration, scope, store, inject, rendering, updates, and
 * disposal without hand-building the machinery per suite.
 *
 * Not part of the product plugin graph (no `dsh.client`); feature packages
 * depend on it in devDependencies only. It copies no SlotCore/renderer/store
 * machinery — everything mounts the production implementations.
 * @module @deepseek-ai/dsh-client-test-runtime
 */
import { Context } from '@deepseek-ai/cordis';
import type { Fiber, Plugin } from '@deepseek-ai/cordis';
import type { RenderResult } from '@testing-library/react';
import type { queries } from '@testing-library/dom';
import type { BoundFunctions } from '@testing-library/dom';
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client';
import type { ChildrenDecl, ComposedProps, OwnerOf, SlotComponent, SlotMap, StoreInstanceLike } from '@deepseek-ai/dsh-client-ui-slots';
import { TestSessions } from './sessions.ts';
import { TestWorkspaces } from './workspaces.ts';
import type { Stabilizer } from './fixtures.ts';
export { domSnapshotSerializer, registerDomSnapshotSerializer } from './snapshot.ts';
export { FixtureSession, TestSessions } from './sessions.ts';
export { stubSettingsScope } from './settings-scope.ts';
export type { StubSettingsScope } from './settings-scope.ts';
export { TestWorkspaces } from './workspaces.ts';
export { TestRemote } from './remote.ts';
export { conversationSnapshot, workspaceListState } from './fixtures.ts';
export type { SessionBehaviorOverrides, SessionFixture, Stabilizer } from './fixtures.ts';
export { makeTranslate } from './translate.ts';
export { usePinnedBrowserLanguages } from './locale-env.ts';
/**
 * One rendered slot's local view, from {@link SlotTestRuntime.renderSlot}:
 * the renderer's own `[data-slot]` outlet anchor is the snapshot root
 * (`expect(view.container).toMatchSnapshot()` captures exactly this slot's
 * output), Testing Library queries are bound inside it, and `update`
 * re-renders with new owner props.
 */
export interface SlotView<K extends keyof SlotMap & string> {
    /** The renderer's `<div data-slot="<key>">` anchor around the slot's rendered output. */
    readonly container: HTMLElement;
    /** Testing Library queries scoped to {@link SlotView.container}. */
    readonly view: BoundFunctions<typeof queries>;
    /**
     * Replace the owner props and flush the re-render (the render-site update:
     * in production the owner recomputes the share and React re-renders).
     * @param owner - the next owner props share.
     */
    update(owner: OwnerOf<K>): void;
}
/**
 * Mounted feature plugin handle: the live fiber plus an act-wrapped,
 * idempotent dispose (unload cascade: entries, declared child slots, store
 * instances, and provided services all fall together).
 */
export interface FeatureHandle {
    /** The plugin's live Cordis fiber (state assertions, escape hatch). */
    readonly fiber: Fiber;
    /**
     * Dispose the plugin fiber inside React act; repeated calls no-op.
     * @returns completion of the unload cascade.
     */
    dispose(): Promise<void>;
}
/**
 * The test-owned 'root' occupant: declares the child slots a suite needs
 * through the REAL `slots.register`, with a caller-supplied minimal frame —
 * the runtime never guesses a feature's page structure.
 */
export declare class TestRoot {
    private readonly slots;
    private readonly stabilize;
    private disposeEntry;
    /**
     * @param slots - the runtime SlotRegistry.
     * @param stabilize - the owning runtime's act wrapper.
     */
    constructor(slots: SlotRegistry, stabilize: Stabilizer);
    /**
     * Register the root frame, declaring (and thereby claiming) the child
     * slots. One declaration per runtime — a second call fails loud in the
     * core ('root' is a single slot).
     * @param children - child-slot declaration table (declaration + render authorization + runtime spec).
     * @param frame - minimal frame component; its props derive from the declared keys (composed-props contract).
     * @returns completion of the act-wrapped registration.
     */
    declare<const D extends ChildrenDecl>(children: D, frame: SlotComponent<ComposedProps<'root', never, keyof NoInfer<D> & keyof SlotMap & string, undefined, object>>): Promise<void>;
    /** Remove the root registration and collapse its declarations (runtime dispose path). */
    release(): void;
}
/**
 * The assembled test runtime. Obtain via {@link SlotTestRuntime.create};
 * dispose with {@link SlotTestRuntime.dispose} (afterEach). Public mutators
 * are act-wrapped throughout — tests never handle SlotCore microtask
 * batching or React act themselves.
 */
export declare class SlotTestRuntime {
    /** The runtime's Cordis root (escape hatch: extra services via `ctx.provide`, raw `ctx.plugin` mounts). */
    readonly ctx: Context;
    /** The production SlotRegistry mounted on {@link SlotTestRuntime.ctx}. */
    readonly slots: SlotRegistry;
    /** The test-owned 'root' occupant. */
    readonly root: TestRoot;
    /** Sessions double (list/current observable, cells, scopes, behavior faces). */
    readonly sessions: TestSessions;
    /** Workspaces double (list observable, recorded intent actions). */
    readonly workspaces: TestWorkspaces;
    private readonly stabilizer;
    private host;
    private readonly views;
    private readonly handles;
    private disposed;
    /** Auto-frame state ({@link SlotTestRuntime.declare} / {@link SlotTestRuntime.renderSlot}). */
    private readonly ownerCell;
    private readonly autoDeclared;
    private autoRootView;
    private constructor();
    /**
     * Assemble a runtime: real Context, mounted SlotRegistry, installed
     * renderer, and the session/workspace doubles provided as services.
     * @returns the ready runtime.
     */
    static create(): Promise<SlotTestRuntime>;
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
    provide<K extends string>(name: K, value: K extends keyof Context ? Partial<Context[K]> : unknown): void;
    /**
     * Mount a feature plugin on a real fiber. Required services are prechecked
     * so a missing provider fails loud instead of suspending the fiber forever
     * (deliberate load-order suspension tests use `ctx.plugin` directly).
     * @param plugin - plugin value (function, class, or `{ inject, apply }` object).
     * @returns handle owning the fiber's explicit disposal.
     */
    mount(plugin: Plugin): Promise<FeatureHandle>;
    /**
     * Render the root slot tree through the ctx-level entry (the shell's own
     * entry point): `ctx.slots.renderSlot('root', {})` under Testing Library.
     * @returns the Testing Library view.
     */
    renderRoot(): RenderResult;
    /**
     * Declare child slots under an auto-generated root frame — the single-slot
     * mounting path for local DOM snapshots. Each key later supplied through
     * {@link SlotTestRuntime.renderSlot} renders inside the renderer's own
     * `<div data-slot="<key>">` outlet anchor (the snapshot root — the frame
     * adds no wrapper of its own). Mutually exclusive with
     * {@link TestRoot.declare} ('root' is a single slot); one call per runtime.
     * @param children - child-slot declaration table (same contract as TestRoot.declare).
     * @returns completion of the act-wrapped registration.
     */
    declare(children: ChildrenDecl): Promise<void>;
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
    renderSlot<K extends keyof SlotMap & string>(key: K, owner: OwnerOf<K>): SlotView<K>;
    /**
     * Resolve the store instance the renderer would hand a slot's component
     * (identity assertions, action-driven writes). Requires a prior
     * {@link SlotTestRuntime.renderRoot} — the host face exists only inside the
     * installed renderer, exactly as in production.
     * @param key - slot key whose first entry declares the store.
     * @param scopeKey - session id for session-scope slots; omit for root scope.
     * @returns the live store instance.
     */
    storeOf(key: keyof SlotMap & string, scopeKey?: string): StoreInstanceLike;
    /**
     * Flush pending ledger/store notifications inside act — for mutations made
     * outside the runtime's own methods (e.g. a direct `slots.register`).
     * @returns completion of the act pass.
     */
    flush(): Promise<void>;
    /**
     * Tear down: unmount React trees first, then dispose feature fibers, the
     * root registration, minted session scopes, and persisted test state.
     * Idempotent.
     * @returns completion of the teardown.
     */
    dispose(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map