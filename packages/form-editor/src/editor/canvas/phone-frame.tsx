import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { useState } from "react";

import { OverlayContainerProvider } from "../../components/mobile/scope";

/* -- Mobile device frame --------------------------------------------------- */

// A simulated iPhone shell wrapping the mobile design surface, so the canvas
// reads as a real device preview (the convention in Framer / Figma / form
// builders). The hardware chrome — bezel, Dynamic Island, home indicator — is
// fixed dark "titanium" that holds on both a light and a dark canvas: a real
// phone's frame does not retheme. Only the screen inside follows the VEF
// tokens, so a dark-mode design still previews dark behind the same shell.

// The logical mobile width the layout targets and a true iPhone aspect
// (414 : 896 ≈ 19.5:9, the iPhone 11 / XR screen), plus the bezel thickness.
// Screen content keeps the same 414 width the runtime assumes, so nothing about
// the form's own layout shifts — the editor stays a true-width WYSIWYG at 1:1,
// in both edit and preview. The frame keeps that real width and FILLS the canvas
// height (capped at its natural size — see `phoneFrameCss`): a fixed height
// overflowed a short canvas, while sizing the frame by height alone would either
// distort the aspect or squeeze the 414px form into a narrow screen. Scaling the
// whole device would fix the aspect but re-base the drag ghost's fixed-position
// coordinates (the ghost lives inside the frame), so true width + fill height is
// the drag-safe, fidelity-preserving choice — squatter than a real phone only
// when the canvas is shorter than the device.
const PHONE_SCREEN_WIDTH = 414;
const PHONE_SCREEN_HEIGHT = 896;
const PHONE_BEZEL = 12;
// The outer device size — screen plus a bezel on every edge. The frame holds
// this WIDTH and caps its fill-height at this HEIGHT (its natural size).
const PHONE_FRAME_WIDTH = PHONE_SCREEN_WIDTH + PHONE_BEZEL * 2;
const PHONE_FRAME_HEIGHT = PHONE_SCREEN_HEIGHT + PHONE_BEZEL * 2;
// Status-bar room under the Dynamic Island, and home-indicator room at the
// bottom — the device's safe-area insets, so content never sits under either.
const PHONE_SAFE_TOP = 52;
const PHONE_SAFE_BOTTOM = 26;

// Fills the canvas and centers the device inside it. A flex child that grows to
// the canvas's full height (`flex: 1`) with `min-height: 0` so it tracks the
// canvas rather than its own content — the frame then takes its height from this
// box, so the device fills the canvas (up to its natural height): no overflow,
// no scrolling to reveal a clipped phone.
const phoneStageCss = css({
  display: "flex",
  flex: 1,
  minHeight: 0,
  alignItems: "center",
  justifyContent: "center",
  width: "100%"
});

const phoneFrameCss = css({
  position: "relative",
  flexShrink: 0,
  boxSizing: "border-box",
  // True device width, fill the canvas height, cap at the natural size. Filling
  // the height (instead of a fixed height) is what keeps the device inside a
  // short canvas — no overflow. The cap stops a tall canvas from stretching the
  // frame skinny past a real phone; below it the frame just gets squatter than a
  // real device. No transform/zoom: a scaled ancestor would re-base the in-frame
  // drag ghost's fixed coordinates (see the constants note above).
  width: PHONE_FRAME_WIDTH,
  height: "100%",
  maxHeight: PHONE_FRAME_HEIGHT,
  padding: PHONE_BEZEL,
  borderRadius: 54,
  // Brushed-titanium bezel: a soft diagonal metal gradient, lifted off the
  // canvas with a broad ambient shadow plus a contact shadow, and finished
  // with inset rim highlights/shadows so the edge catches light on either theme.
  background: "linear-gradient(135deg, #44444b 0%, #26262b 52%, #35353b 100%)",
  boxShadow: [
    "0 22px 50px -10px rgba(0, 0, 0, 0.5)",
    "0 3px 12px rgba(0, 0, 0, 0.35)",
    "inset 0 1px 1px rgba(255, 255, 255, 0.16)",
    "inset 0 -1px 2px rgba(0, 0, 0, 0.45)"
  ].join(", ")
});

