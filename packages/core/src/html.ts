import { watch } from './reactive'
import { isChunk, isTpl, queue } from './common'
import { setAttr } from './dom'
import {
  createPropsProxy,
  isCmp,
} from './component'
import type { ComponentCall } from './component'
import {
  expressionPool,
  onExpressionUpdate,
  releaseExpressions,
  storeExpressions,
  updateExpressions,
} from './expressions'
/**
 * An arrow template, one of ArrowJS's core rendering utilities. Specifically,
 * templates are functions that return a function which mounts the template to
 * a given parent node. However, the template also has some other properties on
 * it like `.key` and `.isT`.
 *
 * The "magic" of an arrow template, is any expressions that are in the template
 * literal are automatically observed for changes. When a change is detected,
 * the bound attributes or textNodes are updated.
 */
export interface ArrowTemplate {
  /**
   * Mounts the template to a given parent node.
   */
  (parent: ParentNode): ParentNode
  (): DocumentFragment
  /**
   * A boolean flag that indicates this is indeed an ArrowTemplate.
   */
  isT: boolean
  /**
   * Adds a key to this template to identify it as a unique instance.
   * @param key - A unique key that identifies this template instance (not index).
   * @returns
   */
  key: (key: ArrowTemplateKey) => ArrowTemplate
  /**
   * Yields the underlying chunk object that is used to render this template.
   * @returns
   * @internal
   */
  _c: () => Chunk
  /**
   * Yield the reactive expressions that are contained within this template.
   * Does not contain the expressions that are are not "reactive".
   * @returns
   * @internal
   */
  _e: number
  /**
   * The template key.
   */
  _k: ArrowTemplateKey
  /**
   * The allowed values for arrow keys.
   */
}

type ArrowTemplateKey = string | number | undefined

/**
 * Types of return values that can be rendered.
 */
export type ArrowRenderable =
  | string
  | number
  | boolean
  | null
  | undefined
  | ComponentCall
  | ArrowTemplate
  | Array<string | number | boolean | ComponentCall | ArrowTemplate>

/**
 * A reactive function is a function that is bound to a template. It is the
 * higher order control around the expressions that are in the template literal.
 * It is responsible for updating the template when the expression changes.
 */
export interface ReactiveFunction {
  (el?: Node): ArrowRenderable
  // (ev: Event, listener: EventListenerOrEventListenerObject): void
  $on: (observer: ArrowFunction | null) => ArrowFunction | null
  _up: (newExpression: ReactiveFunction) => void
  e: ArrowExpression
  s: boolean
}

/**
 * An array of reactive functions.
 */
export type ReactiveExpressions = {
  /**
   * The index of the currently active expression.
   */
  i: number
  /**
   * An array of the actual expressions.
   */
  e: ReactiveFunction[]
}

/**
 * An internal primitive that is used to e a dom elements.
 */
export interface ArrowFragment {
  <T extends ParentNode>(parent?: T): T extends undefined ? DocumentFragment : T
}

/**
 * A parent node is either an element or a document fragment — something that
 * can have elements appended to it.
 */
export type ParentNode = Node | DocumentFragment

/**
 * A classification of items that can be rendered within the template.
 */
export type RenderGroup =
  | ArrowTemplate
  | ArrowTemplate[]
  | Node
  | Node[]
  | string[]

/**
 * A function that can be used as an arrow expression — always returns a
 * renderable.
 */
export type ArrowFunction = (...args: unknown[]) => ArrowRenderable

/**
 * The possible value of an arrow expression.
 */
export type ArrowExpression =
  | ArrowRenderable
  | ArrowFunction
  | EventListener
  | ((evt: InputEvent) => void)

/**
 * A chunk of HTML with paths to the expressions that are contained within it.
 */
