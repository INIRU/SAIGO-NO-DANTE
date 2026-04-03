import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'app/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'scripts/**/*.test.{ts,tsx}',
    ],
    exclude: ['e2e/**', 'node_modules/**', '.worktrees/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
