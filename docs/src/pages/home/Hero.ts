import { html } from '@arrow-js/core'
import { CliCommandIsland } from '../../components/CliCommand'
import { ChatMock } from './ChatMock'

export function HeroChat() {
  return ChatMock()
}

export function Hero() {
  return html`
    <section
      id="hero"
      class="relative flex flex-col items-center justify-center px-6 pt-28 pb-20 lg:pt-32 lg:pb-24 overflow-x-clip"
    >
      <!-- Background effects (preserved from original) -->
      <div class="hero-grid absolute inset-0 pointer-events-none"></div>
      <div
        class="absolute inset-x-0 bottom-0 h-64 pointer-events-none bg-gradient-to-t from-white dark:from-zinc-950 to-transparent"
      ></div>
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-arrow-500/3 dark:bg-arrow-500/4 rounded-full blur-[120px]"
        ></div>
      </div>

      <!-- Two-column hero -->
      <div
        class="relative w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center"
      >
        <!-- Left: pitch -->
        <div class="max-w-xl lg:max-w-lg">
          <h1
            data-rain-collider="text"
            class="text-4xl sm:text-5xl xl:text-[3.5rem] font-extrabold tracking-tighter leading-[1.08] text-zinc-900 dark:text-white"
          >
            The only framework that lets agents build UIs
            <span
              class="text-transparent bg-clip-text bg-gradient-to-r from-arrow-400 via-arrow-500 to-arrow-600"
            >
              you didn't plan&nbsp;for
            </span>
          </h1>

          <p
            class="mt-6 text-base sm:text-[1.0625rem] text-zinc-600 dark:text-zinc-400 leading-relaxed"
          >
            ArrowJS sandboxes untrusted code in a Web Worker while rendering
            full, interactive UIs inline in your app — not trapped in an iframe.
            <span class="font-semibold text-arrow-500">5 KB</span>, zero
            dependencies, no build step. No pre-built component library
            required.
          </p>

          <div class="mt-8">${CliCommandIsland()}</div>
        </div>

        <!-- Right: chat demo -->
        <div class="relative lg:justify-self-end w-full max-w-md lg:max-w-lg xl:max-w-xl">
          <div id="hero-chat-root">${HeroChat()}</div>
        </div>
      </div>
    </section>
  `
}
