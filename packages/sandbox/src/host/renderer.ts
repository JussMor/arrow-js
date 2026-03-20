import type {
  SandboxedEventPayload,
  SandboxedEventTargetSnapshot,
  SerializedNode,
  VmPatch,
} from '../shared/protocol'

interface RegionAnchor {
  start: Comment
  end: Comment
}

interface RendererOptions {
  mountPoint: Element
  onEvent: (handlerId: string, payload: SandboxedEventPayload) => Promise<void>
  onError: (error: Error | string) => void
}

export class HostRenderer {
  private readonly mountPoint: Element
  private readonly onEvent: RendererOptions['onEvent']
  private readonly onError: RendererOptions['onError']
  private readonly nodes = new Map<string, Node>()
  private readonly regions = new Map<string, RegionAnchor>()
  private readonly elementEvents = new Map<string, Map<string, string>>()
  private readonly nodeIds = new WeakMap<Node, string>()
  private readonly regionStarts = new WeakMap<Node, string>()
  private readonly delegatedListeners = new Map<string, EventListener>()

  constructor(options: RendererOptions) {
    this.mountPoint = options.mountPoint
    this.onEvent = options.onEvent
    this.onError = options.onError
  }

  render(tree: SerializedNode) {
    this.clear()
    const node = this.instantiate(tree)
    this.mountPoint.replaceChildren(node)
  }

  applyPatches(patches: VmPatch[]) {
    for (const patch of patches) {
      this.applyPatch(patch)
    }
  }

  destroy() {
    this.clear()
    this.mountPoint.replaceChildren()
  }

  private clear() {
    for (const [eventType, listener] of this.delegatedListeners) {
      this.mountPoint.removeEventListener(eventType, listener)
    }

    this.delegatedListeners.clear()
    this.nodes.clear()
    this.regions.clear()
    this.elementEvents.clear()
  }

  private instantiate(serialized: SerializedNode): Node {
    switch (serialized.kind) {
      case 'fragment': {
        const fragment = document.createDocumentFragment()
        for (const child of serialized.children) {
          fragment.append(this.instantiate(child))
        }
        return fragment
      }
      case 'element': {
        const element = document.createElement(serialized.tag)
        this.nodes.set(serialized.id, element)
        this.nodeIds.set(element, serialized.id)

        for (const [name, value] of Object.entries(serialized.attrs)) {
          this.writeAttribute(element, name, value)
        }

        for (const [eventType, handlerId] of Object.entries(serialized.events)) {
          this.setEventBinding(serialized.id, eventType, handlerId)
        }

        for (const child of serialized.children) {
          element.append(this.instantiate(child))
        }

        return element
      }
      case 'text': {
        const text = document.createTextNode(serialized.text)
        this.nodes.set(serialized.id, text)
        this.nodeIds.set(text, serialized.id)
        return text
      }
      case 'region': {
        const fragment = document.createDocumentFragment()
        const start = document.createComment('')
        const end = document.createComment('')
        fragment.append(start)
        for (const child of serialized.children) {
          fragment.append(this.instantiate(child))
        }
        fragment.append(end)
        this.regions.set(serialized.id, { start, end })
        this.regionStarts.set(start, serialized.id)
        return fragment
      }
    }
  }

  private applyPatch(patch: VmPatch) {
    switch (patch.type) {
      case 'set-text': {
        const node = this.nodes.get(patch.nodeId)
        if (node) node.textContent = patch.text
        return
      }
      case 'set-attribute': {
        const node = this.nodes.get(patch.nodeId)
        if (node instanceof Element) {
          this.writeAttribute(node, patch.name, patch.value)
        }
        return
      }
      case 'remove-attribute': {
        const node = this.nodes.get(patch.nodeId)
        if (node instanceof Element) {
          node.removeAttribute(patch.name)
        }
        return
      }
      case 'set-event-binding':
        this.setEventBinding(patch.nodeId, patch.eventType, patch.handlerId)
        return
      case 'clear-event-binding':
        this.clearEventBinding(patch.nodeId, patch.eventType)
        return
      case 'replace-region':
        this.replaceRegion(patch.regionId, patch.children)
        return
    }
  }

  private replaceRegion(regionId: string, children: SerializedNode[]) {
    const region = this.regions.get(regionId)
    if (!region) return

    let node = region.start.nextSibling
    while (node && node !== region.end) {
      const next = node.nextSibling
      this.teardownNode(node)
      node.remove()
      node = next
    }

    const parent = region.end.parentNode
    if (!parent) return

    for (const child of children) {
      parent.insertBefore(this.instantiate(child), region.end)
    }
  }