export interface Chunk {
  /**
   * A compact binding tape plus interned attribute names for the expressions
   * that are contained within the HTML of this chunk.
   */
  readonly paths: [number[], string[]]
  /**
   * A document fragment that contains the HTML of this chunk. Note: this is
   * only populated with nodes until those nodes are mounted.
   */
  dom: DocumentFragment
  /**
   * An array of child nodes that are contained within this chunk. These
   * references stay active even after the nodes are mounted.
   */
  ref: DOMRef
  /**
   * A reference to the template that created this chunk.
   */
  _t: ArrowTemplate
  /**
   * A unique key that identifies this template instance, generally used in
   * list rendering.
   */
  k?: ArrowTemplateKey
  /**
   * Cleanup callbacks for reactive bindings in this chunk.
   */
  u?: Array<() => void> | null
  /**
   * The stable source box used to update component props without rerunning the factory.
   */
  s?: ReturnType<typeof createPropsProxy>[1]
  /**
   * Hydration hooks used to adopt live DOM nodes after SSR.
   */
  _h?: HydrationHook[]
}

interface ChunkProto {
  readonly html: string
  readonly paths: Chunk['paths']
}

/**
 * A reference to the DOM elements mounted by a chunk.
 */
interface DOMRef {
  f: ChildNode | null
  l: ChildNode | null
  adopt: (map: NodeMap) => void
}

interface HydrationHook {
  adopt: (map: NodeMap, visited: WeakSet<Chunk>) => void
}

interface NodeTarget<T extends ChildNode = ChildNode> {
  node: T
}

type NodeMap = WeakMap<Node, Node>

/**
 * A mutable stack of bindings used to create reactive expressions. We
 * initialize this with a large array to avoid memory allocation costs during
 * node creation, and then perform occasional clean up work.
 */
let bindingStackPos = -1
const bindingStack: Array<Node | number> = []
const nodeStack: Node[] = []

/**
 * The delimiter that describes where expressions are located.
 */
const delimiter = '¤'
const delimiterComment = `<!--${delimiter}-->`

/**
 * A memo of pathed chunks that have been created.
 */
const chunkMemo: Record<string, ChunkProto> = {}

type Rendered = Chunk | Text
type RenderController = ((
  renderable: ArrowRenderable
) => DocumentFragment | Text | void) & {
  adopt: (map: NodeMap, visited: WeakSet<Chunk>) => void
}
type InternalTemplate = ArrowTemplate & {
  d?: () => void
  x?: () => void
}

function registerHydrationHook(chunk: Chunk, hook: HydrationHook) {
  chunk._h ??= []
  chunk._h.push(hook)
}

function createNodeTarget<T extends ChildNode>(node: T): NodeTarget<T> {
  return { node }
}

function moveDOMRef(
  ref: DOMRef,
  parent: Node | null,
  before?: ChildNode | null
) {
  let node = ref.f
  if (!parent || !node) return
  const last = ref.l
  if (node === last) {
    parent.insertBefore(node, before || null)
    return
  }
  while (node) {
    const next: ChildNode | null =
      node === last ? null : (node.nextSibling as ChildNode | null)
    parent.insertBefore(node, before || null)
    if (!next) break
    node = next
  }
}

/**
 * The template tagging function, used like: html`<div></div>`(mountEl)
 * @param  {TemplateStringsArray} strings
 * @param  {any[]} ...expressions
 * @returns ArrowTemplate
 */
export function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate
export function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate {
  let chunk: Chunk | undefined
  let expressionPointer = storeExpressions(expSlots)

  function getExpressionPointer() {
    return expressionPointer < 0
      ? (template._e = expressionPointer = storeExpressions(expSlots))
      : expressionPointer
  }

  function getChunk() {
    if (!chunk) {
      chunk = createChunk(
        strings as string[]
      ) as unknown as Chunk
      chunk._t = template
      chunk.k = template._k
    }
    return chunk
  }
  let hasMounted = false

  // The actual template. Note templates can be moved and remounted by calling
  // the template function again. This takes all the rendered dom nodes and
  // moves them back into the document fragment to be re-appended.
  const template = ((el?: ParentNode) => {
    if (!hasMounted) {
      hasMounted = true
      return createBindings(getChunk(), getExpressionPointer(), el)
    } else {
      const chunk = getChunk()
      moveDOMRef(chunk.ref, chunk.dom)
      return el ? el.appendChild(chunk.dom) : chunk.dom
    }
  }) as InternalTemplate

  // If the template contains no expressions, it is 100% static so it's key
  // its own content
  template.isT = true
  template._c = getChunk
  template._e = expressionPointer
  template.key = (key: ArrowTemplateKey): ArrowTemplate => {
    template._k = key
    return template
  }
  template.x = () => {
    if (expressionPointer + 1) {
      releaseExpressions(expressionPointer)
      template._e = -1
      expressionPointer = -1
    }
  }
  template.d = () => {
    hasMounted = false
    chunk = undefined
    template.x?.()
  }
  return template
}

