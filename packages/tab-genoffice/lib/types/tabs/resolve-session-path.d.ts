export type SessionCwdMap = Record<string, {
    cwd?: string;
} | undefined>;
export type ResolveSessionPathResult = {
    status: 'ready';
    path: string;
} | {
    status: 'waiting';
    reason: 'sessions-pending';
} | {
    status: 'error';
    error: 'malformed-address' | 'unknown-session' | 'missing-cwd';
    message: string;
};
export declare function resolveSessionFilePath(address: string, options?: {
    byId?: SessionCwdMap;
    sessionsPending?: boolean;
}): ResolveSessionPathResult;
//# sourceMappingURL=resolve-session-path.d.ts.map