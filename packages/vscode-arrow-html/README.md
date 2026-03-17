# ArrowJS Syntax

VS Code syntax highlighting for ArrowJS `html\`...\`` and `t\`...\`` template literals.

This extension injects HTML grammar into Arrow template literals inside:

- JavaScript
- TypeScript
- JSX
- TSX

## What It Does

- Reuses standard HTML TextMate scopes inside Arrow template literals.
- Leaves `${...}` expressions to the surrounding JavaScript or TypeScript grammar.
- Defers colors to the active VS Code theme instead of shipping a fixed palette.

If your theme already colors HTML, those same HTML colors will appear inside Arrow `html\`\`` and `t\`\`` templates.

## Install

Install `ArrowJS Syntax` from the VS Code Marketplace and open any `.js`, `.jsx`, `.ts`, or `.tsx` file that uses Arrow templates.

## Theme Compatibility

This extension is grammar-only. It does not define token colors.

- HTML segments inherit whatever HTML colors your current theme uses.
- `${...}` expressions inherit whatever JavaScript or TypeScript colors your current theme uses.

## Development

From the workspace root:

```bash
pnpm --filter arrowjs-html-syntax test
pnpm --filter arrowjs-html-syntax package
```

The shared tokenizer for Arrow-first tooling lives in `@arrow-js/highlight`. This package is the marketplace-facing editor integration.