/**
 * Applies bindings to a pathed chunk and returns the resulting document
 * fragment that is ready to mount.
 * @param chunk - A chunk of HTML with paths to the expressions.
 * @param expressions - An expression list with cursor.
 */
function createBindings(
  chunk: Chunk,
  expressionPointer: number,
  el?: ParentNode
): ParentNode | DocumentFragment {
  const totalPaths = expressionPool[expressionPointer] as number
  const [pathTape, attrNames] = chunk.paths
  const stackStart = bindingStackPos + 1
  let tapePos = 0
  nodeStack[0] = chunk.dom
  for (let i = 0; i < totalPaths; i++) {
    const sharedDepth = pathTape[tapePos++]
    let remaining = pathTape[tapePos++]
    let depth = sharedDepth
    let node = nodeStack[depth] as Node
    while (remaining--) {
      node = node.childNodes.item(pathTape[tapePos++])
      nodeStack[++depth] = node
    }
    bindingStack[++bindingStackPos] = node
    bindingStack[++bindingStackPos] = pathTape[tapePos++]
  }
  const stackEnd = bindingStackPos
  for (let s = stackStart, e = expressionPointer + 1; s < stackEnd; s++, e++) {
    const node = bindingStack[s] as ChildNode
    const segment = bindingStack[++s] as number
    if (segment) {
      createAttrBinding(node, attrNames[segment - 1], e, chunk)
    } else {
      createNodeBinding(node, e, chunk)
    }
  }
  bindingStack.length = stackStart
  bindingStackPos = stackStart - 1
  return el ? el.appendChild(chunk.dom) && el : chunk.dom
}

/**
 * Adds a binding for a specific reactive piece of data by replacing the node.
 * @param node - A comment node to replace.
 * @param expression - An expression to bind to the node.
 * @param parentChunk - The parent chunk that contains the node.
 */
function createNodeBinding(
  node: ChildNode,
  expressionPointer: number,
  parentChunk: Chunk
) {
  let fragment: DocumentFragment | Text
  const expression = expressionPool[expressionPointer]
  if (isCmp(expression) || isTpl(expression) || Array.isArray(expression)) {
    // We are dealing with a template that is not reactive. Render it.
    const render = createRenderFn()
    fragment = render(expression)!
    registerHydrationHook(parentChunk, {
      adopt(map, visited) {
        render.adopt(map, visited)
      },
    })
  } else if (typeof expression === 'function') {
    const render = createRenderFn()
    const [frag, stop] = watch(expressionPointer, render)
    ;(parentChunk.u ??= []).push(stop)
    fragment = frag!
    registerHydrationHook(parentChunk, {
      adopt(map, visited) {
        render.adopt(map, visited)
      },
    })
  } else {
    const target = createNodeTarget(document.createTextNode(renderText(expression)))
    fragment = target.node
    onExpressionUpdate(
      expressionPointer,
      (value: string) => (target.node.nodeValue = renderText(value))
    )
    registerHydrationHook(parentChunk, {
      adopt(map) {
        const adopted = map.get(target.node)
        if (adopted) {
          target.node = adopted as Text
        }
      },
    })
  }
  if (node === parentChunk.ref.f || node === parentChunk.ref.l) {
    const last = fragment.nodeType === 11
      ? (fragment.lastChild as ChildNode | null)
      : (fragment as ChildNode)
    if (node === parentChunk.ref.f) {
      parentChunk.ref.f =
        fragment.nodeType === 11
          ? (fragment.firstChild as ChildNode | null)
          : (fragment as ChildNode)
    }
    if (node === parentChunk.ref.l) parentChunk.ref.l = last
  }
  node.parentNode?.replaceChild(fragment, node)
}

/**
 *
 * @param node -
 * @param expression
 */
