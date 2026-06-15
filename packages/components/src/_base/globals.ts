/// <reference path="../../global.d.ts" />

/**
 * Imperative access to the per-app antd context holders stashed on
 * `globalThis.$vef` for call sites that cannot reach into React (e.g. axios
 * interceptors, plain async helpers). `<ConfigProvider>` calls `setVefGlobal`
 * from inside an effect; the helpers in `_base/helpers/` then read through
 * `getVefGlobal` to dispatch messages, modals, and notifications.
 *
 * The {@link VefGlobal} shape and the `$vef` global are declared ambiently in
 * `../../global.d.ts`, so `globalThis.$vef` is typed directly — no cast. The
 * `/// <reference />` above pulls that declaration in wherever this module is
 * type-checked, so a consumer resolving the package source (the `vef` condition)
 * sees `$vef` without re-declaring it in its own `env.d.ts`, and the built
 * `globals.d.ts` carries it to published consumers.
 */

/**
 * Store the antd context holders so non-React call sites can dispatch UI
 * feedback. Typically invoked once by the framework's `ContextHolder`
 * inside an effect.
 */
export function setVefGlobal(value: VefGlobal): void {
  globalThis.$vef = value;
}

/**
 * Retrieve the antd context holders previously registered by `setVefGlobal`.
 * Throws when `<ConfigProvider>` has not mounted yet so callers get a clear
 * error rather than a cryptic property access on `undefined`.
 */
export function getVefGlobal(): VefGlobal {
  const value = globalThis.$vef;

  if (!value) {
    throw new Error(
      "@vef-framework-react/components: $vef is not initialized. Ensure <ConfigProvider> is mounted before using the imperative message / modal / notification helpers."
    );
  }

  return value;
}
