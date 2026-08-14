/** Cross-platform native path and text-document openers used by the local GUI carrier. */
import { type NativeCommandRunner } from '@deepseek-ai/dsh-native-command';
/** Testable command boundary; native implementations never invoke a shell. */
export type PathOpenerRunner = NativeCommandRunner;
/** Injectable platform facts for deterministic adapter tests. */
export interface PathOpenerInternals {
    platform?: NodeJS.Platform;
    run?: PathOpenerRunner;
}
/**
 * Open a filesystem path with the operating system's default application.
 * @param path - absolute or host-resolvable path (caller owns resolution).
 * @param signal - caller/connection lifetime; abort terminates the native command.
 * @param internals - platform and runner seam for deterministic tests.
 */
export declare function openNativePath(path: string, signal: AbortSignal, internals?: PathOpenerInternals): Promise<void>;
/**
 * Open a text document for editing; macOS bypasses the file-type association
 * so a YAML association with a browser cannot consume the gesture.
 * @param path - absolute or host-resolvable text-document path.
 * @param signal - caller/connection lifetime; abort terminates the native command.
 * @param internals - platform and runner seam for deterministic tests.
 */
export declare function openNativeTextFile(path: string, signal: AbortSignal, internals?: PathOpenerInternals): Promise<void>;
//# sourceMappingURL=native-path-opener.d.ts.map