export const HUSKY_HOOKS = {
  "pre-commit": "pnpm dlx lint-staged",
  "commit-msg": "pnpm dlx commitlint --edit $1",
  "pre-push": "pnpm typecheck && pnpm test"
} as const;

export const LINT_STAGED_CONFIG = {
  "*.{js,ts,tsx,json,jsonc,md,mdx,html}": "eslint --fix",
  "*.{css,scss}": "stylelint --fix"
} as const;

// Scripts the hooks rely on: pre-push runs typecheck + test, and prepare re-runs `vef prepare` on
// every install. Each is added only when absent, so a project's existing definitions are preserved.
export const REQUIRED_SCRIPTS = {
  prepare: "vef prepare",
  typecheck: "tsc --noEmit",
  test: "vitest run --passWithNoTests"
} as const;

// npm scope shared by every framework package. A scaffolded project's deps in this scope are pinned
// to the running CLI's version so a generated app always matches the toolchain that created it.
export const FRAMEWORK_PACKAGE_SCOPE = "@vef-framework-react/";
