import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-tab-genoffice/client': fileURLToPath(
        new URL('./src/client/index.ts', import.meta.url),
      ),
      '@deepseek-ai/dsh-tab-genoffice': fileURLToPath(
        new URL('./src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    globals: false,
    setupFiles: ['./tests/setup-localstorage.ts'],
  },
})
