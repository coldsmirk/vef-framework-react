# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository. Kept in sync with `CLAUDE.md` — edit both together.

## Project Overview

VEF Framework is a React 19 application framework published to npm under `@vef-framework-react/*` (with external consumers). It is a pnpm-workspace monorepo built on TypeScript and Vite. Backwards-incompatible changes affect downstream apps, so prefer additive changes and surface breaking ones explicitly.

## Commands

### Development

- `pnpm playground` — Start the playground dev server
- `pnpm test` — Run all tests
- `pnpm test:watch` — Tests in watch mode
- `pnpm test:coverage` — Coverage report (informational only; not a CI gate)
- `vitest run path/to/file.test.ts` — Run a single test file

### Quality (CI gates)

- `pnpm typecheck` — Typecheck all packages
- `pnpm typecheck:<pkg>` — Typecheck one package (`core` / `components` / `hooks` / `shared` / `dev` / `starter` / `form-editor` / `approval-flow-editor`)
- `pnpm lint` — ESLint `--fix` across the repo
- `eslint --fix <file>` — Lint a single file

### Build

- `pnpm build` — Build all packages
- `pnpm build:<pkg>` — Build one package (`core` / `components` / `hooks` / `shared` / `dev` / `starter`; plus `build:playground`)
- `pnpm clean` — Clean all package build outputs
- `pnpm clean:modules` — Drop all `node_modules` and `pnpm-lock.yaml`

### Dependencies & Metadata

- `pnpm deps:check` — Check inter-package dependency consistency
- `pnpm deps:check:apply` — Apply recommended fixes
- `pnpm sync-meta` — Sync package metadata across the monorepo

### Release

Publishing is **CI-triggered by pushing a `v*` tag** (`.github/workflows/release.yml`) — not by a local `pnpm pub`. Flow:

1. `pnpm version:patch|minor|major` — bump root + every package (`--no-git-tag-version`, so no commit/tag).
2. Commit the bump as `chore(release): vX.Y.Z`.
3. `git tag -a vX.Y.Z -m vX.Y.Z` — the tag **must equal the root `package.json` version** (CI hard-fails otherwise).
4. `git push --follow-tags` — the `v*` tag fires `release.yml`: `install --frozen-lockfile` → tag/version check → `typecheck` → `lint` → `test` → `build` → `pnpm publish` → GitHub Release (notes via git-cliff from Conventional Commits).

- Land feature commits **before** the `chore(release)` commit so git-cliff picks them up.
- **Don't publish with `pnpm pub` / `pnpm release:*` for a real release** — they publish from your machine (local npm auth, skipping CI gates) and double-publish if combined with the tag flow; a published version can't be re-published.
- A failed CI gate blocks the publish but the tag remains — delete the tag, fix, re-tag.

Scripts: `pnpm version:patch|minor|major` (bump only) · `pnpm release:patch|minor|major` (local bump + build + publish, the non-CI path) · `pnpm pub` (local publish, no bump) · `pnpm unpub` (roll back, see `scripts/unpublish.ts`).

## Architecture

### Monorepo Layout

- pnpm workspaces; inter-package deps use `workspace:*`
- Source packages: `packages/*`. Demo app: `playground/`. Plugins: `plugins/`.
- Build orchestration via `pnpm --filter=./packages/* <cmd>`
- **Source resolution**: package `exports` include a `"vef"` condition pointing at `src`; the playground's Vite config and the Vitest config resolve through it (Vitest also via explicit `src` path aliases) to the unbuilt sources for HMR / fast tests without rebuilds.

### Packages

Packages publish under `@vef-framework-react/*` as dual ESM/CJS with TypeScript declarations.

