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

export async function withWorkspaceBuildLock<T>(fn: () => Promise<T>) {
  await fs.mkdir(path.dirname(lockDir), { recursive: true })
  await acquireLock()

  try {
    return await fn()
  } finally {
    await fs.rm(lockDir, { force: true, recursive: true })
  }
}

async function acquireLock() {
  while (true) {
    try {
      await fs.mkdir(lockDir)
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