  private teardownNode(node: Node) {
    const nodeId = this.nodeIds.get(node)
    if (nodeId) {
      this.nodes.delete(nodeId)
      this.elementEvents.delete(nodeId)
    }

    const regionId = this.regionStarts.get(node)
    if (regionId) {
      this.regions.delete(regionId)
    }

    if (node instanceof Element) {
      for (const child of Array.from(node.childNodes)) {
        this.teardownNode(child)
      }
    }
  }

  private writeAttribute(
    element: Element,
    name: string,
    value: string | boolean
  ) {
    if (value === true) {
      element.setAttribute(name, '')
      return
    }

    element.setAttribute(name, String(value))
  }

  private setEventBinding(nodeId: string, eventType: string, handlerId: string) {
    const bindings = this.elementEvents.get(nodeId) || new Map<string, string>()
    bindings.set(eventType, handlerId)
    this.elementEvents.set(nodeId, bindings)

    if (this.delegatedListeners.has(eventType)) return

    const listener = (event: Event) => {
      this.dispatchEvent(event).catch(this.onError)
    }

    this.delegatedListeners.set(eventType, listener)
    this.mountPoint.addEventListener(eventType, listener)
  }

  private clearEventBinding(nodeId: string, eventType: string) {
    const bindings = this.elementEvents.get(nodeId)
    bindings?.delete(eventType)
  }

  private findNodeId(node: Node | null): string | undefined {
    let current = node
    while (current) {
      const nodeId = this.nodeIds.get(current)
      if (nodeId) return nodeId
      current = current.parentNode
    }
    return undefined
  }

  private async dispatchEvent(event: Event) {
    const target = event.target instanceof Node ? event.target : null
    const targetId = this.findNodeId(target)
    let current: Node | null = target

    while (current) {
      if (current === this.mountPoint.parentNode) break
      const currentId = this.nodeIds.get(current)
      if (currentId) {
        const bindings = this.elementEvents.get(currentId)
        const handlerId = bindings?.get(event.type)
        if (handlerId) {
          await this.onEvent(
            handlerId,
            this.sanitizeEvent(event, current, currentId, target, targetId)
          )
        }
      }

      if (current === this.mountPoint) break
      current = current.parentNode
    }
  }

  private sanitizeEvent(
    event: Event,
    currentTargetNode: Node,
    currentTargetId: string,
    targetNode: Node | null,
    targetId?: string
  ): SandboxedEventPayload {
    const mouseEvent = event as MouseEvent
    const keyboardEvent = event as KeyboardEvent
    const modifierEvent = event as Event & {
      altKey?: boolean
      ctrlKey?: boolean
      metaKey?: boolean
      shiftKey?: boolean
    }
    const currentTargetSnapshot = this.snapshotEventNode(
      currentTargetNode,
      currentTargetId
    )
    const targetSnapshot = this.snapshotEventNode(targetNode, targetId)

    return {
      type: event.type,
      currentTargetId,
      targetId,
      currentTarget: currentTargetSnapshot,
      target: targetSnapshot,
      srcElement: targetSnapshot,
      value: targetSnapshot?.value ?? currentTargetSnapshot?.value,
      checked: targetSnapshot?.checked ?? currentTargetSnapshot?.checked,
      key: 'key' in keyboardEvent ? keyboardEvent.key : undefined,
      clientX: 'clientX' in mouseEvent ? mouseEvent.clientX : undefined,
      clientY: 'clientY' in mouseEvent ? mouseEvent.clientY : undefined,
      button: 'button' in mouseEvent ? mouseEvent.button : undefined,
      altKey: modifierEvent.altKey,
      ctrlKey: modifierEvent.ctrlKey,
      metaKey: modifierEvent.metaKey,
      shiftKey: modifierEvent.shiftKey,
    }
  }

  private snapshotEventNode(
    node: Node | null,
    _fallbackNodeId?: string
  ): SandboxedEventTargetSnapshot | undefined {
    const element = this.findElement(node)
    if (!element) return undefined

    const snapshotTarget = element as Element & {
      checked?: unknown
      value?: unknown
    }

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      value:
        typeof snapshotTarget.value === 'string'
          ? snapshotTarget.value
          : undefined,
      checked:
        typeof snapshotTarget.checked === 'boolean'
          ? snapshotTarget.checked
          : undefined,
    }
  }

  private findElement(node: Node | null): Element | null {
    let current = node

    while (current) {
      if (current instanceof Element) return current
      current = current.parentNode
    }

    return null
  }
}
