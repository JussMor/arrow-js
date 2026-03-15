import type { ArrowTemplate } from './html'
import { reactive } from './reactive'
import type { Reactive, ReactiveTarget } from './reactive'

export type Props<T extends ReactiveTarget> = {
  [P in keyof T]: T[P] extends ReactiveTarget ? Props<T[P]> | T[P] : T[P]
}
type ArrowTemplateKey = string | number | undefined

export type ComponentFactory = (props?: Props<ReactiveTarget>) => ArrowTemplate

export interface ComponentCall {
  h: ComponentFactory
  p: Props<ReactiveTarget> | undefined
  k: ArrowTemplateKey
  key: (key: ArrowTemplateKey) => ComponentCall
}

export interface Component {
  (): ComponentCall
}

export interface ComponentWithProps<T extends ReactiveTarget> {
  <S extends Props<T>>(props: S): ComponentCall
}

type SourceBox = Reactive<{
  0: Props<ReactiveTarget> | undefined
  1: ComponentFactory
}>
function setComponentKey(this: ComponentCall, key: ArrowTemplateKey) {
  this.k = key
  return this
}

const propsProxyHandler: ProxyHandler<SourceBox> = {
  get(target, key) {
    const source = target[0]
    if (!source) return
    return (source as Record<PropertyKey, unknown>)[key as PropertyKey]
  },
}

const narrowedPropsHandler: ProxyHandler<{
  k: PropertyKey[]
  s: object
}> = {
  get(target, key) {
    return target.k.includes(key)
      ? (target.s as Record<PropertyKey, unknown>)[key as PropertyKey]
      : undefined
  },
}

export function pick<T extends object, K extends keyof T>(
  source: T,
  ...keys: K[]
): Pick<T, K>
export function pick<T extends object>(
  source: T
): T
export function pick<T extends object, K extends keyof T>(
  source: T,
  ...keys: K[]
): T | Pick<T, K> {
  return keys.length
    ? (new Proxy({
        k: keys as PropertyKey[],
        s: source,
      }, narrowedPropsHandler) as unknown as Pick<T, K>)
    : source
}

export const props = pick

export function component(factory: () => ArrowTemplate): Component
export function component<T extends ReactiveTarget>(
  factory: (props: Props<T>) => ArrowTemplate
): ComponentWithProps<T>
export function component<T extends ReactiveTarget>(
  factory: (() => ArrowTemplate) | ((props: Props<T>) => ArrowTemplate)
): Component | ComponentWithProps<T> {
  return ((input?: Props<T>) =>
    ({
      h: factory as ComponentFactory,
      k: undefined,
      p: input as Props<ReactiveTarget> | undefined,
      key: setComponentKey,
    })) as Component | ComponentWithProps<T>
}

export function isCmp(value: unknown): value is ComponentCall {
  return !!value && typeof value === 'object' && 'h' in value
}

export function createPropsProxy(
  source: Props<ReactiveTarget> | undefined,
  factory: ComponentFactory
): [Props<ReactiveTarget>, SourceBox] {
  const box = reactive({ 0: source, 1: factory })
  return [new Proxy(box, propsProxyHandler) as unknown as Props<ReactiveTarget>, box]
}