function createAttrBinding(
  node: ChildNode,
  attrName: string,
  expressionPointer: number,
  parentChunk: Chunk
) {
  if (node.nodeType !== 1) return
  const target = createNodeTarget(node as Element)
  const expression = expressionPool[expressionPointer]
  if (attrName[0] === '@') {
    const event = attrName.slice(1)
    const listener = (evt: Event) =>
      (expressionPool[expressionPointer] as CallableFunction)?.(evt)
    target.node.addEventListener(event, listener)
    target.node.removeAttribute(attrName)
    ;(parentChunk.u ??= []).push(() =>
      target.node.removeEventListener(event, listener)
    )
    registerHydrationHook(parentChunk, {
      adopt(map) {
        const adopted = map.get(target.node)
        if (!adopted) return
        target.node.removeEventListener(event, listener)
        target.node = adopted as Element
        target.node.addEventListener(event, listener)
        target.node.removeAttribute(attrName)
      },
    })
  } else if (typeof expression === 'function' && !isTpl(expression)) {
    // We are dealing with a reactive expression so perform watch binding.
    const [, stop] = watch(expressionPointer, (value) =>
      setAttr(target.node, attrName, value as string)
    )
    ;(parentChunk.u ??= []).push(stop)
    registerHydrationHook(parentChunk, {
      adopt(map) {
        const adopted = map.get(target.node)
        if (adopted) target.node = adopted as Element
      },
    })
  } else {
    setAttr(target.node, attrName, expression as string | number | boolean | null)
    onExpressionUpdate(expressionPointer, (value: string) =>
      setAttr(target.node, attrName, value)
    )
  }
}

/**
 *
 * @param parentChunk - The parent chunk that contains the node.
 */
