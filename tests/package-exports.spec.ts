import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { withWorkspaceBuildLock } from './helpers/workspace-build-lock.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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
      await buildPackableWorkspacePackages()

      const tarballs = Object.fromEntries(
        await Promise.all(
          packagedArrowLibraries.map(async (packageName) => [
            packageName,
            await packWorkspacePackage(packageName, packDir),
          ])
        )
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
          'await Promise.all([',
          "  import('@arrow-js/core/internal'),",
          "  import('@arrow-js/framework'),",
          "  import('@arrow-js/framework/internal'),",
          "  import('@arrow-js/framework/ssr'),",
          "  import('@arrow-js/ssr'),",
          "  import('@arrow-js/hydrate'),",
          "  import('@arrow-js/highlight'),",
          '])',
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
    300_000
  )
})

async function createTempDir() {
  const directory = await fs.mkdtemp(path.resolve(os.tmpdir(), 'arrow-package-'))
  tempDirs.push(directory)
  return directory
}

async function buildPackableWorkspacePackages() {
  const buildOrder = [
    '@arrow-js/core',
    '@arrow-js/framework',
    '@arrow-js/ssr',
    '@arrow-js/hydrate',
    '@arrow-js/highlight',
  ] as const
  const buildScripts: Record<(typeof buildOrder)[number], string> = {
    '@arrow-js/core': 'build:runtime',
    '@arrow-js/framework': 'build',
    '@arrow-js/ssr': 'build',
    '@arrow-js/hydrate': 'build',
    '@arrow-js/highlight': 'build',
  }

  await withWorkspaceBuildLock(async () => {
    for (const packageName of buildOrder) {
      await execa('pnpm', ['--filter', packageName, buildScripts[packageName]], {
        cwd: repoRoot,
      })
    }
  })
}

async function packWorkspacePackage(packageName: string, packDir: string) {
  const packageDirectory = path.resolve(repoRoot, 'packages', packageName.split('/').at(-1)!)
  const { stdout } = await execa(
    'pnpm',
    ['pack', '--json', '--pack-destination', packDir],
    {
      cwd: packageDirectory,
    }
  )
  const details = JSON.parse(stdout) as { filename: string }
  return details.filename
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}
