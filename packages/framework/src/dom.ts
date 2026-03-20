import { AsyncLocalStorage } from 'node:async_hooks'
import type { DOMWindow } from 'jsdom'

type DomGlobals = Partial<Record<DomGlobalKey, unknown>>

type DomGlobalKey =
  | 'window'
  | 'document'
  | 'Node'
  | 'Element'
  | 'HTMLElement'
  | 'DocumentFragment'
  | 'Comment'
  | 'Text'
  | 'Event'
  | 'CustomEvent'
  | 'AbortController'
  | 'navigator'

const keys: DomGlobalKey[] = [
  'window',
  'document',
  'Node',
  'Element',
  'HTMLElement',
  'DocumentFragment',
  'Comment',
  'Text',
  'Event',
  'CustomEvent',
  'AbortController',
  'navigator',
]

const storage = new AsyncLocalStorage<DOMWindow>()
const fallbackDescriptors = new Map<DomGlobalKey, PropertyDescriptor | undefined>()
const domGlobalAccessors: Record<DomGlobalKey, (window: DOMWindow) => unknown> = {
  window: (window) => window,
  document: (window) => window.document,
  Node: (window) => window.Node,
  Element: (window) => window.Element,
  HTMLElement: (window) => window.HTMLElement,
  DocumentFragment: (window) => window.DocumentFragment,
  Comment: (window) => window.Comment,
  Text: (window) => window.Text,
  Event: (window) => window.Event,
  CustomEvent: (window) => window.CustomEvent,
  AbortController: (window) => window.AbortController,
  navigator: (window) => window.navigator,
}
let globalsInstalled = false

export async function withDomWindow<T>(
  window: DOMWindow,
  fn: () => Promise<T> | T
): Promise<T> {
  installDomGlobals()
  return storage.run(window, fn)
}

function installDomGlobals() {
  if (globalsInstalled) {
    return
  }

  for (const key of keys) {
    fallbackDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      enumerable: true,
      get() {
        const window = storage.getStore()
        if (window) {
          return domGlobalAccessors[key](window)
        }

        const fallback = fallbackDescriptors.get(key)
        if (!fallback) {
          return undefined
        }

        if (fallback.get) {
          return fallback.get.call(globalThis)
        }

        return fallback.value
      },
      set(value) {
        const fallback = fallbackDescriptors.get(key)

        if (fallback?.set) {
          fallback.set.call(globalThis, value)
          return
        }

        fallbackDescriptors.set(key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        })
      },
    })
  }

  globalsInstalled = true
}
