import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.worktrees/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // Next resolves `server-only` itself; under Vitest every module runs on the server, so it is the empty module.
      'server-only': resolve(__dirname, 'node_modules/next/dist/compiled/server-only/empty.js'),
    },
  },
})
