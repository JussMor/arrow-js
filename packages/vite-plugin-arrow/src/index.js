import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

export function arrow(options = {}) {
  const coreAlias =
    options.coreAlias ?? path.resolve(workspaceRoot, 'packages/core/src')
  const frameworkAlias =
    options.frameworkAlias ?? path.resolve(workspaceRoot, 'packages/framework/src/index.ts')
  const ssrAlias =
    options.ssrAlias ?? path.resolve(workspaceRoot, 'packages/ssr/src/index.ts')
  const hydrateAlias =
    options.hydrateAlias ?? path.resolve(workspaceRoot, 'packages/hydrate/src/index.ts')
  const compilerAlias =
    options.compilerAlias ?? path.resolve(workspaceRoot, 'packages/compiler/src/index.ts')

  return {
    name: 'arrow-workspace',
    config() {
      return {
        resolve: {
          alias: [
            {
              find: '@src',
              replacement: coreAlias,
            },
            {
              find: '@arrow-js/core/internal',
              replacement: path.resolve(coreAlias, 'internal.ts'),
            },
            {
              find: '@arrow-js/core',
              replacement: path.resolve(coreAlias, 'index.ts'),
            },
            {
              find: '@arrow-js/framework/internal',
              replacement: path.resolve(workspaceRoot, 'packages/framework/src/internal.ts'),
            },
            {
              find: '@arrow-js/framework/ssr',
              replacement: path.resolve(workspaceRoot, 'packages/framework/src/ssr.ts'),
            },
            {
              find: '@arrow-js/framework',
              replacement: frameworkAlias,
            },
            {
              find: '@arrow-js/ssr',
              replacement: ssrAlias,
            },
            {
              find: '@arrow-js/hydrate',
              replacement: hydrateAlias,
            },
            {
              find: '@arrow-js/compiler',
              replacement: compilerAlias,
            },
          ],
        },
        optimizeDeps: {
          exclude: [
            '@arrow-js/core',
            '@arrow-js/framework',
            '@arrow-js/ssr',
            '@arrow-js/hydrate',
          ],
        },
        ssr: {
          noExternal: [
            '@arrow-js/core',
            '@arrow-js/framework',
            '@arrow-js/ssr',
            '@arrow-js/hydrate',
          ],
        },
      }
    },
  }
}

export default arrow
