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

import type { MessageInstance } from "antd/es/message/interface";
import type { HookAPI } from "antd/es/modal/useModal";
import type { NotificationInstance } from "antd/es/notification/interface";

declare global {
  interface VefGlobal {
    message: MessageInstance;
    notification: NotificationInstance;
    modal: HookAPI;
  }

  // `undefined` until `<ConfigProvider>` registers it via `setVefGlobal`.
  var $vef: VefGlobal | undefined;

  interface Window {
    $vef?: VefGlobal;
  }
}

export {};
