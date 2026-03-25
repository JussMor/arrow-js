import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { getPackedWorkspacePackages } from './helpers/packed-workspace-packages.js'

const packagedArrowLibraries = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/ssr',
  '@arrow-js/hydrate',
  '@arrow-js/highlight',
] as const
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      fs.rm(directory, { force: true, recursive: true })
    )
  )
})

describe('packaged Arrow exports', () => {
  it(
    'imports the packaged runtime libraries in plain Node without loading TypeScript from node_modules',
    async () => {
      const workspace = await createTempDir()
      const packDir = path.resolve(workspace, 'packs')
      const consumerDir = path.resolve(workspace, 'consumer')

      await fs.mkdir(packDir, { recursive: true })
      await fs.mkdir(consumerDir, { recursive: true })
      const tarballs = await getPackedWorkspacePackages(
        packagedArrowLibraries,
        packDir
      )

      await fs.writeFile(
        path.resolve(consumerDir, 'package.json'),
        `${JSON.stringify({
          name: 'arrow-package-smoke',
          private: true,
          type: 'module',
          dependencies: Object.fromEntries(
            packagedArrowLibraries.map((packageName) => [
              packageName,
              `file:${normalizePath(tarballs[packageName])}`,
            ])
          ),
          pnpm: {
            overrides: Object.fromEntries(
              packagedArrowLibraries.map((packageName) => [
                packageName,
                `file:${normalizePath(tarballs[packageName])}`,
              ])
            ),
          },
        }, null, 2)}\n`
      )

      await execa('pnpm', ['install', '--prefer-offline'], {
        cwd: consumerDir,
      })

      const verifyScriptPath = path.resolve(consumerDir, 'verify.mjs')
      await fs.writeFile(
        verifyScriptPath,
        [
          "const [{ component, html }] = await Promise.all([",
          "  import('@arrow-js/core'),",
          "  import('@arrow-js/core/internal'),",
          "  import('@arrow-js/framework'),",
          "  import('@arrow-js/framework/internal'),",
          "  import('@arrow-js/framework/ssr'),",
          "  import('@arrow-js/ssr'),",
          "  import('@arrow-js/hydrate'),",
          "  import('@arrow-js/highlight'),",
          '])',
          'component(async () => html`<p>ok</p>`)',
          "console.log('imports ok')",
          '',
        ].join('\n')
      )

      const { stdout } = await execa('node', [verifyScriptPath], {
        cwd: consumerDir,
      })

      const frameworkPackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/framework/package.json'),
          'utf8'
        )
      )
      const corePackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/core/package.json'),
          'utf8'
        )
      )
      const ssrPackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/ssr/package.json'),
          'utf8'
        )
      )
      const hydratePackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/hydrate/package.json'),
          'utf8'
        )
      )
      const highlightPackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/highlight/package.json'),
          'utf8'
        )
      )

      expect(stdout).toContain('imports ok')
      expect(corePackage.exports['./internal'].import).toBe('./dist/internal.mjs')
      expect(frameworkPackage.exports['.'].import).toBe('./dist/index.mjs')
      expect(frameworkPackage.exports['./internal'].import).toBe('./dist/internal.mjs')
      expect(frameworkPackage.exports['./ssr'].import).toBe('./dist/ssr.mjs')
      expect(ssrPackage.exports['.'].import).toBe('./dist/index.mjs')
      expect(hydratePackage.exports['.'].import).toBe('./dist/index.mjs')
      expect(highlightPackage.exports['.'].import).toBe('./dist/index.mjs')
    },
    90_000
  )
})

async function createTempDir() {
  const directory = await fs.mkdtemp(path.resolve(os.tmpdir(), 'arrow-package-'))
  tempDirs.push(directory)
  return directory
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}
