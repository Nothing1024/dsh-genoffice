/**
 * Optional tsdown (rolldown) plugin face of the typert generator. When added
 * to a workspace tsdown config, it runs after each opted-in package bundle is
 * written and re-emits its model-driven face artifact at the package output
 * root. Packages without a Typert export are skipped.
 * @module @deepseek-ai/dsh-typert-generator/tsdown
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { WorkspaceTypertGenerator } from "./workspace.js";
/**
 * Create the typert generation plugin for the root tsdown config.
 * @returns a rolldown-compatible plugin that emits `lib/typert.<face>.js` and `.d.ts` for contributing packages.
 */
export function typertPlugin() {
    const artifactsByRoot = new Map();
    return {
        name: 'dsh-typert-generator',
        writeBundle(options) {
            // options.dir is the package's absolute outDir (<package>/lib); its
            // nearest package.json owns the bundle even when a custom config writes
            // a nested output such as <package>/lib/dev.
            if (options.dir === undefined)
                return;
            const root = workspaceRoot(options.dir);
            const packageDir = packageRoot(options.dir, root);
            if (packageDir === undefined)
                return;
            const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
            if (manifest.name === undefined || !hasTypertExport(manifest.exports))
                return;
            let artifacts = artifactsByRoot.get(root);
            if (artifacts === undefined) {
                artifacts = new WorkspaceTypertGenerator(root).generate();
                artifactsByRoot.set(root, artifacts);
            }
            const output = join(packageDir, 'lib');
            mkdirSync(output, { recursive: true });
            for (const artifact of artifacts.filter(candidate => candidate.package === manifest.name)) {
                writeFileSync(join(output, `typert.${artifact.face}.js`), artifact.js);
                writeFileSync(join(output, `typert.${artifact.face}.d.ts`), artifact.dts);
            }
        },
    };
}
function hasTypertExport(exportsField) {
    if (exportsField === null || typeof exportsField !== 'object' || Array.isArray(exportsField))
        return false;
    return Object.hasOwn(exportsField, './typert') || Object.hasOwn(exportsField, './client/typert');
}
function packageRoot(start, workspace) {
    let current = resolve(start);
    while (current !== workspace) {
        if (existsSync(join(current, 'package.json')))
            return current;
        current = dirname(current);
    }
    return undefined;
}
function workspaceRoot(start) {
    let current = resolve(start);
    while (!existsSync(join(current, 'tsconfig.host.json'))) {
        const parent = dirname(current);
        if (parent === current)
            throw new Error(`typert-generator: cannot find workspace root above ${start}`);
        current = parent;
    }
    return current;
}
//# sourceMappingURL=tsdown-plugin.js.map