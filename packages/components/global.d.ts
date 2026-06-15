/**
 * The ambient `$vef` global — the per-app antd message / notification / modal
 * holders that {@link setVefGlobal} stashes on `globalThis` (see
 * `./src/_base/globals.ts`).
 *
 * `globals.ts` carries a `/// <reference path="../../global.d.ts" />` to this
 * file, so the declaration travels with `globals.ts` into any program that
 * imports `@vef-framework-react/components`: dev consumers resolving the package
 * source (the `vef` condition) get `$vef` / `VefGlobal` without re-declaring them
 * in their own `env.d.ts`, and the built `globals.d.ts` carries it to published
 * consumers the same way. Nothing outside this package needs to reference it
 * directly — imperative call sites use the `showXxxMessage` helpers instead.
 */

declare global {
  interface VefGlobal {
    message: import("antd/es/message/interface").MessageInstance;
    notification: import("antd/es/notification/interface").NotificationInstance;
    modal: import("antd/es/modal/useModal").HookAPI;
  }

  // `undefined` until `<ConfigProvider>` registers it via `setVefGlobal`.
  var $vef: VefGlobal | undefined;

  interface Window {
    $vef?: VefGlobal;
  }
}

export {};
