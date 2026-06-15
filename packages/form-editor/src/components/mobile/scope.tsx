import type { ReactElement, ReactNode } from "react";

import { css, Global } from "@emotion/react";
import ConfigProvider from "antd-mobile/es/components/config-provider";
import zhCN from "antd-mobile/es/locales/zh-CN";
import { createContext, use, useCallback, useState } from "react";

import { admThemeBridge } from "./theme";

/**
 * The mobile render scope's DOM node, published ONLY when the scope opts into
 * overlay containment (a desktop "picture-in-picture" preview). When published,
 * antd-mobile overlays (`Picker` / `DatePicker` / `CalendarPicker`) portal into
 * it via `getContainer` instead of `document.body`, keeping them visually
 * contained to the simulated phone surface. `null` otherwise — i.e. at real
 * mobile runtime, where overlays must use their native body-portaled,
 * viewport-anchored behavior. Also `null` until the scope element mounts.
 */
const MobileScopeContext = createContext<HTMLElement | null>(null);

MobileScopeContext.displayName = "FormEditorMobileScopeContext";

/**
 * An overlay container supplied from OUTSIDE the renderer — the phone shell's
 * screen element. When present it takes over from the MobileScope's own content
 * scope as both the overlay portal target and the fixed-positioning base, so a
 * picker mask/sheet covers the entire phone screen rather than the padded
 * content viewport inside it. Absent (real runtime, or the JSON split preview
 * with no surrounding shell) the scope falls back to self-containment / body.
 */
const OverlayContainerContext = createContext<HTMLElement | null>(null);

OverlayContainerContext.displayName = "FormEditorOverlayContainerContext";

export interface OverlayContainerProviderProps {
  container: HTMLElement | null;
  children: ReactNode;
}

/**
 * Publishes an external overlay container (the phone shell's screen) to the
 * mobile overlays below. The shell promotes that element to a containing block
 * itself, so the scope must not also promote — see {@link MobileScope}.
 */
export function OverlayContainerProvider({ children, container }: OverlayContainerProviderProps): ReactElement {
  return <OverlayContainerContext value={container}>{children}</OverlayContainerContext>;
}

// A flex column filling the host's height (`minHeight: 100%` is a no-op in an
// auto-height host): the scope IS the simulated phone screen, so contained
// overlays anchor to its bottom edge rather than hovering at the form
// content's last pixel, and a child stack's own `flex: 1` (the edit canvas
// body's fill) keeps working through this extra layer.
const scopeCss = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  minHeight: "100%"
});

// Portaling an overlay into the scope is not enough to contain it: antd-mobile
// popups are `position: fixed`, and a fixed box ignores plain ancestors — it
// sizes and positions against the viewport. A no-op transform promotes the
// scope to the containing block for its fixed descendants, so the popup's
// mask + sheet (`inset: 0`) pin to the scope's box — the simulated phone
// screen — instead of flooding the whole browser window.
const containedScopeCss = css({ transform: "translateZ(0)" });

export interface MobileScopeProps {
  children: ReactNode;
  /**
   * Pin `getContainer`-portaled overlays (picker masks and sheets) to this
   * scope's box instead of the browser viewport. This is a DESIGN-TIME concern:
   * the editor renders the mobile form inside a ~414px frame on a desktop
   * canvas (a "picture-in-picture"), so an uncontained overlay would flood the
   * whole browser window. At real mobile runtime the viewport already IS the
   * phone screen, so the native body-portaled / viewport-anchored behavior is
   * correct — hence this defaults to `false` and only the editor's preview
   * surfaces opt in. Off both relaxes the overlay container back to `document.body`
   * AND drops the containing-block transform.
   */
  containOverlays?: boolean;
}

/**
 * Wraps the mobile field tree: marks the subtree `data-device="mobile"`, injects
 * the antd-mobile → VEF theme bridge, applies the zh-CN locale, and (only when
 * `containOverlays`) publishes its own DOM node so overlays stay penned to the
 * simulated phone surface. Mounted by the editor canvas (mobile surface) and the
 * standalone `FormRenderer` when `device === "mobile"`.
 */
export function MobileScope({ children, containOverlays = false }: MobileScopeProps): ReactElement {
  const externalContainer = use(OverlayContainerContext);
  const [node, setNode] = useState<HTMLElement | null>(null);

  // An external container (the phone shell's screen) is already promoted to a
  // containing block and serves as the overlay anchor, so the scope must NOT
  // promote itself — a nearer transform ancestor would re-pin the fixed mask to
  // this padded content box. Self-contain only when there is no external
  // container AND containment was requested (the JSON split preview).
  const selfContain = containOverlays && externalContainer === null;

  return (
    <>
      <Global styles={admThemeBridge} />

      <div ref={setNode} css={[scopeCss, selfContain && containedScopeCss]} data-device="mobile">
        <ConfigProvider locale={zhCN}>
          {/* Publish the node only when self-containing: otherwise the container
              comes from the external context, or falls through to body. */}
          <MobileScopeContext value={selfContain ? node : null}>
            {children}
          </MobileScopeContext>
        </ConfigProvider>
      </div>
    </>
  );
}

/**
 * A `getContainer` callback for antd-mobile overlays. Prefers an externally
 * supplied container (the phone shell's screen — covering the whole screen),
 * then the self-contained scope node (the JSON split preview), then
 * `document.body` (real runtime, or before mount). The `--adm-*` theme bridge
 * lives at `:root`, so a body-portaled overlay stays themed regardless.
 */
export function useMobileScopeContainer(): () => HTMLElement {
  const externalContainer = use(OverlayContainerContext);
  const node = use(MobileScopeContext);

  return useCallback(() => externalContainer ?? node ?? document.body, [externalContainer, node]);
}
