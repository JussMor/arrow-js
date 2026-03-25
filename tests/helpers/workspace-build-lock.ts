import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const workspaceKey = createHash('sha1').update(repoRoot).digest('hex').slice(0, 12)
const lockDir = path.resolve(os.tmpdir(), `arrow-workspace-tests-${workspaceKey}`, 'workspace-build-lock')
const integrationLockDir = path.resolve(
  os.tmpdir(),
  `arrow-workspace-tests-${workspaceKey}`,
  'workspace-integration-lock'
)

export async function withWorkspaceBuildLock<T>(fn: () => Promise<T>) {
  return withLock(lockDir, fn)
}

export async function withWorkspaceIntegrationLock<T>(fn: () => Promise<T>) {
  return withLock(integrationLockDir, fn)
}

async function withLock<T>(targetLockDir: string, fn: () => Promise<T>) {
  await fs.mkdir(path.dirname(targetLockDir), { recursive: true })
  await acquireLock(targetLockDir)

  try {
    return await fn()
  } finally {
    await fs.rm(targetLockDir, { force: true, recursive: true })
  }
}

async function acquireLock(targetLockDir: string) {
  while (true) {
    try {
      await fs.mkdir(targetLockDir)
      return
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') {
        throw error
      }

      await wait(100)
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
