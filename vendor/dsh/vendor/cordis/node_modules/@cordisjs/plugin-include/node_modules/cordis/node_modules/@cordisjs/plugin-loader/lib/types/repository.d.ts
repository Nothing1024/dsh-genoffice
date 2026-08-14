/**
 * Exact-specifier repository packages installed through the Loader's bundled
 * pnpm. The caller owns source validation and the cache root; this module owns
 * isolated installation, single-flight reuse, and atomic cache publication.
 */
/** Exact pnpm release shipped with the Loader for repository installation. */
export declare const BUNDLED_PNPM_VERSION = "11.7.0";
/** Injectable isolated-install boundary used by {@link RepositoryCache}. */
export type RepositoryInstall = (directory: string) => Promise<void>;
/**
 * Persistent exact-specifier package cache backed by bundled pnpm.
 *
 * One isolated project contains one dependency named `repository`. A successful
 * install is atomically renamed into its SHA-256 key, so failed installs never
 * become cache hits. The exact specifier is immutable: callers change the
 * specifier (normally its Git ref) to request another generation.
 */
export declare class RepositoryCache {
    private readonly install;
    /** Absolute directory containing immutable repository cache entries. */
    readonly directory: string;
    private readonly tasks;
    /**
     * @param directory - caller-owned persistent cache root.
     * @param install - isolated package installation boundary; defaults to the bundled pnpm.
     */
    constructor(directory: string, install?: RepositoryInstall);
    /**
     * Resolve one package-manager-native dependency specifier to its installed package directory.
     * @param specifier - exact immutable dependency specifier used as the permanent cache identity.
     * @returns the installed `repository` dependency directory.
     * @throws when the specifier is empty/padded, installation fails, or a published cache entry is corrupt.
     */
    resolve(specifier: string): Promise<string>;
    private resolveUncached;
}
//# sourceMappingURL=repository.d.ts.map