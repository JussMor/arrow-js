import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const lockDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.tmp',
  'workspace-build-lock'
)

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
