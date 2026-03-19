import { html, reactive } from '@arrow-js/core'
import { scenarios } from './scenarios'

function agentIcon() {
  return html`
    <div
      class="w-6 h-6 rounded-full bg-gradient-to-br from-arrow-400 to-arrow-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-arrow-500/20"
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="#18181b">
        <path
          d="M8 1l2.2 4.6L15 6.3l-3.5 3.5.8 4.8L8 12.4l-4.3 2.2.8-4.8L1 6.3l4.8-.7z"
        />
      </svg>
    </div>
  `
}

function typingDots() {
  return html`
    <div class="flex items-start gap-2.5">
      ${agentIcon()}
      <div class="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-zinc-100 dark:bg-zinc-800">
        <div class="flex gap-1 items-center h-5">
          <div class="typing-dot" style="animation-delay:0ms"></div>
          <div class="typing-dot" style="animation-delay:150ms"></div>
          <div class="typing-dot" style="animation-delay:300ms"></div>
        </div>
      </div>
    </div>
  `
}

export function ChatMock() {
  const firstScenario = scenarios[0]

  const st = reactive({
    idx: 0,
    msgs: firstScenario.messages.length,
    typing: false,
    ui: true,
    fading: false,
  })

  let tid: ReturnType<typeof setTimeout>
  let hovered = false

  function schedule(fn: () => void, ms: number) {
    clearTimeout(tid)
    tid = setTimeout(function tick() {
      if (hovered) {
        tid = setTimeout(tick, 250)
        return
      }
      fn()
    }, ms)
  }

  function advanceMessage() {
    const scenario = scenarios[st.idx]
    if (st.msgs < scenario.messages.length) {
      st.typing = true
      schedule(() => {
        st.typing = false
        st.msgs++
        if (st.msgs < scenario.messages.length) {
          schedule(advanceMessage, 500)
        } else {
          schedule(() => {
            st.ui = true
            schedule(nextScenario, 9000)
          }, 350)
        }
      }, 900 + Math.random() * 400)
    }
  }

  function nextScenario() {
    st.fading = true
    schedule(() => {
      st.idx = (st.idx + 1) % scenarios.length
      st.msgs = 0
      st.ui = false
      st.typing = false
      st.fading = false
      schedule(advanceMessage, 350)
    }, 350)
  }

  function jumpTo(i: number) {
    if (i === st.idx) return
    clearTimeout(tid)
    st.fading = true
    setTimeout(() => {
      st.idx = i
      st.msgs = 0
      st.ui = false
      st.typing = false
      st.fading = false
      schedule(advanceMessage, 350)
    }, 350)
  }

  // Start auto-play on client (SSR renders full first scenario)
  if (typeof window !== 'undefined') {
    schedule(nextScenario, 6000)
  }

  return html`
    <div
      @mouseenter="${() => {
        hovered = true
      }}"
      @mouseleave="${() => {
        hovered = false
      }}"
    >
      <div
        class="${() =>
          'transition-opacity duration-300 ' +
          (st.fading ? 'opacity-0' : 'opacity-100')}"
      >
        <!-- Chat window -->
        <div
          class="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-zinc-900/8 dark:shadow-black/25 overflow-visible"
        >
          <!-- Title bar -->
          <div
            class="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/80"
          >
            <div class="flex gap-1.5">
              <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
              <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
              <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
            </div>
            <span class="ml-1.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              ${() => scenarios[st.idx].label}
            </span>
            <div class="ml-auto flex items-center gap-1.5">
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              <span class="text-[10px] text-zinc-400 dark:text-zinc-500">Live</span>
            </div>
          </div>

          <!-- Messages -->
          <div class="p-4 space-y-3 min-h-[320px] overflow-visible">
            ${() =>
              scenarios[st.idx]
                .messages.slice(0, st.msgs)
                .map((m) =>
                  m.role === 'user'
                    ? html`
                        <div class="flex justify-end chat-msg-enter">
                          <div
                            class="px-3.5 py-2 rounded-2xl rounded-tr-sm bg-arrow-500 text-zinc-900 text-[13px] leading-relaxed max-w-[85%] font-medium"
                          >
                            ${m.text}
                          </div>
                        </div>
                      `
                    : html`
                        <div class="flex items-start gap-2.5 chat-msg-enter">
                          ${agentIcon()}
                          <div
                            class="px-3.5 py-2 rounded-2xl rounded-tl-sm bg-zinc-100 dark:bg-zinc-800 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 max-w-[85%]"
                          >
                            ${m.text}
                          </div>
                        </div>
                      `
                )}

            ${() => (st.typing ? typingDots() : '')}

            ${() =>
              st.ui
                ? html`
                    <div class="ml-[34px] overflow-visible chat-msg-enter">
                      <div
                        class="rounded-xl border border-zinc-200/80 dark:border-zinc-700/40 bg-zinc-50/80 dark:bg-zinc-800/20 p-3 overflow-visible"
                      >
                        <div class="overflow-visible">
                          ${scenarios[st.idx].ui()}
                        </div>
                        <div
                          class="mt-2.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/30 flex items-center gap-1.5"
                        >
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            class="text-arrow-500/40"
                          >
                            <path
                              d="M8 1l2.2 4.6L15 6.3l-3.5 3.5.8 4.8L8 12.4l-4.3 2.2.8-4.8L1 6.3l4.8-.7z"
                            />
                          </svg>
                          <span class="text-[9px] font-medium text-zinc-400 dark:text-zinc-500">
                            Generated with ArrowJS Sandbox
                          </span>
                        </div>
                      </div>
                    </div>
                  `
                : ''}
          </div>
        </div>
      </div>

      <!-- Scenario dots -->
      <div class="flex justify-center gap-2 mt-4">
        ${scenarios.map(
          (_, i) => html`
            <button
              @click="${() => jumpTo(i)}"
              class="${() =>
                'h-1.5 rounded-full transition-all duration-300 cursor-pointer outline-none ' +
                (st.idx === i
                  ? 'w-6 bg-arrow-500'
                  : 'w-1.5 bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500')}"
              aria-label="${`Show scenario ${i + 1}`}"
            ></button>
          `
        )}
      </div>
    </div>
  `
}