function createRenderFn(): RenderController {
  let previous: Chunk | Text | Rendered[]
  const keyedChunks: Record<Exclude<ArrowTemplateKey, undefined>, Chunk> = {}
  let updaterFrag: DocumentFragment | null = null

  const render = function render(
    renderable: ArrowRenderable
  ): DocumentFragment | Text | void {
    if (!previous) {
      /**
       * Initial render:
       */
      if (isCmp(renderable)) {
        const [fragment, chunk] = renderComponent(renderable)
        previous = chunk
        return fragment
      } else if (isTpl(renderable)) {
        // do things
        const fragment = renderable()
        previous = renderable._c()
        return fragment
      } else if (Array.isArray(renderable)) {
        let fragment: DocumentFragment
        ;[fragment, previous] = renderList(renderable)
        return fragment
      } else {
        return (previous = document.createTextNode(renderText(renderable)))
      }
    } else {
      /**
       * Patching:
       */
      if (Array.isArray(renderable)) {
        if (!Array.isArray(previous)) {
          // Rendering a list where previously there was not a list.
          const [fragment, newList] = renderList(renderable)
          getNode(previous).after(fragment)
          forgetChunk(previous)
          unmount(previous)
          previous = newList
        } else {
          // Patching a list.
          let i = 0
          const renderableLength = renderable.length
          const previousLength = previous.length
          let anchor: ChildNode | undefined
          const renderedList: Rendered[] = []
          const previousToRemove = new Set(previous)
          if (renderableLength > previousLength) {
            updaterFrag ??= document.createDocumentFragment()
          }
          // We need to re-render a list, to do this we loop over every item in
          // our *updated* list and patch those items against what previously
          // was at that index - with 3 exceptions:
          //   1. This is a keyed item, in which case we need use the memoized
          //      keyed chunks to find the previous item.
          //   2. This is a new item, in which case we need to create a new one.
          //   3. This is an item that as a memo key, if that memo key matches
          //      the previous item, we perform no operation at all.
          for (; i < renderableLength; i++) {
            let item:
              | string
              | number
              | boolean
              | ComponentCall
              | ArrowTemplate = renderable[
              i
            ] as ArrowTemplate
            const prev: Rendered | undefined = previous[i]
            let key: ArrowTemplateKey
            if (
              isTpl(item) &&
              (key = item._k) !== undefined &&
              key in keyedChunks
            ) {
              const keyedChunk = keyedChunks[key]
              // This is a keyed item, so update the expressions and then
              // used the keyed chunk instead.
              updateExpressions(item._e, keyedChunk._t._e)
              if (keyedChunk._t !== item) (item as InternalTemplate).x?.()
              item = keyedChunk._t
            }
            if (i > previousLength - 1) {
              renderedList[i] = mountItem(item, updaterFrag!)
              continue
            }
            const used = patch(item, prev, anchor) as Rendered
            anchor = getNode(used)
            renderedList[i] = used
            previousToRemove.delete(used)
          }
          if (!renderableLength) {
            getNode(previous[0]).after(
              (renderedList[0] = document.createTextNode(''))
            )
          } else if (renderableLength > previousLength) {
            anchor?.after(updaterFrag!)
          }
          previousToRemove.forEach((stale) => {
            forgetChunk(stale)
            unmount(stale)
          })
          previous = renderedList
        }
      } else {
        previous = patch(renderable, previous)
      }
    }
  }

  /**
   * A utility function that renders an array of items for the first time.
   * @param renderable - A renderable that is an array of items.
   * @returns
   */
  function renderList(
    renderable: Array<string | number | boolean | ComponentCall | ArrowTemplate>,
  ): [DocumentFragment, Rendered[]] {
    const fragment = document.createDocumentFragment()
    if (renderable.length === 0) {
      const placeholder = document.createTextNode('')
      fragment.appendChild(placeholder)
      return [fragment, [placeholder]]
    }
    const renderedItems: Rendered[] = []
    renderedItems.length = renderable.length
    for (let i = 0; i < renderable.length; i++) {
      renderedItems[i] = mountItem(renderable[i], fragment)
    }
    return [fragment, renderedItems]
  }

  /**
   * Updates, replaces, or initially renders a node or chunk.
   * @param renderable - The new renderable value.
   * @param prev - The previous node or chunk in this position.
   * @returns
   */
  function patch(
    renderable: Exclude<
      ArrowRenderable,
      Array<string | number | boolean | ComponentCall | ArrowTemplate>
    >,
    prev: Chunk | Text | Rendered[],
    anchor?: ChildNode
  ): Chunk | Text | Rendered[] {
    // This is an update:
    const nodeType = (prev as Node).nodeType ?? 0
    if (isCmp(renderable)) {
      const key = renderable.k
      if (key !== undefined && key in keyedChunks) {
                const keyedChunk = keyedChunks[key]
        if (keyedChunk.s?.[1] === renderable.h) {
          if (keyedChunk.s[0] !== renderable.p) keyedChunk.s[0] = renderable.p
          if (keyedChunk === prev) return prev
          if (anchor) {
            moveDOMRef(keyedChunk.ref, anchor.parentNode, anchor.nextSibling)
          } else {
            const target = getNode(prev, undefined, true)
            moveDOMRef(keyedChunk.ref, target.parentNode, target)
          }
          return keyedChunk
        }
      } else if (isChunk(prev) && prev.s?.[1] === renderable.h) {
        if (prev.s[0] !== renderable.p) prev.s[0] = renderable.p
        if (prev.k !== renderable.k) {
          forgetChunk(prev)
          prev.k = renderable.k
          if (prev.k !== undefined) keyedChunks[prev.k] = prev
        }
        return prev
      }
      const [fragment, chunk] = renderComponent(renderable)
      getNode(prev, anchor).after(fragment)
      forgetChunk(prev)
      unmount(prev)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    } else if (!isTpl(renderable) && nodeType === 3) {
      const value = renderText(renderable)
      if ((prev as Text).data != value) (prev as Text).data = value
      return prev
    } else if (isTpl(renderable)) {
      const chunk = renderable._c()
      if (chunk.k !== undefined && chunk.k in keyedChunks) {
        const keyedChunk = keyedChunks[chunk.k]
        if (keyedChunk === prev) return prev
        if (anchor) {
          moveDOMRef(keyedChunk.ref, anchor.parentNode, anchor.nextSibling)
        } else {
          const target = getNode(prev, undefined, true)
          moveDOMRef(keyedChunk.ref, target.parentNode, target)
        }
        return keyedChunk
      } else if (isChunk(prev) && prev.paths === chunk.paths) {
        // This is a template that has already been rendered, so we only need to
        // update the expressions
        updateExpressions(chunk._t._e, prev._t._e)
        if (chunk._t !== prev._t) (chunk._t as InternalTemplate).x?.()
        return prev
      }

      // This is a new template, render it
      getNode(prev, anchor).after(renderable())
      forgetChunk(prev)
      unmount(prev)
      // If this chunk had a key, set it in our keyed chunks.
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    }
    const text = document.createTextNode(renderText(renderable))
    getNode(prev, anchor).after(text)
    forgetChunk(prev)
    unmount(prev)
    return text
  }

  function mountItem(
    item: string | number | boolean | ComponentCall | ArrowTemplate,
    fragment: DocumentFragment
  ): Rendered {
    if (isCmp(item)) {
      const [inner, chunk] = renderComponent(item)
      fragment.appendChild(inner)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    } else if (isTpl(item)) {
      fragment.appendChild(item())
      const chunk = item._c()
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    }
    const node = document.createTextNode(renderText(item))
    fragment.appendChild(node)
    return node
  }

  function forgetChunk(item: Chunk | Text | Rendered[] | undefined) {
    if (isChunk(item) && item.k !== undefined && keyedChunks[item.k] === item) {
      delete keyedChunks[item.k]
    }
  }

  function renderComponent(renderable: ComponentCall): [DocumentFragment, Chunk] {
    const [props, box] = createPropsProxy(renderable.p, renderable.h)
    const template = renderable.h(props)
    const fragment = template()
    const chunk = template._c()
    chunk.s = box
    chunk.k = renderable.k
    return [fragment, chunk]
  }

  render.adopt = (map: NodeMap, visited: WeakSet<Chunk>) => {
    previous = adoptRenderedValue(previous, map, visited) as
      | Chunk
      | Text
      | Rendered[]
  }

  return render
}

