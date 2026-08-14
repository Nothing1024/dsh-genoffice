/**
 * Adaptive chooser of the directory-picker seam: resolves the host's
 * situation once at boot (bind host, SSH launch, display session, Linux
 * chooser binary) and mounts the matching dual-face backend — `-native` or
 * `-browse` — as a real Loader entry in the in-memory root tree. Because the
 * backend arrives as an ordinary entry, its browser half is discovered
 * exactly as a config-row's would be, so the seam's one-row-swaps-both-faces
 * invariant holds for the resolved choice; pinning an interaction remains
 * composing that backend row directly instead of this one.
 * @module @deepseek-ai/dsh-host-directory-picker-auto
 */
import type { Context } from 'cordis';
import type { DirectoryPickerBackendKind } from './resolve.ts';
export { canExecute, hasLinuxChooserBinary } from './probe.ts';
export type { DirectoryPickerBackendKind, DirectoryPickerEnv, DirectoryPickerHostFacts } from './resolve.ts';
export { resolveDirectoryPickerBackend } from './resolve.ts';
/** Cordis plugin name. */
export declare const name = "directory-picker-auto";
/** Required services: the effective bind host (`httpServer`) and the entry tree the backend mounts into (`loader`). */
export declare const inject: string[];
/**
 * Backend package per resolved kind — fixed composition vocabulary, not a
 * tunable. Exported because the reference is a runtime string the static
 * config gate cannot see in a yml row: `verify-cordis-config` requires every
 * app composing this chooser to declare both values as dependencies.
 */
export declare const BACKEND_PACKAGES: Record<DirectoryPickerBackendKind, string>;
/**
 * Resolve the backend from one boot-time sample and mount it as a Loader
 * entry; the effect's disposer removes the entry and joins the backend
 * fiber's teardown, so unloading this plugin returns only after both faces
 * of the mounted backend (and their dependents) quiesced.
 * @param ctx - cordis context carrying the injected `httpServer` and `loader`.
 */
export declare function apply(ctx: Context): Promise<void>;
//# sourceMappingURL=index.d.ts.map