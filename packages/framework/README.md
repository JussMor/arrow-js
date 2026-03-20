# @arrow-js/framework

![ArrowJS](./arrow-logo.png)

ArrowJS is a tiny, type-safe reactive UI runtime built around JavaScript modules, template literals, and the DOM.

[Docs](https://arrow-js.com) · [API Reference](https://arrow-js.com/api) · [Playground](https://arrow-js.com/play/)

## What this package does

`@arrow-js/framework` adds the higher-level runtime pieces that sit on top of `@arrow-js/core`.

It provides:

- `boundary()` for async fallback boundaries
- `render()` and `toTemplate()` helpers
- `renderDocument()` for document-level server responses
- the async component runtime used by SSR and hydration

Use it when your Arrow app needs async components, server rendering, or hydration support.

## Install

```sh
pnpm add @arrow-js/core @arrow-js/framework
```