// The "glass" of the screen: the physical display area. It clips its content to
// the screen's rounded corners and is the box a picker overlay is penned to (see
// `containedOverlayCss`); `position: relative` makes it the offset parent the
// absolute-rebased overlay anchors against.
const phoneScreenCss = css({
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  borderRadius: 42,
  background: globalCssVars.colorBgContainer,
  // A thin inner glass edge between the screen and the metal bezel.
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.55)"
});

// antd-mobile overlays are `position: fixed` (viewport-anchored). In the phone
// shell they portal into the screen (getContainer → screen, via
// OverlayContainerProvider), and this re-bases them from the viewport to the
// screen's box by overriding fixed → absolute: the screen is `position: relative`,
// so the popup fills it and the mask / sheet pin to it — a picker stays penned to
// the simulated phone instead of flooding the browser. It contains them WITHOUT a
// transform; a transform would establish the same containing block but ALSO
// re-base the drag ghost's fixed coordinates and break reordering in edit mode.
// Scoped to the screen, so real mobile runtime (no shell) keeps its native
// viewport-anchored overlays. Higher specificity than antd-mobile's single-class
// rules, so no `!important` is needed.
const containedOverlayCss = css({
  "& .adm-popup, & .adm-center-popup": {
    position: "absolute",
    inset: 0
  },
  "& .adm-mask, & .adm-popup-body, & .adm-center-popup-wrap": {
    position: "absolute"
  }
});

// The scrolling content viewport inside the screen. Carries the device's
// safe-area insets (status bar / home indicator) plus the form's horizontal
// padding. A picker mask covers the screen ABOVE this — the insets pad the
// content, never the overlay.
export const phoneViewportCss = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  overflow: "auto",
  padding: `${PHONE_SAFE_TOP}px ${globalCssVars.spacingXl} ${PHONE_SAFE_BOTTOM}px`,
  // Read as glass, not a scroll pane — the device hides its scrollbar.
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" }
});

// The Dynamic Island: a solid black pill floating in the top safe area, the
// single most recognizable cue that this is an iPhone. Non-interactive.
const dynamicIslandCss = css({
  position: "absolute",
  top: PHONE_BEZEL + 9,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10,
  width: 116,
  height: 33,
  borderRadius: 999,
  background: "#000",
  pointerEvents: "none"
});

// The home indicator: a rounded bar at the bottom safe area. Tinted from the
// screen's own text color so it reads on both a light and a dark design.
const homeIndicatorCss = css({
  position: "absolute",
  bottom: PHONE_BEZEL + 8,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10,
  width: 132,
  height: 5,
  borderRadius: 999,
  background: globalCssVars.colorText,
  opacity: 0.28,
  pointerEvents: "none"
});

/**
 * The simulated-iPhone shell around the mobile design / preview surface. Owns
 * the screen-node state it publishes to the mobile overlays (edit + preview) via
 * {@link OverlayContainerProvider}, so a tapped picker is penned to the whole
 * screen (state, not a ref, so the provider re-renders once the node mounts).
 * The caller's `surface` (its viewport scroller — see {@link phoneViewportCss})
 * goes inside the screen. No transform anywhere on the chain, so the in-frame
 * drag ghost's fixed coordinates stay correct and edit-mode reordering works.
 */
export function PhoneFrame({ children }: { children: ReactNode }): ReactElement {
  const [screenNode, setScreenNode] = useState<HTMLElement | null>(null);

  return (
    <div css={phoneStageCss}>
      <div css={phoneFrameCss}>
        <span css={dynamicIslandCss} />

        <div ref={setScreenNode} css={[phoneScreenCss, containedOverlayCss]}>
          {/* Pen mobile pickers to the screen in BOTH edit and preview: the
              overlay portals here and `containedOverlayCss` re-bases it to this
              box — no transform, so edit-mode dragging stays intact. */}
          <OverlayContainerProvider container={screenNode}>{children}</OverlayContainerProvider>
        </div>

        <span css={homeIndicatorCss} />
      </div>
    </div>
  );
}
