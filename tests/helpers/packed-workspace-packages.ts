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

const packageBuildScripts: Record<string, string | undefined> = {
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

interface PackedWorkspacePackageEntry {
  inputMtimeMs: number
  tarball: string
}

interface PackedWorkspaceManifest {
  packages: Record<string, PackedWorkspacePackageEntry>
}

export async function getPackedWorkspacePackages(
  packageNames: readonly string[],
  targetDir?: string
) {
  const selectedPackages = [...new Set(packageNames)].sort()

  return withWorkspaceBuildLock(async () => {
    await fs.mkdir(cacheDir, { recursive: true })

    const manifest = (await readManifest()) ?? { packages: {} }
    const inputMtims = await getInputMtimes(selectedPackages)
    const stalePackages: string[] = []

    for (const packageName of selectedPackages) {
      const cached = manifest.packages[packageName]
      const inputMtimeMs = inputMtims[packageName]
      const hasTarball = cached
        ? await fileExists(cached.tarball)
        : false

      if (!cached || !hasTarball || cached.inputMtimeMs < inputMtimeMs) {
        stalePackages.push(packageName)
      }
    }

    for (const packageName of packageBuildOrder) {
      if (!stalePackages.includes(packageName)) {
        continue
      }

      const buildScript = packageBuildScripts[packageName]

      if (!buildScript) {
        continue
      }

      await execa(
        'pnpm',
        ['--filter', packageName, buildScript],
        {
          cwd: repoRoot,
        }
      )
    }

    for (const packageName of stalePackages) {
      manifest.packages[packageName] = {
        inputMtimeMs: inputMtims[packageName],
        tarball: await packWorkspacePackage(packageName, cacheDir),
      }
    }

    await fs.writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`
    )

    const cachedTarballs = Object.fromEntries(
      selectedPackages.map((packageName) => [
        packageName,
        manifest.packages[packageName]!.tarball,
      ])
    ) as Record<string, string>

    if (!targetDir) {
      return cachedTarballs
    }

    await fs.mkdir(targetDir, { recursive: true })

    const copiedTarballs = Object.fromEntries(
      await Promise.all(
        selectedPackages.map(async (packageName) => {
          const sourcePath = cachedTarballs[packageName]
          const destinationPath = path.resolve(
            targetDir,
            path.basename(sourcePath)
          )

          await fs.copyFile(sourcePath, destinationPath)

          return [packageName, destinationPath]
        })
      )
    ) as Record<string, string>

    return copiedTarballs
  })
}

async function readManifest() {
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as
      | PackedWorkspaceManifest
      | {
          tarballs?: Record<string, string>
        }

    if ('packages' in parsed && parsed.packages) {
      return parsed
    }

    return {
      packages: Object.fromEntries(
        Object.entries(parsed.tarballs ?? {}).map(([packageName, tarball]) => [
          packageName,
          {
            inputMtimeMs: 0,
            tarball,
          },
        ])
      ),
    }
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

async function getInputMtimes(packageNames: readonly string[]) {
  const entries = await Promise.all(
    packageNames.map(async (packageName) => {
      const inputPaths = [
        path.resolve(repoRoot, 'scripts', 'build-package.mjs'),
        path.resolve(
          repoRoot,
          'packages',
          packageName.startsWith('@arrow-js/')
            ? packageName.split('/')[1]
            : packageName
        ),
      ]

      const mtimes = await Promise.all(inputPaths.map((inputPath) => getPathMtimeMs(inputPath)))
      return [packageName, Math.max(...mtimes, 0)] as const
    })
  )

  return Object.fromEntries(entries) as Record<string, number>
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

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false
    }

    throw error
  }
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
