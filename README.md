<h1 align="center">VEF Framework React</h1>

<p align="center">
  An opinionated React 19 framework for building enterprise internal platforms.
</p>

<p align="center">
  A typed API client, an antd v6 + Emotion component library, reusable hooks, pure utilities, an expression engine, and visual form &amp; approval-flow editors.
</p>

<p align="center">
  <a href="https://coldsmirk.github.io/vef-framework-react-docs/">Documentation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#packages">Packages</a>
</p>

<p align="center">
  <a href="https://github.com/coldsmirk/vef-framework-react/releases"><img src="https://img.shields.io/github/v/release/coldsmirk/vef-framework-react?style=flat-square&label=release" alt="GitHub Release"></a>
  <a href="https://github.com/coldsmirk/vef-framework-react/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/coldsmirk/vef-framework-react/test.yml?branch=main&label=tests&style=flat-square&logo=githubactions" alt="Build Status"></a>
  <a href="https://codecov.io/gh/coldsmirk/vef-framework-react"><img src="https://img.shields.io/codecov/c/github/coldsmirk/vef-framework-react?style=flat-square&logo=codecov&label=codecov" alt="Coverage"></a>
  <a href="https://www.npmjs.com/package/@vef-framework-react/core"><img src="https://img.shields.io/npm/v/@vef-framework-react/core?style=flat-square&logo=npm&label=npm" alt="npm version"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://deepwiki.com/coldsmirk/vef-framework-react"><img src="https://img.shields.io/badge/Ask-DeepWiki-1f6feb?style=flat-square" alt="Ask DeepWiki"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="License"></a>
</p>

VEF Framework React is a pnpm-workspace monorepo of composable packages for building data-heavy internal platforms — API access, UI, state, and form/flow tooling that you would otherwise assemble yourself.

> This README is intentionally brief. Full guides and reference material live on the [documentation site](https://coldsmirk.github.io/vef-framework-react-docs/).

> Development status: actively developed. We prefer additive changes, but some releases may still include breaking changes — see the [release notes](https://github.com/coldsmirk/vef-framework-react/releases).

## Why VEF

- A typed API client over TanStack Query + axios, with business-error handling and automatic token refresh
- 100+ antd v6 + Emotion components, with TanStack Form wrappers (`FormModal` / `FormDrawer` / `Crud`)
- State utilities for Jotai, Zustand, and XState — pick the tool that fits the complexity
- A GoRules ZEN expression runtime for form linkage plus shared condition-operator vocabulary
- Visual form and approval-flow editors designed for forms with hundreds of fields
- Ships as dual ESM/CJS with TypeScript declarations

## Packages

| Package                                                                                                                | Description                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@vef-framework-react/core`](https://www.npmjs.com/package/@vef-framework-react/core)                                 | API client (TanStack Query + axios), `HttpClient` with business errors & token refresh, state utilities, resumable chunked uploads, and an SSE client |
| [`@vef-framework-react/components`](https://www.npmjs.com/package/@vef-framework-react/components)                     | antd v6 + Emotion component library (100+ components), TanStack Form integration, and a semantic color/scene system                                   |
| [`@vef-framework-react/hooks`](https://www.npmjs.com/package/@vef-framework-react/hooks)                               | Reusable React hooks — permission, event, code-set, upload, deep-compare, and more                                                                  |
| [`@vef-framework-react/shared`](https://www.npmjs.com/package/@vef-framework-react/shared)                             | Dependency-free utilities — tree, chrono, color, equality, path, string, event, task, and format helpers                                              |
| [`@vef-framework-react/expression`](https://www.npmjs.com/package/@vef-framework-react/expression)                     | GoRules ZEN expression runtime for form linkage plus shared condition-operator vocabulary                                                             |
| [`@vef-framework-react/starter`](https://www.npmjs.com/package/@vef-framework-react/starter)                           | Ready-to-use layouts and auth components built on TanStack Router                                                                                     |
| [`@vef-framework-react/form-editor`](https://www.npmjs.com/package/@vef-framework-react/form-editor)                   | Visual form-schema editor with ZEN-powered linkage expressions                                                                                        |
| [`@vef-framework-react/approval-flow-editor`](https://www.npmjs.com/package/@vef-framework-react/approval-flow-editor) | Visual approval-flow editor on @xyflow/react with elkjs auto-layout                                                                                   |
| [`@vef-framework-react/dev`](https://www.npmjs.com/package/@vef-framework-react/dev)                                   | Shared ESLint / Stylelint / Commitlint configs, Vite plugins, and TypeScript configs                                                                  |

## Quick Start

Requirements: React 19 or newer.

```bash
pnpm add @vef-framework-react/core @vef-framework-react/components @vef-framework-react/hooks @vef-framework-react/shared
```

Wrap your app in the framework providers, then compose API resources, forms, and views on top. See the [documentation site](https://coldsmirk.github.io/vef-framework-react-docs/) for the full setup guide and examples.

## Development

This repository is a pnpm workspace and requires Node 22+ and pnpm.

```bash
pnpm install        # install dependencies
pnpm playground     # start the playground dev server
pnpm test           # run the test suite
pnpm typecheck      # typecheck all packages
pnpm lint           # lint and auto-fix
pnpm build          # build all packages
```

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
