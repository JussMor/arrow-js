import { html } from '@src/index'
import logoUrl from '../img/logo.png'

export default function layout(body, isDocs = false) {
  return html`
    <div class="container hero">
      <a href="/" aria-label="${isDocs ? 'ArrowJS home' : 'ArrowJS'}">
        <img src="${logoUrl}" class="logo" alt="ArrowJS Logo" />
      </a>
      <ul class="social-links">
        <li>
          <a
            href="https://github.com/justin-schroeder/arrow-js"
            aria-label="GitHub"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87
                2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
                0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21
                2.2.82A7.66 7.66 0 018 4.69a7.66 7.66 0 012.01.27c1.53-1.04
                2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15
                0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2
                0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8Z"
              />
            </svg>
          </a>
        </li>
        <li>
          <a
            href="https://x.com/intent/follow?screen_name=jpschroeder"
            aria-label="Follow on X"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584-6.638
                7.584H.474l8.6-9.83L0 1.153h7.594l5.243 6.932 6.064-6.932Zm-1.291
                19.49h2.039L6.486 3.25H4.298L17.61 20.643Z"
              />
            </svg>
          </a>
        </li>
        <li>
          <a
            class="github-button"
            href="https://github.com/justin-schroeder/arrow-js"
            data-icon="octicon-star"
            data-size="small"
            data-show-count="true"
            aria-label="Star justin-schroeder/arrow-js on GitHub"
          >
            Star
          </a>
        </li>
        <li>
          <button id="theme-toggle" type="button" aria-label="Toggle theme">
            <svg
              class="light-mode"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M256 32a32 32 0 0132 32v48a32 32 0 01-64 0V64a32 32 0 0132-32Zm0
                288a96 96 0 100-192 96 96 0 000 192ZM0 256a32 32 0 0132-32h48a32 32 0
                010 64H32A32 32 0 010 256Zm400 0a32 32 0 0132-32h48a32 32 0 010
                64h-48a32 32 0 01-32-32ZM256 400a32 32 0 0132 32v48a32 32 0 01-64
                0v-48a32 32 0 0132-32ZM73.37 438.63a32 32 0 010-45.26l33.94-33.94a32
                32 0 1145.26 45.26l-33.94 33.94a32 32 0 01-45.26 0Zm286.8-286.8a32
                32 0 010-45.26l33.94-33.94a32 32 0 1145.26 45.26l-33.94 33.94a32 32 0
                01-45.26 0Zm79.2 286.8a32 32 0 01-45.26 0l-33.94-33.94a32 32 0 1145.26-45.26
                l33.94 33.94a32 32 0 010 45.26Zm-320-286.8a32 32 0 01-45.26 0L40.17 117.89a32
                32 0 1145.26-45.26l33.94 33.94a32 32 0 010 45.26Z"
              />
            </svg>
            <svg
              class="dark-mode"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 384 512"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M223.5 32C100 32 0 132.3 0 256s100 224 223.5 224c60.6
                0 115.5-24.2 155.8-63.4 5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8
                1.7-19.8 2.6-30.1 2.6-96.9 0-175.5-78.8-175.5-176 0-65.8 36-123.1
                89.3-153.3 6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8Z"
              />
            </svg>
          </button>
        </li>
      </ul>
    </div>
    ${body}
  `
}
