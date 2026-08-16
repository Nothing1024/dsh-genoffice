/**
 * Shared tsdown preset for the dsh-genoffice plugin packages.
 * Host + client entries are emitted as ESM; every cordis / react /
 * better-sidebar / @deepseek-ai/* import stays external (neverBundle) and
 * resolves from the host profile closure (or the hoisted node_modules for
 * local dev). CSS module imports are inlined via @tsdown/css.
 */
import { defineConfig } from 'tsdown'

export function packageTsdownConfig(name: string) {
  return defineConfig({
    entry: {
      index: 'src/index.ts',
      client: 'src/client/index.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'neutral',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: [
        'cordis',
        'cosmokit',
        'schemastery',
        'react',
        'react-dom',
        'dsh-better-sidebar',
        /^@deepseek-ai\//,
      ],
    },
  })
}
