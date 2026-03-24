import { component, html, onCleanup, reactive, type Props } from '@arrow-js/core'

const defaultCommand = 'pnpm create arrow-js@latest arrow-app'
const defaultAriaLabel = 'Copy Arrow app scaffold command'

type CliCommandProps = Record<PropertyKey, unknown> & {
  ariaLabel: string
  command: string
}

type CliCommandOptions = {
  ariaLabel?: string | null
  command?: string | null
}

export function resolveCliCommandProps(
  props: CliCommandOptions = {}
): CliCommandProps {
  return {
    command: props.command ?? defaultCommand,
    ariaLabel: props.ariaLabel ?? defaultAriaLabel,
  }
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  textarea.remove()
  return copied
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back to a user-gesture copy path when the async clipboard API is unavailable.
  }

  return fallbackCopyText(text)
}

function getBurstOrigin(event: MouseEvent) {
  const target =
    event.target instanceof Element
      ? event.target.closest('.cli-command')
      : null

  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2 - 8,
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    }
  }

  return {
    x: event.clientX,
    y: event.clientY,
    rect: null,
  }
}

export const CliCommand = component<CliCommandProps>((props: Props<CliCommandProps>) => {
  const state = reactive({ copied: false })
  let timer: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => clearTimeout(timer))

  async function copy(event: MouseEvent) {
    const copied = await copyText(props.command)

    if (!copied) {
      return
    }

    const origin = getBurstOrigin(event)
    document.dispatchEvent(
      new CustomEvent('arrow:copied-burst', {
        detail: {
          count: 25,
          text: 'copied!',
          x: origin.x,
          y: origin.y,
          rect: origin.rect,
        },
      })
    )

    state.copied = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      state.copied = false
    }, 2000)
  }

  return html`
    <button
      data-rain-collider
      @click="${copy}"
      class="cli-command"
      aria-label="${() => props.ariaLabel}"
    >
      <span class="cli-prompt">$</span>
      <code class="cli-text">${() => renderCommand(props.command)}</code>
      <span
        class="${() => state.copied ? 'cli-copy cli-copy--done' : 'cli-copy'}"
      >${() =>
        state.copied
          ? html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3.5 8.5 6.5 11.5 12.5 5.5"></polyline></svg>`
          : html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5"></rect><path d="M10.5 5.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v7A1.5 1.5 0 003 11.5h2.5"></path></svg>`
      }</span>
    </button>
  `
})

function renderCommand(command: string) {
  return command.split(/\s+/).flatMap((token, index) => {
    const className =
      index === 0
        ? 'cli-kw'
        : token.startsWith('@') || token.includes('arrow-js')
          ? 'cli-pkg'
          : index === 1
            ? 'cli-cmd'
            : 'cli-arg'

    return [
      index > 0 ? ' ' : '',
      html`<span class="${className}">${token}</span>`,
    ]
  })
}

export function CliCommandIsland(props?: CliCommandOptions) {
  const resolvedProps = resolveCliCommandProps(props)

  return html`<div
    data-island="cli-command"
    data-command="${resolvedProps.command}"
    data-aria-label="${resolvedProps.ariaLabel}"
  >${CliCommand(resolvedProps)}</div>`
}
