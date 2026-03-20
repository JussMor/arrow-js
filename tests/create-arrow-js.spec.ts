import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { scaffoldArrowApp } from '../packages/create-arrow-js/scaffold.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arrowPackages = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/hydrate',
  '@arrow-js/ssr',
  '@arrow-js/skill',
] as const

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      fs.rm(directory, { force: true, recursive: true })
    )
  )
})

describe('create-arrow-js', () => {
  it('scaffolds a Vite 8 Arrow starter', async () => {
    const workspace = await createTempDir()
    const projectDir = path.resolve(workspace, 'arrow-app')

    const result = await scaffoldArrowApp(projectDir)

    const packageJson = JSON.parse(
      await fs.readFile(path.resolve(projectDir, 'package.json'), 'utf8')
    )

    expect(result.projectName).toBe('arrow-app')
    expect(packageJson.dependencies['@arrow-js/core']).toBe('^1.0.0-alpha.9')
    expect(packageJson.scripts.dev).toBe('node server.mjs')
    await expectFile(projectDir, '.gitignore')
    await expectFile(projectDir, 'src/App.ts')
    await expectFile(projectDir, 'src/components/WelcomeCard.ts')
    await expectFile(projectDir, 'src/entry-server.ts')
    await expectFile(projectDir, 'src/entry-client.ts')
  })

  it(
    'installs and builds against packed workspace packages',
    { timeout: 300_000 },
    async () => {
      const workspace = await createTempDir()
      const projectDir = path.resolve(workspace, 'arrow-app')
      const packDir = path.resolve(workspace, 'packs')

      await scaffoldArrowApp(projectDir)
      await fs.mkdir(packDir, { recursive: true })

      await execa('pnpm', ['--filter', '@arrow-js/core', 'build:runtime'], {
        cwd: repoRoot,
      })

      const tarballs = Object.fromEntries(
        await Promise.all(
          arrowPackages.map(async (packageName) => [
            packageName,
            await packWorkspacePackage(packageName, packDir),
          ])
        )
      )

      await rewriteArrowDependencies(projectDir, tarballs)

      await execa('pnpm', ['install', '--prefer-offline'], {
        cwd: projectDir,
      })
      await execa('pnpm', ['typecheck'], {
        cwd: projectDir,
      })
      await execa('pnpm', ['build'], {
        cwd: projectDir,
      })
    }
  )
})

async function createTempDir() {
  const directory = await fs.mkdtemp(path.resolve(os.tmpdir(), 'arrow-create-'))
  tempDirs.push(directory)
  return directory
}

async function expectFile(rootDir: string, relativePath: string) {
  await fs.access(path.resolve(rootDir, relativePath))
}

async function packWorkspacePackage(packageName: string, packDir: string) {
  const packageDirectory = path.resolve(
    repoRoot,
    'packages',
    packageName.startsWith('@arrow-js/') ? packageName.split('/')[1] : packageName
  )
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

async function rewriteArrowDependencies(
  projectDir: string,
  tarballs: Record<string, string>
) {
  const packageJsonPath = path.resolve(projectDir, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
  const overrides: Record<string, string> = packageJson.pnpm?.overrides ?? {}

  for (const packageName of arrowPackages) {
    const tarball = `file:${normalizePath(tarballs[packageName])}`
    if (packageJson.dependencies?.[packageName]) {
      packageJson.dependencies[packageName] = tarball
    }
    if (packageJson.devDependencies?.[packageName]) {
      packageJson.devDependencies[packageName] = tarball
    }
    overrides[packageName] = tarball
  }

  packageJson.pnpm = {
    ...(packageJson.pnpm ?? {}),
    overrides,
  }

  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}