let unmountStack: Array<
  | Chunk
  | Text
  | ChildNode
  | Array<Chunk | Text | ChildNode>
> = []

const queueUnmount = queue(() => {
  const removeItems = (
    chunk:
      | Chunk
      | Text
      | ChildNode
      | Array<Chunk | Text | ChildNode>
  ) => {
    if (isChunk(chunk)) {
      if (chunk.u) {
        for (let i = 0; i < chunk.u.length; i++) chunk.u[i]()
        chunk.u = null
      }
      let node = chunk.ref.f
      if (node) {
        const last = chunk.ref.l
        if (node === last) node.remove()
        else
          while (node) {
            const next: ChildNode | null =
              node === last ? null : (node.nextSibling as ChildNode | null)
            node.remove()
            if (!next) break
            node = next
          }
      }
      ;(chunk._t as InternalTemplate).d?.()
    } else if (Array.isArray(chunk)) {
      for (let i = 0; i < chunk.length; i++) removeItems(chunk[i])
    } else {
      chunk.remove()
    }
  }
  const stack = unmountStack
  unmountStack = []
  for (let i = 0; i < stack.length; i++) removeItems(stack[i])
})

/**
 * Unmounts a chunk from the DOM or a Text node from the DOM
 */
function unmount(
  chunk:
    | Chunk
    | Text
    | ChildNode
    | Array<Chunk | Text | ChildNode>
    | undefined
) {
  if (!chunk) return
  unmountStack.push(chunk)
  queueUnmount()
}

/**
 * Determines if a value is considered empty in the context of rendering a
 * Text node vs a comment placeholder.
 * @param value - Any value that can be considered empty.
 * @returns
 */
function isEmpty(value: unknown): value is null | undefined | '' | false {
  return !value && value !== 0
}

function renderText(value: unknown) {
  return isEmpty(value) ? '' : (value as string)
}

/**
 * Determines what the last node from the last render is so we can append items
 * after it.
 * @param chunk - The previous chunk or Text node that was rendered.
 * @returns
 */
function getNode(
  chunk: Chunk | Text | Array<Chunk | Text> | undefined,
  anchor?: ChildNode,
  first?: boolean
): ChildNode {
  if (!chunk && anchor) return anchor
  if (isChunk(chunk)) {
    return first ? chunk.ref.f || chunk.ref.l! : chunk.ref.l || chunk.ref.f || anchor!
  } else if (Array.isArray(chunk)) {
    return getNode(chunk[first ? 0 : chunk.length - 1], anchor, first)
  }
  return chunk!
}