| Package                  | Purpose                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **core**                 | API client (TanStack Query + axios), `HttpClient` with `BusinessError` / token refresh, state utilities (Jotai / Zustand / XState), Immer, selector-based contexts, resumable chunked-upload `Uploader`, SSE client         |
| **components**           | antd v6 + Emotion UI library (100+ components), TanStack Form integration, semantic color/scene system, custom motion/typography components                                                                                 |
| **hooks**                | Reusable React hook library (permission / event / dictionary / upload / deep-compare / etc.)                                                                                                                                |
| **shared**               | Pure-function utilities (tree, chrono, color, equal, key, path, string, event, task, format)                                                                                                                                |
| **starter**              | Ready-to-use layouts and auth components on top of TanStack Router                                                                                                                                                          |
| **form-editor**          | Visual form schema editor; linkage expressions are plain JavaScript via `new Function`. Published under `@vef-framework-react/form-editor`; treat exported APIs and schema shapes as external surface. Targets forms with 100s of fields. |
| **approval-flow-editor** | Visual approval flow editor on @xyflow/react v12 (ReactFlow) + elkjs auto-layout (excluded from test scope — visual canvas)                                                                                                 |
| **approval-form-bridge** | Projection bridge from form-editor schemas to the Go approval form contract: `projectFormSchema` (one walk → backend `FormDefinition` + flow-editor `formFields`, conservation errors for unprojectable keyed fields), `createApprovalRegistries` (approval profile — no switch / daterange / button), `validateApprovalSchema` save gate |
| **dev**                  | Shared ESLint / Stylelint / Commitlint configs, Vite plugins, TypeScript configs                                                                                                                                            |

### Key Patterns

