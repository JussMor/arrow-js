import { isR, isO, queue } from './common'
import { expressionPool, onExpressionUpdate } from './expressions'
import { ArrowFunction, ArrowRenderable } from './html'

/**
 * The target of a reactive object.
 */
export type ReactiveTarget = Record<PropertyKey, unknown> | unknown[]

interface ReactiveAPI<T> {
  /**
   * Adds an observer to a given property.
   * @param p - The property to watch.
   * @param c - The callback to call when the property changes.
   * @returns
   */
  $on: <P extends keyof T>(p: P, c: PropertyObserver<T[P]>) => void
  /**
   * Removes an observer from a given property.
   * @param p - The property to stop watching.
   * @param c - The callback to stop calling when the property changes.
   * @returns
   */
  $off: <P extends keyof T>(p: P, c: PropertyObserver<T[P]>) => void
}

/**
 * A reactive object is a proxy of an original object.
 */
export type Reactive<T extends ReactiveTarget> = {
  /**
   * In the future it would be great to have variant types here for
   * accessing vs setting types. For example:
   * ```js
   * const obj = reactive({ x: { a: 123 } })
   * // Assignment should support non-reactive
   * obj.x = { a: 456 }
   * // Accessor should always be reactive:
   * obj.x.$on('a', (value) => console.log(value))
   * ```
   * This requires an update to TypeScript: https://github.com/microsoft/TypeScript/issues/43826
   */
  [P in keyof T]: T[P] extends ReactiveTarget ? Reactive<T[P]> | T[P] : T[P]
} & ReactiveAPI<T>

/**
 * A callback used to observe a property changes on a reactive object.
 */
export interface PropertyObserver<T> {
  (newValue?: T, oldValue?: T): void
}

/**
 * An array of dependency couples. The array is staggard between object ids and
 * their respective properties. Duplicate properties are allowed.
 * ```hs
 * [1, 'property', 1, 'property2', 1, 'property']
 * ```
 */
type Dependencies = Array<number | PropertyKey>

type ListenerMap = Partial<Record<PropertyKey, Set<PropertyObserver<unknown>>>>

/**
 * A registry of reactive objects to their unique numeric index which serves as
 * an unique identifier.
 */
const ids = new WeakMap<ReactiveTarget, number>()

/**
 * A registry of reactive objects to their property observers.
 */
const listeners: ListenerMap[] = []

/**
 * Gets the unique id of a given target.
 * @param target - The object to get the id of.
 * @returns
 */
const getId = (target: ReactiveTarget): number => ids.get(target)!

/**
 * An index counter for the reactive objects.
 */
let index = -1
/**
 * An index counter to identify watchers.
 */
let watchIndex = 0
/**
 * The current key being tracked.
 */
let trackKey = 0

/**
 * Array methods that modify the array.
 */
const arrayMutations: PropertyKey[] = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'copyWithin',
  'fill',
  'reverse',
]

/**
 * A registry of dependencies for each tracked key.
 */
const trackedDependencies: Dependencies[] = []

/**
 * A registry of dependencies that are being watched by a given watcher.
 */
const watchedDependencies: Dependencies[] = []

/**
 * A map of child ids to their parents (a child can have multiple parents).
 */
const parents: Array<[parent: number, property: PropertyKey]>[] = []

/**
 * A reactive object is a proxy of the original object that allows for
 * reactive dependency watching. It is created by calling `reactive()` and
 * should be used to store reactive data in your app and components.
 *
 * @param data - The data to make reactive, typically a plain object.
 * @returns A reactive proxy of the original data.
 */
export function reactive<T extends ReactiveTarget>(data: T): Reactive<T> {
  // The data is already a reactive object, so return it.
  if (isR(data)) return data as Reactive<T>
  // Only valid objects can be reactive.
  if (!isO(data)) throw Error('Non object passed to reactive.')
  // Create a new slot in the listeners registry and then store the relationship
  // of this object to its index.
  const id = ++index
  listeners[id] = {}
  // Create the actual reactive proxy.
  const proxy = new Proxy(data, {
    has: has.bind(null, id),
    set: set.bind(null, id),
    get: get.bind(null, id),
  }) as Reactive<T>
  // let the ids know about the index
  ids.set(data, index).set(proxy, index)
  return proxy
}