function adoptRenderedValue(
  value: Chunk | Text | Rendered[] | undefined,
  map: NodeMap,
  visited: WeakSet<Chunk>
): Chunk | Text | Rendered[] | undefined {
  if (!value) return value
  if (isChunk(value)) {
    adoptChunk(value, map, visited)
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => adoptRenderedValue(item, map, visited)) as Rendered[]
  }
  return (map.get(value) as Text | undefined) ?? value
}

export function adoptChunk(
  chunk: Chunk,
  map: WeakMap<Node, Node>,
  visited: WeakSet<Chunk>
) {
  if (visited.has(chunk)) return
  visited.add(chunk)
  chunk.ref.adopt(map)
  chunk._h?.forEach((hook) => hook.adopt(map, visited))
}

/**
 * Creates a new Chunk object and memoizes it.
 * @param rawStrings - Initialize the chunk and memoize it.
 * @param memoKey - The key to memoize the chunk under.
 * @returns
 */
/**
 * Given a string of raw interlaced HTML (the arrow comments are already in the
 * approximately correct place), produce a Chunk object and memoize it.
 * @param html - A raw string of HTML
 * @returns
 */
export function createChunk(
  rawStrings: TemplateStringsArray | string[]
): Omit<Chunk, 'ref'> & { ref: DOMRef } {
  const memoKey = rawStrings.join(delimiterComment)
  const memoized: ChunkProto =
    chunkMemo[memoKey] ??
    (() => {
      const tpl = document.createElement('template')
      tpl.innerHTML = memoKey
      return (chunkMemo[memoKey] = {
        html: memoKey,
        paths: createPaths(tpl.content),
      })
    })()
  const tpl = document.createElement('template')
  tpl.innerHTML = memoized.html
  const dom = tpl.content
  const instance = Object.create(memoized) as Omit<Chunk, 'ref'> & { ref: DOMRef }
  instance.dom = dom
  instance.ref = {
    f: dom.firstChild as ChildNode | null,
    l: dom.lastChild as ChildNode | null,
    adopt(map) {
      if (this.f) this.f = (map.get(this.f) as ChildNode | undefined) ?? this.f
      if (this.l) this.l = (map.get(this.l) as ChildNode | undefined) ?? this.l
    },
  }
  return instance
}

/**
/**
 * Given a document fragment with expressions comments, produce an array of
 * binding instructions to the expressions and attribute expressions.
 * @param dom - A DocumentFragment to locate expressions in.
 * @returns
 */
export function createPaths(dom: DocumentFragment): Chunk['paths'] {
  const pathTape: number[] = []
  const attrNames: string[] = []
  const path: number[] = []
  const previous: number[] = []
  const pushPath = (attrName?: string) => {
    const pathLen = path.length
    const previousLen = previous.length
    const limit = pathLen < previousLen ? pathLen : previousLen
    let sharedDepth = 0
    while (
      sharedDepth < limit &&
      previous[sharedDepth] === path[sharedDepth]
    ) {
      sharedDepth++
    }
    pathTape.push(sharedDepth, pathLen - sharedDepth)
    for (let i = sharedDepth; i < pathLen; i++) pathTape.push(path[i])
    pathTape.push(attrName ? attrNames.push(attrName) : 0)
    previous.length = pathLen
    for (let i = 0; i < pathLen; i++) previous[i] = path[i]
  }
  const walk = (node: Node) => {
    if (node.nodeType === 1) {
      const attrs = (node as Element).attributes
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]
        if (attr.value === delimiterComment) pushPath(attr.name)
      }
    } else if (node.nodeType === 8) {
      pushPath()
    }
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      path.push(i)
      walk(children[i])
      path.pop()
    }
  }
  const children = dom.childNodes
  for (let i = 0; i < children.length; i++) {
    path.push(i)
    walk(children[i])
    path.pop()
  }
  return [pathTape, attrNames]
}

/**
 * Returns a path to a DOM node.
 * @param node - A DOM node (within a fragment) to return a path for
 * @returns
 */
export function getPath(node: Node): number[] {
  const path: number[] = []
  while (node.parentNode) {
    const children = node.parentNode.childNodes as NodeList
    const len = children.length
    for (let i = 0; i < len; i++) {
      const child = children[i]
      if (child === node) {
        path.unshift(i)
        break
      }
    }
    node = node.parentNode
  }
  return path
}