- **API Client** (`packages/core/src/api/client.ts`) wraps `HttpClient` + `QueryClient`. `createQueryFn` injects an invocation-isolated `AbortSignal`; its factory runs once per query execution and must keep cross-request state or side effects outside the factory. `createMutationFn` is constructed once, and `executeMutation()` runs mutations imperatively.
- **HTTP errors** split into `BusinessError` (API returned a non-OK business code; carries `code` / `message` / `data`) and network errors (axios errors for 4xx/5xx, timeouts).
- **Token refresh coordination** (`packages/core/src/http/client.ts`): on a 401 with a configured `tokenExpiredCode`, `HttpClient` publishes one shared refresh promise. Concurrent new requests wait through request-scoped, abort-aware waiters and resume with the renewed token; canceling a waiter or the triggering 401 caller does not cancel the global refresh. After a successful refresh, a live triggering request retries with the renewed token; an automatic refresh failure calls `onUnauthenticated` once even if that caller was canceled. `ensureTokenRefreshed(false)` suppresses the callback only when it owns the refresh cycle.
- **Path parameters**: `:paramName` in the URL is substituted from `params` — `/users/:id` + `{ id: 123 }` → `/users/123`.
- **Auth skip**: set header `X-Skip-Authentication: "1"` to bypass Bearer injection for a single request.
- **File preview bridge**: the framework bundles no viewer library. `components/file-preview` defines the `FilePreviewTarget` / `FilePreviewHandler` contract; the app installs a preview host via `FilePreviewProvider`, and `<Upload>` (and everything built on it) dispatches non-image files to it as normalized targets (`toFilePreviewTarget` reads `UploadedFileMeta` — stamped by `FileUpload` on upload and by `UploadField` on hydrate). Images keep the built-in `Image` modal; without an accepting provider the framework warns and never navigates directly to a URL whose authentication requirements it cannot prove. Private files are fetched or downloaded by the host through `HttpClient.requestFile(url)` / `HttpClient.download(url)` (Bearer + 401 refresh + `Content-Disposition` filename). Reference integration: playground's `@file-viewer/react` host at `playground/src/components/file-viewer-preview-host.tsx`, mounted around the authenticated layout in `pages/_layout/route.tsx` (try it at `sys/file-preview-demo`); the viewer's renderer preset is registered by `fileViewerRenderers()` in `playground/vite.config.ts`.
- **State management**: Jotai for atomic state, Zustand for stores (with `createStore` / `createPersistedStore` middleware stack in `core/store`), XState for complex machines (with `useActor` + selector in `core/state-machine`). Pick by complexity.
- **Forms**: TanStack Form is wrapped by `packages/components/src/form/*` and surfaced through `FormModal` / `FormDrawer` / `Crud`.
- **Linkage expressions**: `form-editor` conditions, assignment expressions, and script actions are all plain JavaScript compiled through `new Function` (`engine/linkage/default-evaluator.ts`) with `field` / `$form`, `$vars`, `$user`, `$node`, and a `Date` `$now` in scope; hosts swap in their own runtime via `LinkageEvaluators`. Expression inputs are CodeMirror (`CodeEditor` from components) with completion off. `approval-flow-editor` condition expressions use the Go engine's own syntax — edited as plain text (no highlighting), validated and evaluated on the backend; its `CONDITION_OPERATORS` vocabulary lives in `approval-flow-editor/src/types.ts`.
- **Global context injection**: `FormRenderer`'s `evaluationContext` (`$user` / `$node` / `$vars` overrides) carries host runtime context into every expression, script, and — via a `$`-rooted `sourceKey` like `$user.departmentId` — visual leaf condition; the designer's `contextSources` prop (`LinkageContextSource[]`) declares those paths for the condition builder's pick list (design-time metadata only). `approval-flow-editor` mirrors this with `EditorPlugins.globalSubjects` (`FormFieldDefinition[]`), layered between the built-in applicant subjects and form fields; the Go engine resolves them from `Instance.Globals`, a server-side snapshot supplied by the host's `InstanceGlobalsResolver` at instance start (never from the client request — globals steer routing).
- **Editor perf at scale**: the form/flow editors target 100s of fields — keep per-keystroke render and per-frame drag cheap (structural sharing in `packages/form-editor/src/engine/schema/mutate.ts`, memoized canvas rows, and don't let `$vars` / expression-scope changes bust cell `memo`). Discrete-action tree walks (drop / duplicate) are not hot paths; don't pre-optimize them.

### Build System

- Vite for all packages via `defineBuildConfig()` (`scripts/build-config.ts`)
- Auto-externalizes deps/peerDeps; Emotion CSS-in-JS transform; `.d.ts` via unplugin-dts
- Requires Node 22+. pnpm version is auto-tracked from `package.json#packageManager` (CI uses `pnpm/action-setup@v4`).

## Testing

Vitest 4 + jsdom + `@testing-library/react`. Test files: `./packages/**/*.test.{ts,tsx}`. Global setup at `./scripts/test-setup.ts` (browser-API mocks, `localStorage` polyfill, jsdom virtual-console filter). The root `vitest.config.ts` enables `globals: true`, so `describe` / `it` / `beforeEach` / `expect` / `vi` are available without imports.

Conventions below follow Testing Library, Kent C. Dodds' Testing Trophy, and the practices of React Aria / Radix / Mantine / TanStack. Existing specs are being aligned; new specs follow these from day one.

### Philosophy

- **Test behavior, not implementation.** Assert on what a caller observes, not internal state, private fields, or refactor-fragile structure.
- **Confidence over coverage.** Prefer integration-level tests (render → interact → assert). Coverage is a side-effect of good tests.
- **One concept per `it`.** Unrelated assertions belong in separate `it` blocks.
- **No flaky tests.** No performance assertions, time-of-day logic, or real-clock `setTimeout` waits.

### File Layout

Specs are **colocated** next to the source: `<name>.test.ts(x)` when the source is `<name>.ts(x)`, or `index.test.ts(x)` when the source is `index.ts(x)`. No `__tests__/` directories.

### Canonical Samples

Reach for these patterns before inventing new ones:

- **Pure utility** — `packages/shared/src/utils/tree.test.ts`
- **Hook with `apiClient` injection** — `packages/hooks/src/use-has-fetching/index.test.ts` (passes `apiClient` to `renderHook`, builds a `queryFn` via `apiClient.createQueryFn`)
- **Component (antd + permission)** — `packages/components/src/permission-gate/index.test.tsx`
- **Component (form submit lifecycle)** — `packages/components/src/form-modal/index.test.tsx`
- **Component (async UI gated by `Promise.withResolvers`)** — `packages/components/src/action-button/index.test.tsx` (loading state under a deferred onClick)
- **`vi.hoisted` + `vi.mock` for a CJS package** — `packages/core/src/http/client.test.ts` (axios)
- **`vi.mock` for a typed SDK module** — `packages/core/src/sse/client.test.ts`
- **In-repo dependency mock at the package boundary** — `packages/components/src/file-upload/index.test.tsx` (mocks `core/Uploader`)
- **Fake-driver scripted backend** — `packages/core/src/storage/uploader.test.ts`
- **Manual `defer<T>()` for deterministic async ordering** — `packages/core/src/http/client.test.ts`, `packages/core/src/storage/uploader.test.ts`

### Imports & Wrappers

- `globals: true` is on — new specs **omit** `describe` / `it` / `expect` / `vi` imports. Existing explicit imports are kept; do not bulk-rename old specs purely to drop them.
- **Component and hook specs go through the package's `test-utils.tsx`** (`packages/components/test-utils.tsx`, `packages/hooks/test-utils.tsx`) — `render` / `renderHook` from that module install `ConfigProvider` / `AppContextProvider` / `ApiClientProvider`. Bypassing the wrapper makes antd and permission-aware code misfire.
- Pull `screen`, `waitFor`, `act`, `within`, etc. from the same `test-utils.tsx` (it re-exports `* from "@testing-library/react"`).
- Specs that touch `useApiClient` / `useMutation` / `useQuery` pass `apiClient` to `render` / `renderHook`; the wrapper installs `ApiClientProvider` (which provides `QueryClientProvider`). Use `createTestApiClient()` for an isolated per-test instance — its default `baseUrl` is `http://vef-test.invalid` so any leaked real network call fails loudly.
- Packages without a local `test-utils.tsx` (currently `core`, `shared`, and `form-editor`) import directly from `@testing-library/react`. They have no provider requirements — `core/state-machine/index.test.ts`, `core/context/disabled.test.tsx`, and `core/context/context-selector.test.tsx` are the canonical examples.

### Structure & Queries

- `describe(module name)` → optional `describe("when <condition>")` → `it("<observable outcome>")`. Descriptions read as sentences: `it("renders the dialog")`, `it("throws when X is missing")`. **Do not prefix with "should"** — third-person verb or imperative statement only.
- Separate happy path, edge cases, and errors into distinct `describe` blocks.
- One `it` per case — do not use `it.each` (it collapses semantically distinct cases under one description and obscures which row failed).
- Prefer accessible queries: `getByRole` / `findByRole` > `getByLabelText` > `getByText` > `getByTestId`. See [Testing Library priority](https://testing-library.com/docs/queries/about#priority).
- `queryBy*` is **only** for absence assertions (`expect(queryBy...).not.toBeInTheDocument()`).
- `findBy*` already waits — do not wrap it in `waitFor`.
- Don't query by CSS class unless the class is a documented contract (e.g. `vef-btn-loading`).

### Interactions & Async

- **`userEvent` only.** Fresh `userEvent.setup()` per test. `userEvent` fires the full pointer/focus chain and flushes microtasks; `fireEvent` does not, which silently breaks antd popover / popconfirm transitions. The repo currently has zero `fireEvent` usage — even antd's hidden `<Upload>` input is driven by `user.upload(input, file)` (see `packages/components/src/file-upload/index.test.tsx`). If a new spec genuinely needs `fireEvent`, justify the exception in the PR description.
- `await findBy*` for elements appearing async; `await waitFor(() => expect(...))` for non-element state.
- `Promise.withResolvers()` (or a hand-rolled `defer<T>()`) gates async flow under test (`action-button`, `http/client`, `uploader`).
- Timer-driven code: `vi.useFakeTimers()` / `vi.useRealTimers()`; flush via `vi.runAllTimers()`, `vi.runAllTimersAsync()`, or `vi.advanceTimersByTime(ms)`. Use `vi.useFakeTimers({ shouldAdvanceTime: true })` when the code under test mixes a real `await` with fake intervals.
- `vi.spyOn(target, "method")` over `vi.fn` whenever you want the original implementation to still run (e.g. silencing `console.warn` while observing calls — see `silenceConsole` in `http/client.test.ts`). Reach for `vi.fn` when constructing a replacement from scratch.
- **Never** `await new Promise(r => setTimeout(r, ms))` — it's flaky, slow, and not what user-visible behavior depends on. Use microtask flushes (`await Promise.resolve()`) for ordering and fake timers for delay-sensitive code.

### Assertions

- Plain `expect().to*` + jest-dom matchers (`toBeInTheDocument`, `toHaveTextContent`, `toHaveAttribute`, `toBeDisabled`, `toHaveValue`). No custom matchers.
- Snapshot tests only for stable structural output (e.g. generated schema). Never for rendered DOM.

### Mocking

- Mock the **network layer** (`axios` / `fetch` / event-source) and **side-effect entry points** of third-party SDKs.
- `vi.hoisted` is required when a `vi.mock` factory needs to reference an outer variable — Vitest hoists `vi.mock` to file-top, and `vi.hoisted` is the only legal way to share state with the factory. See `http/client.test.ts`.
- Browser APIs (`ResizeObserver`, `IntersectionObserver`, `matchMedia`, `localStorage`) are already mocked globally in `scripts/test-setup.ts` — do not duplicate.
- **Do not mock internal modules.** Test through the public API. The fake-driver pattern in `uploader.test.ts` is canonical: construct a typed fake of the boundary, script its responses, record calls for assertion.
- A dependency from another in-repo package counts as a boundary — mocking it is fine when that dependency has its own thorough coverage (e.g. `components/file-upload` mocking `core/Uploader`).
- **Per-test mock isolation:** the project does not run `test.concurrent`, so two patterns coexist legitimately:
  1. **Boundary mocks created once** (`vi.hoisted` instances, module-scoped `vi.fn()` like `mockHasPermission` in `permission-gate`) — cleared in `beforeEach` via `mockClear()` / `mockReset()`. Required for `vi.mock` factories; acceptable elsewhere.
  2. **State-carrying fakes** (call counters, captured payloads, in-memory queues like `use-deep-memo`'s `factoryCallCount`) — must be re-created inside `beforeEach`. If a counter or buffer survives between tests, isolation is gone.
- Reset shared state in `afterEach` via `vi.restoreAllMocks()` / `vi.clearAllTimers()`.

### Hooks

- `renderHook` from the package's local `test-utils.tsx`. The legacy `@testing-library/react-hooks` is not used.
- `act` wrapping is implicit for Testing-Library-triggered updates — wrap manually only when the React warning explicitly asks.
- Read latest value via `result.current` at each assertion point. Don't destructure into a stale binding.

### What Not to Test

- Pure re-export modules: `core/common`, `core/dnd`, `core/immer`, `core/motion`, `core/state`
- Pure antd pass-through components (no behavior beyond a wrapper)
- Pure style / animation components
- Excluded from **coverage** (existing specs still run in `pnpm test`): `starter`, `dev`, `plugins`, `playground`, and the visual canvas in `approval-flow-editor`. `form-editor` IS in test scope (heavily tested) — just without an aggregate threshold yet.
- Generated artifacts (`dist/`, `.d.ts`)

### Coverage & Process

- Package-level thresholds enforced via `vitest.config.ts` for `shared` / `hooks` / `core`. Values reflect the measured baseline minus ~5% buffer; raised stage by stage as new specs land. `components` and `form-editor` are coverage-measured but have no aggregate threshold by design — tracked per-component/feature.
- CI gates on `pnpm typecheck && pnpm lint && pnpm test`. `pnpm test:coverage` runs as an informational artifact only.
- New components and hooks ship with a spec. Exceptions justified in the PR description.
- When modifying any `packages/{shared,hooks,core,components,form-editor}/**` source, update the corresponding spec. Before renaming exports or changing prop types, search for specs asserting the old contract.
- Use `test:` prefix for test-only commits (Conventional Commits, enforced by commitlint).

## Conventions

### Commit Messages

- **Single-line only.** One Conventional Commits header (`type(scope): subject`); no blank line, no body — enforced by commitlint's `body-empty`/`footer-empty` rules (root `commitlint.config.ts` and `@vef-framework-react/dev`'s `defineCommitlintConfig`). Pass exactly one `-m` (keep under ~100 chars). Flag breaking changes with the header `!` (`feat!:`, `feat(scope)!:`) — the `BREAKING CHANGE:` footer is rejected. Extra rationale goes in the PR description or chat, never the commit body.
- `test:` prefix marks test-only commits (commitlint-enforced).

### Naming & Imports

- Filenames: kebab-case. React components: PascalCase.
- No leading-underscore identifiers (e.g. `_handleSubmit`). A `_` prefix is reserved solely for intentionally-unused params/vars (the ESLint `^_` ignore pattern) — never as a naming style for real, used bindings.
- Comments, JSDoc, and inline docs: English only.
- When wrapping a same-named component from another package, alias the imported inner component as `XxxInternal`.
- Imports sorted by perfectionist plugin: type imports first, then external, then internal (alphabetical within group).

### TypeScript

- Strict mode; TypeScript 6+. Avoid `any` — `no-explicit-any` is **off** (a convention, not lint-enforced), so prefer precise types / generics and narrow casts rather than reaching for `any`
- Prefer `interface` over `type` for object shapes
- Array types: `T[]` for simple, `Array<T>` for complex (array-simple rule)
- Max 5 function parameters
- Type safety is not negotiable: prefer an exhaustive `switch` (with `assert-never` / `exhaustive()`) over `as` / widening casts on discriminated unions — never loosen types with a cast where a switch type-checks.

### React & JSX

- No class components, no `defaultProps`, prefer hooks
- No unnecessary `useMemo` / `useCallback`
- JSX props sorted: `key` / `ref` first, then alphabetical, callbacks last

### Formatting

@stylistic/eslint-plugin: 2-space indent, double quotes, semicolons, 120-char line width.

### CSS Styling

- Antd styles live in the `antd` CSS layer; VEF styles already have higher priority — **don't use `!important` or `&&` to override antd**.
- Use `globalCssVars` from `@vef-framework-react/components` for theme variables.
- Many CSS vars (`colorText`, `colorBorder`, `colorBgContainer`) auto-adapt to light/dark — no `.dark` overrides needed.
- Use `html.dark &` only for properties that genuinely differ between themes (gradients, shadows, glass effects).

## Tooling & Workflow

### Git Hooks

- **Pre-commit** (`lint-staged`): runs `eslint --fix` on staged `.js` / `.ts` / `.tsx` / `.json` / `.md` files
- **Pre-push** (`.husky/pre-push`): runs `pnpm typecheck && pnpm test` before any push

### CI

`.github/workflows/test.yml` runs on every PR and push to `main`:

- Gating: `pnpm typecheck` → `pnpm lint` → `pnpm test`
- Informational: `pnpm test:coverage` (uploaded as artifact but not gating)

`.github/workflows/release.yml` runs on a pushed `v*` tag — re-runs the gates, then `pnpm publish` and a GitHub Release (see [Release](#release)).

### Skills to Use

Every package is React 19 — apply these by **default** when writing or reviewing any component / hook (not only for big refactors):

- `/vercel-react-best-practices` — performance & re-render patterns (memoization, derived state, effect deps, large lists)
- `/vercel-composition-patterns` — component API design (compound components, avoid boolean-prop sprawl, lift state, React 19 APIs)
- `/ant-design` — antd 6.x decision guide (component selection, theming/tokens, performance, CRUD / ProComponents); the UI layer is antd v6 + Emotion
- `/frontend-design` — visual design, styling, UI aesthetics
- `/web-design-guidelines` — UI code review (performance, forms, animations; accessibility is not prioritized for this project)
- ReactFlow v12 (`@xyflow/react`) best practices when working in `approval-flow-editor` (its only consumer)
- No `tanstack-form` skill exists — forms go through the `@vef-framework-react/components` form wrapper (`packages/components/src/form/*`)
