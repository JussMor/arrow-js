import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { withWorkspaceBuildLock } from './workspace-build-lock.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const workspaceKey = createHash('sha1').update(repoRoot).digest('hex').slice(0, 12)
const cacheDir = path.resolve(os.tmpdir(), `arrow-workspace-tests-${workspaceKey}`, 'packed-workspace')
const manifestPath = path.resolve(cacheDir, 'manifest.json')

const packageBuildScripts: Record<string, string> = {
  '@arrow-js/core': 'build:runtime',
  '@arrow-js/framework': 'build',
  '@arrow-js/ssr': 'build',
  '@arrow-js/hydrate': 'build',
  '@arrow-js/highlight': 'build',
}

const packageBuildOrder = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/ssr',
  '@arrow-js/hydrate',
  '@arrow-js/highlight',
] as const

interface PackedWorkspaceManifest {
  builtAtMs: number
  tarballs: Record<string, string>
}

export async function getPackedWorkspacePackages(packageNames: readonly string[]) {
  const selectedPackages = [...new Set(packageNames)].sort()

  return withWorkspaceBuildLock(async () => {
    const latestInputMtimeMs = await getLatestInputMtimeMs(selectedPackages)
    const manifest = await readManifest()

    if (
      manifest &&
      manifest.builtAtMs >= latestInputMtimeMs &&
      selectedPackages.every((packageName) => manifest.tarballs[packageName]) &&
      await allTarballsExist(selectedPackages, manifest.tarballs)
    ) {
      return Object.fromEntries(
        selectedPackages.map((packageName) => [
          packageName,
          manifest.tarballs[packageName],
        ])
      ) as Record<string, string>
    }

    await fs.rm(cacheDir, {
      force: true,
      recursive: true,
    })
    await fs.mkdir(cacheDir, { recursive: true })

    for (const packageName of packageBuildOrder) {
      if (!selectedPackages.includes(packageName)) {
        continue
      }

      await execa(
        'pnpm',
        ['--filter', packageName, packageBuildScripts[packageName]],
        {
          cwd: repoRoot,
        }
      )
    }

    const tarballs: Record<string, string> = {}

    for (const packageName of selectedPackages) {
      tarballs[packageName] = await packWorkspacePackage(packageName, cacheDir)
    }

    await fs.writeFile(
      manifestPath,
      `${JSON.stringify({ builtAtMs: Date.now(), tarballs }, null, 2)}\n`
    )

    return tarballs
  })
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as PackedWorkspaceManifest
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }

    throw error
  }
}

async function allTarballsExist(
  packageNames: readonly string[],
  tarballs: Record<string, string>
) {
  const results = await Promise.allSettled(
    packageNames.map((packageName) => fs.access(tarballs[packageName]))
  )

  return results.every((result) => result.status === 'fulfilled')
}

async function getLatestInputMtimeMs(packageNames: readonly string[]) {
  const inputPaths = [
    path.resolve(repoRoot, 'scripts', 'build-package.mjs'),
    ...packageNames.map((packageName) =>
      path.resolve(
        repoRoot,
        'packages',
        packageName.startsWith('@arrow-js/')
          ? packageName.split('/')[1]
          : packageName
      )
    ),
  ]

  const mtimes = await Promise.all(inputPaths.map((inputPath) => getPathMtimeMs(inputPath)))
  return Math.max(...mtimes, 0)
}

async function getPathMtimeMs(targetPath: string): Promise<number> {
  const stat = await fs.stat(targetPath)

  if (!stat.isDirectory()) {
    return stat.mtimeMs
  }

  let latestMtimeMs = stat.mtimeMs
  const entries = await fs.readdir(targetPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === 'dist' || entry.name === 'node_modules') {
      continue
    }

    const entryPath = path.resolve(targetPath, entry.name)
    latestMtimeMs = Math.max(latestMtimeMs, await getPathMtimeMs(entryPath))
  }

  return latestMtimeMs
}

async function packWorkspacePackage(packageName: string, packDestination: string) {
  const packageDirectory = path.resolve(
    repoRoot,
    'packages',
    packageName.startsWith('@arrow-js/') ? packageName.split('/')[1] : packageName
  )
  const { stdout } = await execa(
    'pnpm',
    ['pack', '--json', '--pack-destination', packDestination],
    {
      cwd: packageDirectory,
    }
  )
  const details = JSON.parse(stdout) as { filename: string }
  return path.resolve(packDestination, details.filename)
}