/**
 * Determines if a certain key is in the target object.
 * @param target - The object to check.
 * @param key - The property to check.
 * @returns
 */
function has(id: number, target: ReactiveTarget, key: PropertyKey): boolean {
  if (key in api) return true
  track(id, key)
  return key in target
}

/**
 * Gets a property from the target object.
 * @param target - The object to get the property on.
 * @param key - The property to get.
 * @param receiver - The proxy object.
 * @returns
 */
function get(
  id: number,
  target: ReactiveTarget,
  key: PropertyKey,
  receiver: object
): unknown {
  if (key in api) return api[key as keyof typeof api](target)
  const result = Reflect.get(target, key, receiver)
  let child: Reactive<ReactiveTarget> | undefined
  if (isO(result) && !isR(result)) {
    // Lazily create a child reactive object.
    child = createChild(result, id, key)
    target[key as number] = child
  }
  const value = child ?? result

  if (Array.isArray(target)) {
    // Explicitly don’t track the length property.
    return trackArray(id, key, target, value)
  }
  track(id, key)
  return value
}

/**
 *
 * @param parentId - The id of the parent object.
 * @param property - The property of the parent object.
 * @param value - The value of the property.
 * @returns
 */
function trackArray(
  id: number,
  key: PropertyKey,
  target: ReactiveTarget,
  value: unknown
) {
  if (arrayMutations.includes(key) && typeof value === 'function') {
    return (...args: unknown[]) => {
      const result = Reflect.apply(
        value as (...args: unknown[]) => unknown,
        target,
        args
      )
      parents[id]?.forEach(([parentId, property]) => emit(parentId, property))
      return result
    }
  }
  return value
}

/**
 * Gets a property from the target object.
 * @param target - The object to get the property on.
 * @param key - The property to get.
 * @param receiver - The proxy object.
 * @returns
 */
function set(
  id: number,
  target: ReactiveTarget,
  key: PropertyKey,
  value: unknown,
  receiver: object
): boolean {
  // If this is a new property then we need to notify parent properties
  const isNewProperty = !(key in target)
  // If the newly assigned item is not reactive, make it so.
  const newReactive =
    isO(value) && !isR(value) ? createChild(value, id, key) : null
  // Retrieve the old value
  const oldValue = target[key as number]
  // The new value
  const newValue = newReactive ?? value
  // Perform the actual set operation
  const didSucceed = Reflect.set(target, key, newValue, receiver)
  // If the old value was reactive, and the new value is
  if (oldValue !== newValue && isR(oldValue) && isR(newValue)) {
    reassign(id, key, getId(oldValue), getId(newValue))
  }
  // Notify all listeners
  emit(id, key, value, oldValue, isNewProperty)
  // If the array length is modified, notify all parents
  if (Array.isArray(target) && key === 'length') {
    parents[id]?.forEach(([parentId, property]) => emit(parentId, property))
  }
  return didSucceed
}

/**
 *
 * @param child - Creates a child relationship
 * @param parent
 * @param key
 * @returns
 */
function createChild(
  child: ReactiveTarget,
  parentId: number,
  key: PropertyKey
): Reactive<ReactiveTarget> {
  const r = reactive(child)
  parents[getId(child)] ??= []
  parents[getId(child)].push([parentId, key])
  return r
}

/**
 * Transfers listeners from one parent object’s reactive property to another.
 * @param parentId - The parent id
 * @param key - The property key to reassign
 * @param from - The previous reactive id
 * @param to - The new reactive id
 */
function reassign(
  parentId: number,
  key: PropertyKey,
  from: number,
  to: number
) {
  // Remove the old parent relationship
  if (parents[from]) {
    const index = parents[from].findIndex(
      ([parent, property]) => parent == parentId && property == key
    )
    if (index > -1) parents[from].splice(index, 1)
  }
  // Create a new parent relationship if it does not already exist.
  if (!parents[to]?.some(([i, property]) => i == parentId && key == property)) {
    parents[to] ??= []
    parents[to].push([parentId, key])
  }
}

/**
 *
 * @param id - The reactive id that changed.
 * @param key - The property that changed.
 * @param newValue - The new value of the property.
 * @param oldValue - The old value of the property.
 */
