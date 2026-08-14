/**
 * Optional tsdown (rolldown) plugin face of the typert generator. When added
 * to a workspace tsdown config, it runs after each opted-in package bundle is
 * written and re-emits its model-driven face artifact at the package output
 * root. Packages without a Typert export are skipped.
 * @module @deepseek-ai/dsh-typert-generator/tsdown
 */
/** The subset of the rolldown output-plugin contract this plugin uses (structural; avoids a rolldown type dependency). */
interface TypertPlugin {
    name: string;
    writeBundle: (options: {
        dir?: string;
    }) => void;
}
/**
 * Create the typert generation plugin for the root tsdown config.
 * @returns a rolldown-compatible plugin that emits `lib/typert.<face>.js` and `.d.ts` for contributing packages.
 */
export declare function typertPlugin(): TypertPlugin;
export {};
//# sourceMappingURL=tsdown-plugin.d.ts.map