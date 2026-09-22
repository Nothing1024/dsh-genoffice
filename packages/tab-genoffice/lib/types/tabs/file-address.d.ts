/**
 * Local copy of the official `dsh-resource://file/…` grammar.
 *
 * `@deepseek-ai/dsh-util-workspace-path` is not a frozen platform module, so
 * the client bundle cannot import it at runtime. The encoding rules match
 * 0.1.7-alpha.1 (`:` stays literal; session vs absolute scopes).
 */
export type FileAddress = {
    readonly scope: 'session';
    readonly sessionId: string;
    readonly path: string;
} | {
    readonly scope: 'absolute';
    readonly path: string;
};
/** `dsh-resource://file/session/<sessionId>/<path>`. */
export declare function sessionFileAddress(sessionId: string, path: string): string;
/** `dsh-resource://file/absolute/<path>` (leading `/` dropped; UNC keeps one empty segment). */
export declare function absoluteFileAddress(path: string): string;
export declare function parseFileAddress(address: string): FileAddress | undefined;
export declare function isAbsoluteWorkspacePath(path: string): boolean;
/**
 * Session-scoped when relative or under cwd; otherwise still session-scoped with
 * the absolute path (matches official `fileAddressFor` — never uses the
 * `absolute` scope from a session-bound opener).
 */
export declare function fileAddressFor(sessionId: string, cwd: string | undefined, path: string): string;
//# sourceMappingURL=file-address.d.ts.map