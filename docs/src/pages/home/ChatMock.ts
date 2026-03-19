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

export function ChatMock() {
  const first = scenarios[0]
  const isClient = typeof window !== 'undefined'

  const st = reactive({
    idx: 0,
    showAgent: true,
    agentChars: 999,
    ui: isClient ? false : true,
    uiVisible: false,
    fading: false,
  })

  let tid: ReturnType<typeof setTimeout>
  let streamTimer: ReturnType<typeof setInterval> | null = null
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

  function stopStream() {
    if (streamTimer) {
      clearInterval(streamTimer)
      streamTimer = null
    }
  }

  function streamAgent(onDone: () => void) {
    const text = scenarios[st.idx].messages[1]?.text || ''
    st.showAgent = true
    st.agentChars = 0
    stopStream()
    streamTimer = setInterval(() => {
      st.agentChars += 2
      if (st.agentChars >= text.length) {
        st.agentChars = text.length
        stopStream()
        onDone()
      }
    }, 18)
  }

  function delay(fn: () => void, ms: number) {
    clearTimeout(tid)
    tid = setTimeout(fn, ms)
  }

  function transitionTo(idx: number, fast = false) {
    st.fading = true
    stopStream()
    clearTimeout(tid)
    const wait = fast ? delay : schedule
    const fadeMs = fast ? 150 : 350
    const pauseMs = fast ? 100 : 400
    const revealMs = fast ? 150 : 350
    setTimeout(() => {
      st.idx = idx
      st.showAgent = false
      st.agentChars = 0
      st.ui = false
      st.uiVisible = false
      st.fading = false
      wait(() => {
        streamAgent(() => {
          wait(() => {
            st.ui = true
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                st.uiVisible = true
                schedule(nextScenario, 8000)
              })
            })
          }, revealMs)
        })
      }, pauseMs)
    }, fadeMs)
  }

  function nextScenario() {
    transitionTo((st.idx + 1) % scenarios.length)
  }

  function jumpTo(i: number) {
    if (i === st.idx) return
    transitionTo(i, true)
  }

  if (isClient) {
    requestAnimationFrame(() => {
      st.ui = true
      requestAnimationFrame(() => {
        st.uiVisible = true
      })
    })
    schedule(nextScenario, 7000)
  }

  return html`
    <div
      @mouseenter="${() => {
        hovered = true
      }}"
      @mouseleave="${() => {
        hovered = false
      }}"
      class="flex flex-col flex-1"
    >
      <div
        data-rain-collider
        class="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-zinc-900/8 dark:shadow-black/25 overflow-visible flex flex-col h-[550px]"
      >
        <div
          class="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/80"
        >
          <div class="flex gap-1.5">
            <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
            <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
            <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
          </div>
          <span class="ml-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            ${() => scenarios[st.idx].label}
          </span>
          <div class="ml-auto flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            <span class="text-[10px] text-zinc-400 dark:text-zinc-500">Live</span>
          </div>
        </div>

        <div class="p-5 overflow-y-auto overflow-x-visible flex-1 flex flex-col">
          <div
            class="${() =>
              'space-y-3 overflow-visible transition-opacity duration-300 ' +
              (st.fading ? 'opacity-0' : 'opacity-100')}"
          >
            ${() => html`
              <div class="flex justify-end">
                <div
                  class="px-3.5 py-2 rounded-2xl rounded-tr-sm bg-arrow-500 text-zinc-900 text-sm leading-snug max-w-[85%] font-medium"
                >
                  ${scenarios[st.idx].messages[0].text}
                </div>
              </div>
            `}

            ${() =>
              st.showAgent
                ? html`
                    <div class="flex items-start gap-2.5">
                      ${agentIcon()}
                      <div
                        class="px-3.5 py-2 rounded-2xl rounded-tl-sm bg-zinc-100 dark:bg-zinc-800 text-sm leading-snug text-zinc-700 dark:text-zinc-300 max-w-[85%]"
                      >
                        ${() => {
                          const full = scenarios[st.idx].messages[1]?.text || ''
                          const len = st.agentChars
                          return len >= full.length ? full : full.slice(0, len)
                        }}
                      </div>
                    </div>
                  `
                : ''}

            ${() =>
              st.ui
                ? html`
                    <div
                      class="${() =>
                        'ml-[34px] overflow-visible ' +
                        (st.uiVisible ? 'chat-ui-enter' : 'opacity-0')}"
                    >
                      <div
                        class="rounded-xl border border-zinc-200/80 dark:border-zinc-700/40 bg-zinc-50/80 dark:bg-zinc-800/20 p-4 overflow-visible"
                      >
                        <div class="overflow-visible">
                          ${() => scenarios[st.idx].ui()}
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
                          <span class="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
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
