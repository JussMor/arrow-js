import { component, html, reactive } from '@arrow-js/core'
import type { Props, ReactiveTarget } from '@arrow-js/core'
import type { Component, ComponentWithProps } from '../../core/src/component'
import { getRenderContext, runWithRenderContext } from './context'

type AsyncStatus = 'idle' | 'pending' | 'resolved' | 'rejected'

export interface AsyncComponentOptions<TProps extends ReactiveTarget, TValue, TSnapshot> {
  fallback?: unknown
  onError?: (error: unknown, props: Props<TProps>) => unknown
  render?: (value: TValue, props: Props<TProps>) => unknown
  serialize?: (value: TValue, props: Props<TProps>) => TSnapshot
  deserialize?: (snapshot: TSnapshot, props: Props<TProps>) => TValue
  idPrefix?: string
}

export function asyncComponent<TValue, TSnapshot = unknown>(
  loader: () => Promise<TValue> | TValue,
  options?: AsyncComponentOptions<ReactiveTarget, TValue, TSnapshot>
): Component
export function asyncComponent<TProps extends ReactiveTarget, TValue, TSnapshot = unknown>(
  loader: (props: Props<TProps>) => Promise<TValue> | TValue,
  options?: AsyncComponentOptions<TProps, TValue, TSnapshot>
): ComponentWithProps<TProps>
export function asyncComponent<TProps extends ReactiveTarget, TValue, TSnapshot = unknown>(
  loader: ((props: Props<TProps>) => Promise<TValue> | TValue) | (() => Promise<TValue> | TValue),
  options: AsyncComponentOptions<TProps, TValue, TSnapshot> = {}
): Component | ComponentWithProps<TProps> {
  let clientComponentIndex = 0

  return component<TProps>((props) => {
    const state = reactive({
      id: '' as string,
      status: 'idle' as AsyncStatus,
      value: null as unknown,
      error: null as unknown,
    })
    let inFlight: Promise<void> | null = null

    const context = getRenderContext()
    const runInContext = <T>(fn: () => T) => runWithRenderContext(context, fn)
    if (!state.id) {
      state.id =
        context?.claimComponentId(options.idPrefix) ??
        `${options.idPrefix ?? 'c'}:client:${clientComponentIndex++}`
    }

    if (state.status === 'idle' && context && options.deserialize) {
      const snapshot = context.consumeSnapshot(state.id)
      if (snapshot !== undefined) {
        state.value = options.deserialize(snapshot as TSnapshot, props)
        state.status = 'resolved'
      }
    }

    const start = () => {
      if (inFlight) return inFlight

      state.status = 'pending'
      const task = Promise.resolve()
        .then(() =>
          runInContext(() =>
            (loader as (props: Props<TProps>) => Promise<TValue> | TValue)(props)
          )
        )
        .then((value) => {
          runInContext(() => {
            state.value = value
            state.status = 'resolved'
            if (context && options.serialize) {
              context.recordSnapshot(state.id, options.serialize(value, props))
            }
          })
        })
        .catch((error) => {
          runInContext(() => {
            state.error = error
            state.status = 'rejected'
          })
        })
        .finally(() => {
          inFlight = null
        })

      inFlight = task
      context?.track(task)
      return task
    }

    if (state.status === 'idle') {
      void start()
    }

    return html`${() => {
      if (state.status === 'rejected') {
        if (options.onError) {
          return runInContext(() => options.onError!(state.error, props))
        }
        throw state.error
      }

      if (state.status === 'resolved') {
        return runInContext(() =>
          options.render
            ? options.render(state.value as TValue, props)
            : (state.value as TValue)
        )
      }

      return options.fallback ?? ''
    }}`
  }) as Component | ComponentWithProps<TProps>
}
