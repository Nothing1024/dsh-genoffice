import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Vitest config for the dsh-genoffice plugin. The integration spec imports
 * the package's own client entry (`@deepseek-ai/dsh-tab-genoffice/client`)
 * before the lib/ build exists — alias it to the source so tests run
 * pre-build, matching the package's declared exports after build.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-tab-genoffice/client': fileURLToPath(
        new URL('./packages/tab-genoffice/src/client/index.ts', import.meta.url),
      ),
      '@deepseek-ai/dsh-tab-genoffice': fileURLToPath(
        new URL('./packages/tab-genoffice/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    globals: false,
  },
})
