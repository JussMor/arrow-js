declare module 'jsdom' {
  export type DOMWindow = Window & typeof globalThis

  export class JSDOM {
    constructor(html?: string, options?: { url?: string })
    window: DOMWindow
  }
}