function emit(
  id: number,
  key: PropertyKey,
  newValue?: unknown,
  oldValue?: unknown,
  notifyParents?: boolean
) {
  const targetListeners = listeners[id]
  const propertyListeners = targetListeners[key]
  if (propertyListeners) {
    propertyListeners.forEach((callback) => callback(newValue, oldValue))
  }
  if (notifyParents) {
    parents[id]?.forEach(([parentId, property]) => emit(parentId, property))
  }
}

/**
 * The public reactive API for a reactive object.
 */
const api = {
  $on:
    (target: ReactiveTarget): ReactiveAPI<ReactiveTarget>['$on'] =>
    (property, callback) => {
      const targetListeners = listeners[getId(target)] as ListenerMap
      const key = property as PropertyKey
      const propertyListeners =
        targetListeners[key] ?? (targetListeners[key] = new Set())
      propertyListeners.add(callback as PropertyObserver<unknown>)
    },
  $off:
    (target: ReactiveTarget): ReactiveAPI<ReactiveTarget>['$off'] =>
    (property, callback) =>
      (listeners[getId(target)] as ListenerMap)[property as PropertyKey]?.delete(
        callback as PropertyObserver<unknown>
      ),
}

/**
 * Track a reactive property as a dependency.
 * @param target
 * @param key
 */
function track(id: number, property: PropertyKey): void {
  if (!trackKey) return
  trackedDependencies[trackKey].push(id, property)
}

/**
 * Begin tracking reactive dependencies.
 */
function startTracking() {
  trackedDependencies[++trackKey] = []
}

/**
 * Stop tracking reactive dependencies and register a callback for when any of
 * the tracked dependencies change.
 * @param callback - A function to re-run when dependencies change.
 */
function stopTracking(watchKey: number, callback: PropertyObserver<unknown>) {
  const key = trackKey--
  const deps = trackedDependencies[key]
  flushListeners(watchedDependencies[watchKey], callback)
  const len = deps.length
  for (let i = 0; i < len; i += 2) {
    const targetListeners = listeners[deps[i] as number]
    const property = deps[i + 1]
    const propertyListeners =
      (targetListeners[property] ??= new Set()) as Set<
        PropertyObserver<unknown>
      >
    propertyListeners.add(callback)
  }
  watchedDependencies[watchKey] = deps
  trackedDependencies[key] = []
}

/**
 * Removes a callback from the listeners registry for a given set of
 * dependencies.
 * @param deps - The dependencies to flush.
 * @param callback - The callback to remove.
 */
function flushListeners(
  deps: Dependencies,
  callback: PropertyObserver<unknown>
) {
  if (!deps) return
  const len = deps.length
  for (let i = 0; i < len; i += 2) {
    listeners[deps[i] as number][deps[i + 1]]?.delete(callback)
  }
}

/**
 * Calls a function and watches it for changes.
 * @param fn - A function to watch.
 * @param after - A function to call after the watched function with the result.
 */
export function watch<A extends (arg: ArrowRenderable) => unknown>(
  pointer: number,
  afterEffect: A
): [returnValue: ReturnType<A>, stop: () => void]
export function watch<F extends (...args: unknown[]) => unknown>(
  effect: F
): [returnValue: ReturnType<F>, stop: () => void]
export function watch<
  F extends (...args: unknown[]) => unknown,
  A extends (arg: ReturnType<F>) => unknown
>(effect: F, afterEffect: A): [returnValue: ReturnType<A>, stop: () => void]
export function watch<
  F extends (...args: unknown[]) => unknown,
  A extends (arg: ReturnType<F>) => unknown
>(
  effect: F | number,
  afterEffect?: A
): [returnValue: ReturnType<F> | ReturnType<A>, stop: () => void] {
  const watchKey = ++watchIndex
  const isPointer = Number.isInteger(effect)
  let rerun: null | PropertyObserver<unknown> = queue(
    runEffect as PropertyObserver<unknown>
  )
  function runEffect() {
    startTracking()

    const effectValue = isPointer
      ? (expressionPool[effect as number] as ArrowFunction)()
      : (effect as CallableFunction)()

    stopTracking(watchKey, rerun!)
    return afterEffect ? afterEffect(effectValue) : effectValue
  }
  const stop = () => {
    flushListeners(watchedDependencies[watchKey], rerun!)
    watchedDependencies[watchKey] = []
    rerun = null
  }
  if (isPointer) onExpressionUpdate(effect as number, rerun)
  return [runEffect(), stop]
}
