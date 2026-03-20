# @arrow-js/hydrate

![ArrowJS](./arrow-logo.png)

ArrowJS is a tiny, type-safe reactive UI runtime built around JavaScript modules, template literals, and the DOM.

[Docs](https://arrow-js.com) · [API Reference](https://arrow-js.com/api) · [Playground](https://arrow-js.com/play/)

## What this package does

`@arrow-js/hydrate` adopts existing Arrow SSR HTML in the browser instead of replacing it.

It provides:

- `hydrate()` to attach the client runtime to server-rendered markup
- `readPayload()` to read the serialized SSR payload from the page

Use it together with `@arrow-js/framework` and `@arrow-js/ssr` in SSR applications.

## Install

```sh
pnpm add @arrow-js/core @arrow-js/framework @arrow-js/ssr @arrow-js/hydrate
```

## Example

```ts
import { hydrate, readPayload } from '@arrow-js/hydrate'
import { App } from './App'

await hydrate(document.getElementById('app')!, App(), readPayload())
```
