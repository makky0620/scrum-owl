# ESLint Strictification Design

**Date:** 2026-03-23
**Status:** Approved

## Overview

Strictify ESLint rules for the scrum-master Discord bot project (TypeScript + Discord.js, CommonJS).
Approach B: moderate strictification with existing code fixes.

## Changes to `eslint.config.mjs`

### Remove

- `globals.browser` — project is a Node.js Discord bot, browser globals are irrelevant

### Existing rules: warn → error

- `@typescript-eslint/no-unused-vars`: `warn` → `error`
- `@typescript-eslint/no-explicit-any`: `warn` → `error`
- `@typescript-eslint/no-require-imports`: `warn` → `error`

### Add new rules

| Rule | Config | Reason |
|---|---|---|
| `no-console` | `error` | Enforce use of `logger` utility instead of raw console calls |
| `eqeqeq` | `['error', 'always']` | Prevent type-coercion bugs from `==` |
| `@typescript-eslint/consistent-type-imports` | `error` | Enforce `import type` for type-only imports |
| `@typescript-eslint/explicit-function-return-type` | `['error', { allowExpressions: true }]` | Make return types explicit on named functions/methods; `allowExpressions: true` exempts anonymous callbacks (e.g. `it(() => ...)`, `collector.on('collect', async (i) => ...)`) |

## Existing Code Fixes

### `src/index.ts` and `src/deploy-commands.ts`

Both files use `require(filePath)` for dynamic command loading with `// eslint-disable-next-line @typescript-eslint/no-require-imports`.

- Replace `require(filePath)` with `await import(filePath)`
- Remove the `eslint-disable-next-line` comment
- **Important:** `await import(filePath)` returns a Module Namespace Object. The CommonJS `module.exports` value is at `.default`. Access must change to `(await import(filePath)).default`.
- Note: TypeScript compiles `import()` to `require()` at build time (`"module": "CommonJS"` in tsconfig), so this is a source/lint-level change and ts-node runtime behavior is unaffected.
- Add return type annotations to any functions/callbacks missing them

### `src/utils/logger.ts`

- Keep `/* eslint-disable no-console */` — intentional console usage in the logger wrapper

### All source files

- Convert type-only imports to `import type` where applicable
- Add explicit return type annotations to exported/named functions and class methods missing them
- Anonymous callbacks (e.g. inside `it()`, `describe()`, event handlers) are exempt due to `allowExpressions: true`

## Out of Scope

- Switching to `tseslint.configs.strictTypeChecked` (Approach C) — deferred due to complexity
- Adding `@typescript-eslint/no-floating-promises` — requires type-checked parser setup
