import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'packages/core/src'),
      '@arrow-js/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@arrow-js/framework': path.resolve(__dirname, 'packages/framework/src/index.ts'),
      '@arrow-js/ssr': path.resolve(__dirname, 'packages/ssr/src/index.ts'),
      '@arrow-js/hydrate': path.resolve(__dirname, 'packages/hydrate/src/index.ts'),
      '@arrow-js/compiler': path.resolve(__dirname, 'packages/compiler/src/index.ts'),
      '@arrow-js/vite-plugin-arrow': path.resolve(
        __dirname,
        'packages/vite-plugin-arrow/src/index.js'
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**'],
  },
})
