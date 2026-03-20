# @arrow-js/ssr

![ArrowJS](./arrow-logo.png)

ArrowJS is a tiny, type-safe reactive UI runtime built around JavaScript modules, template literals, and the DOM.

[Docs](https://arrow-js.com) · [API Reference](https://arrow-js.com/api) · [Playground](https://arrow-js.com/play/)

## What this package does

`@arrow-js/ssr` renders Arrow views to HTML on the server.

It provides:

- `renderToString()` to render a view into HTML and payload data
- `serializePayload()` to embed that payload into the page for hydration

Use it with `@arrow-js/framework` on the server and `@arrow-js/hydrate` in the browser.

## Install

```sh
pnpm add @arrow-js/core @arrow-js/framework @arrow-js/ssr
```
