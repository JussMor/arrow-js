import { nextTick } from '@arrow-js/core'
import type { HydrationCapture } from '@arrow-js/core/internal'

export interface RenderContext {
  pending: Set<Promise<unknown>>
  errors: unknown[]
  asyncSnapshots: Record<string, unknown>
  hydrationSnapshots: Record<string, unknown>
  hydrationCapture: HydrationCapture | null
  componentIndex: number
  boundaryIndex: number
  boundaries: string[]
  track: <T>(promise: Promise<T>) => Promise<T>
  flush: () => Promise<void>
  claimComponentId: (prefix?: string) => string
  claimBoundaryId: (prefix?: string) => string
  registerBoundary: (id: string) => void
  recordSnapshot: (id: string, snapshot: unknown) => void
  consumeSnapshot: (id: string) => unknown
}

export interface RenderContextOptions {
  hydrationSnapshots?: Record<string, unknown>
}

interface AsyncContextStore<T> {
  getStore: () => T | undefined
  run: <R>(store: T, callback: () => R) => R
}

type AsyncLocalStorageConstructor = new <T>() => AsyncContextStore<T>

let activeContext: RenderContext | null = null
const asyncContextStorage = createAsyncContextStorage<RenderContext>()

export function getRenderContext(): RenderContext | null {
  return asyncContextStorage?.getStore() ?? activeContext
}

export function runWithRenderContext<T>(
  context: RenderContext | null,
  fn: () => T
): T {
  if (!context) {
    return fn()
  }

  const execute = () => {
    const previousContext = activeContext
    activeContext = context

    try {
      return fn()
    } finally {
      activeContext = previousContext
    }
  }

  return asyncContextStorage ? asyncContextStorage.run(context, execute) : execute()
}

export async function withRenderContext<T>(
  fn: (context: RenderContext) => Promise<T> | T,
  options: RenderContextOptions = {}
): Promise<T> {
  const context = createRenderContext(options)
  const execute = async () => {
    const previousContext = activeContext
    activeContext = context

    try {
      const value = await fn(context)
      await context.flush()
      return value
    } finally {
      activeContext = previousContext
    }
  }

  return asyncContextStorage ? asyncContextStorage.run(context, execute) : execute()
}

function createRenderContext(options: RenderContextOptions): RenderContext {
  const context: RenderContext = {
    pending: new Set(),
    errors: [],
    asyncSnapshots: {},
    hydrationSnapshots: { ...(options.hydrationSnapshots ?? {}) },
    hydrationCapture: null,
    componentIndex: 0,
    boundaryIndex: 0,
    boundaries: [],
    track<T>(promise: Promise<T>) {
      const tracked = Promise.resolve(promise)
      context.pending.add(tracked)
      void tracked.finally(() => {
        context.pending.delete(tracked)
      })
      return tracked
    },
    async flush() {
      while (context.pending.size) {
        const pending = [...context.pending]
        const results = await Promise.allSettled(pending)

        for (const result of results) {
          if (result.status === 'rejected') {
            context.errors.push(result.reason)
          }
        }

        await nextTick()
      }

      if (context.errors.length) {
        throw context.errors[0]
      }
    },
    claimComponentId(prefix = 'c') {
      return `${prefix}:${context.componentIndex++}`
    },
    claimBoundaryId(prefix = 'b') {
      return `${prefix}:${context.boundaryIndex++}`
    },
    registerBoundary(id) {
      context.boundaries.push(id)
    },
    recordSnapshot(id, snapshot) {
      context.asyncSnapshots[id] = snapshot
    },
    consumeSnapshot(id) {
      return context.hydrationSnapshots[id]
    },
  }

  return context
}

function createAsyncContextStorage<T>(): AsyncContextStore<T> | null {
  if (
    typeof process === 'undefined' ||
    typeof process.getBuiltinModule !== 'function'
  ) {
    return null
  }

  const asyncHooks = process.getBuiltinModule('node:async_hooks') as
    | { AsyncLocalStorage?: AsyncLocalStorageConstructor }
    | undefined

  if (!asyncHooks?.AsyncLocalStorage) {
    return null
  }

  return new asyncHooks.AsyncLocalStorage<T>()
}
