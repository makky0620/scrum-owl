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

| Rule | Level | Reason |
|---|---|---|
| `no-console` | `error` | Enforce use of `logger` utility instead of raw console calls |
| `eqeqeq` | `error` (always) | Prevent type-coercion bugs from `==` |
| `@typescript-eslint/consistent-type-imports` | `error` | Enforce `import type` for type-only imports |
| `@typescript-eslint/explicit-function-return-type` | `error` | Make return types explicit for clarity and type safety |

## Existing Code Fixes

### `src/index.ts`

- Replace `require(filePath)` dynamic load with `await import(filePath)`
- Remove `// eslint-disable-next-line @typescript-eslint/no-require-imports` comment
- Add return type annotations to any functions/callbacks missing them

### `src/utils/logger.ts`

- Keep `/* eslint-disable no-console */` — intentional console usage in the logger wrapper

### All source files

- Convert type-only imports to `import type` where applicable
- Add explicit return type annotations to functions/methods missing them

## Out of Scope

- Switching to `tseslint.configs.strictTypeChecked` (Approach C) — deferred due to complexity
- Adding `@typescript-eslint/no-floating-promises` — requires type-checked parser setup
