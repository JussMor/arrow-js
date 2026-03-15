import { component, pick, props } from './component'
import { html } from './html'
import { reactive, watch } from './reactive'

export {
  component,
  component as c,
  html,
  html as t,
  pick,
  props,
  reactive,
  reactive as r,
  watch,
  watch as w,
}

export { nextTick } from './common'

export type { ArrowTemplate } from './html'

export type { Props } from './component'

export type { Reactive, ReactiveTarget } from './reactive'
