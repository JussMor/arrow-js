# @arrow-js/compiler

![ArrowJS](./arrow-logo.png)

ArrowJS is a tiny, type-safe reactive UI runtime built around JavaScript modules, template literals, and the DOM.

[Docs](https://arrow-js.com) · [API Reference](https://arrow-js.com/api) · [Playground](https://arrow-js.com/play/)

## What this package does

`@arrow-js/compiler` is the internal compiler package used by ArrowJS tooling.

It is not meant for normal app imports. It exists to support build-time transforms such as the Vite integration and related compiler experiments.

If you are building an Arrow app, use `@arrow-js/core`, `@arrow-js/framework`, `@arrow-js/ssr`, `@arrow-js/hydrate`, or `@arrow-js/vite-plugin-arrow` instead.
