# Changelog

## 0.1.4

- Fix Arrow directive and property bindings so `${...}` inside quoted attribute values tokenizes as embedded TypeScript.
- Replace the nested string-injection workaround with an Arrow-owned HTML grammar used by both the VS Code extension and docs Shiki renderer.

## 0.1.3

- Rework the TextMate grammars to follow the proven lit-html structure more closely.
- Switch `${...}` handling to the built-in `source.ts#template-substitution-element` grammar.
- Add a second injection grammar so substitutions inside HTML tags keep tokenizing correctly.

## 0.1.2

- Stop using a `meta.embedded.*` content scope for Arrow template HTML.
- Keep the `tokenTypes` override, but move the embedded body back to `text.html.embedded.arrowjs` to avoid themes that flatten all `meta.embedded` content.

## 0.1.1

- Rename Marketplace display name to `ArrowJS Syntax`.
- Add extension icon.
- Refine description to emphasize theme-native HTML highlighting.

## 0.1.0

- Initial preview release.
- Injects HTML syntax into Arrow `html\`\`` and `t\`\`` template literals.
- Defers colors to the active VS Code theme by reusing standard HTML scopes.
