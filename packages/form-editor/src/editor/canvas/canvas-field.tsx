import type { MouseEvent, ReactElement, ReactNode } from "react";

import type { Block } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars } from "@vef-framework-react/components";
import { useDraggable } from "@vef-framework-react/core";
import { createContext, use } from "react";

import { isLeafField } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { FIELD_DRAG_TYPE } from "../dnd";
import { removeNodeWithConfirm } from "../remove-node-confirm";

/**
 * True when this block or an ancestor is being dragged — i.e. it lives inside the
 * drag ghost's subtree. A container body reads this to render none of its drop
 * zones while dragging: the whole subtree travels with the cursor, so its zones
 * would be stray indicators, and dropping a block into its own descendants is
 * invalid anyway (guarded in `edit-ops`). Each {@link CanvasField} ORs its own
 * drag state into the value it provides, so the flag cascades to any depth.
 */
export const SubtreeDraggingContext = createContext(false);
SubtreeDraggingContext.displayName = "SubtreeDraggingContext";

// Zero-footprint chrome: the wrapper adds no box-model space of its own — no
// padding, no margin — so every block lays out on the canvas exactly as the
// runtime renderer lays it out, and design mode is the preview pixel for
// pixel. Design-time affordances on it are paint-only (outline / background /
// absolutely-positioned bars). The 2px outline offset floats the hover /
// selection ring just off the control's true box for breathing room — outline
// has no layout footprint, so the ring rides into the stack gap for free.
const wrapperCss = css({
  position: "relative",
  height: "100%",
  width: "100%",
  borderRadius: globalCssVars.borderRadius,
  outline: "1px solid transparent",
  outlineOffset: 2,
  background: "transparent",
  cursor: "pointer",
  transition: [
    `outline-color ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,
    `background ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,
    `box-shadow ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`
  ].join(", "),
  boxSizing: "border-box",

  // Innermost-only hover: `:hover` matches every ancestor under the pointer,
  // so without the guard a nested field lights its whole container chain at
  // once (a wash per level) and the canvas reads as boxes inside boxes. The
  // `:has()` guard keeps the affordance on the block a click would actually
  // select. Selected blocks opt out entirely — the selection ring already
  // marks them, and a hover wash on top would re-tint the ring's interior.
  // The dragging ghost opts out too: this selector now out-ranks the
  // `[data-dnd-dragging]` rule below, so without the guard the ghost (always
  // under the pointer) would trade its solid card for the translucent wash.
  "&:hover:not([data-selected]):not([data-dnd-dragging]):not(:has([data-canvas-field]:hover))": {
    outlineColor: globalCssVars.colorBorder,
    background: globalCssVars.colorFillQuaternary
  },

  // While dragging, this wrapper IS dnd-kit's feedback ghost (marked
  // `data-dnd-dragging`, lifted to a fixed overlay that follows the pointer
  // while a hidden placeholder holds its slot). Keep it fully opaque — a faded
  // ghost reads as disabled — and lift it onto a solid, shadowed card so the
  // moved block reads as picked-up. dnd-kit owns this element's position /
  // transform via `!important`, so only paint properties are set here.
  "&[data-dnd-dragging]": {
    background: globalCssVars.colorBgContainer,
    outlineColor: globalCssVars.colorBorder,
    boxShadow: globalCssVars.shadowLg
  }
});

const selectedCss = css({
  // A crisp accent ring floating just off the block's edge IS the selection —
  // no fill, no halo. Every document-flow wrapper is full width, so the old
  // tinted wash + 4px glow read as a giant closed cage around a small control
  // (a button row drowned in a canvas-wide blue slab). The ring marks the
  // same extent without enclosing it; the floating action bar carries the
  // accent weight. Matches the approval-flow editor's ring-only selection.
  // 2px (not 1.5) so the width never rounds down to a hairline on 1x displays.
  outline: `2px solid ${globalCssVars.colorPrimary}`,

  // Placement mode (the shell root carries `data-drag-active` while any drag is
  // in flight): the only accent the eye should track is the drop indicator, so
  // the selection ring recedes to a quiet neutral outline for the duration.
  // Pure CSS so a drag start/end re-renders no blocks.
  "[data-drag-active] &": {
    outline: `1px solid ${globalCssVars.colorBorder}`
  }
});

const actionsCss = css({
  position: "absolute",
  // An accent "control bar" floated just *above* the block's top-left corner,
  // outside the block's own box, so it never sits over the block's label or
  // control — the block keeps all of its own space. `bottom: 100%` rests the
  // bar's hit box flush on the top edge; the visible pill detaches via the
  // transparent `paddingBottom` below. Left-anchored (the name-tag corner in
  // Formily / Webflow): the floating properties panel overlays the canvas's
  // right edge, so a right-anchored bar on any full-width block — every
  // root-level block — would sit underneath the panel exactly while that
  // block is selected. A high z-index keeps it above any neighbour it may
  // briefly overlap (the transient cost of living outside the box).
  bottom: "100%",
  left: 0,
  zIndex: 3,
  // Hover bridge: the visual gap between the pill and the block must live
  // INSIDE the bar's box as transparent padding, never as empty space between
  // the two — a real gap would be a hover dead zone (the pointer crossing it
  // leaves the block's hover chain, the bar folds away, and its actions
  // become unreachable). The bar is a descendant of the block wrapper, so as
  // long as the pointer stays inside this box, `:hover` holds. 8px puts the
  // pill's bottom edge 4px clear of the selection ring's outer edge (2px
  // offset + 2px width).
  paddingBottom: 8,
  display: "flex",
  opacity: 0,
  transform: "scale(0.96)",
  transformOrigin: "bottom left",
  transition: [
    `opacity ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `transform ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),
  pointerEvents: "none",

  // Reveal on the innermost hovered block only (`:hover` matches the whole
  // ancestor chain, which used to pop one bar per nesting level at once), and
  // on the selected block — its bar is the only path to grip-drag / duplicate
  // / delete, independent of where the pointer rests.
  "[data-canvas-field]:hover:not(:has([data-canvas-field]:hover)) > &, [data-canvas-field][data-selected='true'] > &": {
    opacity: 1,
    transform: "scale(1)",
    pointerEvents: "auto"
  },

  // …except while a descendant block is hovered: a child slot near the
  // container's top-left corner would pop its bar right on top of the
  // selected container's (both anchor that corner), stacking two accent
  // pills. Yield to the hovered child's bar — the selected bar returns the
  // moment the pointer leaves the container's interior.
  "[data-canvas-field][data-selected='true']:has([data-canvas-field]:hover) > &": {
    opacity: 0,
    pointerEvents: "none"
  },

  // Placement mode: fold every action toolbar away — it is unusable mid-drag,
  // and as another accent surface it would clash with the drop indicator. The
  // longer selectors re-assert the reveal rules above so hover / selection
  // cannot bring the bar back while dragging.
  "[data-drag-active] &, [data-drag-active] [data-canvas-field]:hover:not(:has([data-canvas-field]:hover)) > &, [data-drag-active] [data-canvas-field][data-selected='true'] > &": {
    opacity: 0,
    pointerEvents: "none"
  }
});

// The visible pill of the action bar — the accent fill matches the selection
// ring, tying the bar to the same selection system. Split from the positioned
// carrier above so the carrier's bottom padding can stay transparent (the
// hover bridge) while the pill paints opaque.
const actionsPillCss = css({
  display: "flex",
  alignItems: "center",
  gap: 1,
  padding: 3,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorPrimary,
  boxShadow: globalCssVars.shadowMd,
  color: globalCssVars.colorWhite
});

// A translucent-white hairline separating the "move" handle from the actions.
const actionDividerCss = css({
  width: 1,
  height: 16,
  margin: "0 2px",
  flexShrink: 0,
  background: `color-mix(in srgb, ${globalCssVars.colorWhite} 28%, transparent)`
});

const actionButtonCss = css({
  width: 26,
  height: 26,
  borderRadius: globalCssVars.borderRadiusSm,
  padding: 0,
  // White glyphs on the accent bar, with a translucent-white press/hover wash.
  // VEF styles outrank the antd layer, so this sets the text-button colours
  // without `!important` / `&&`.
  color: globalCssVars.colorWhite,

  "&:hover": {
    color: globalCssVars.colorWhite,
    background: `color-mix(in srgb, ${globalCssVars.colorWhite} 18%, transparent)`
  },

  "& svg": {
    width: 14,
    height: 14
  }
});

// Delete stays white at rest and turns to a solid destructive-red highlight on
// hover, so the warning reads clearly even on the accent bar — at the moment of
// intent rather than ambiently.
const deleteButtonCss = css(actionButtonCss, {
  "&:hover": {
    color: globalCssVars.colorWhite,
    background: globalCssVars.colorError
  }
});

const gripCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  borderRadius: globalCssVars.borderRadiusSm,
  // The handle is the quietest glyph (dimmed white), brightening on hover.
  color: `color-mix(in srgb, ${globalCssVars.colorWhite} 72%, transparent)`,
  cursor: "grab",
  transition: [
    `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),

  "&:hover": { color: globalCssVars.colorWhite, background: `color-mix(in srgb, ${globalCssVars.colorWhite} 18%, transparent)` },
  "&:active": { cursor: "grabbing" },

  "& svg": { width: 14, height: 14 }
});

// The offscreen-skip boundary for big forms, applied to every leaf preview.
// `content-visibility: auto` lets the browser skip layout/paint for off-viewport
// previews (the antd control is the heavy part of a block), and the `auto` in
// `contain-intrinsic-size` remembers each preview's real size once rendered so
// scrollbar geometry stays honest. It must sit HERE and not on the stack slot:
// content-visibility implies paint containment, and on any ancestor of the
// floating action bar it would clip the bar away (the bar hangs above the
// wrapper, outside every ancestor box up to the slot). The bar is a sibling of
// this shield, so nothing escapes the contained box. Containers are never
// shielded: their bodies hold nested fields and drop zones that stay interactive.
const previewShieldCss = css({
  contentVisibility: "auto",
  containIntrinsicSize: "auto 72px"
});

export interface CanvasFieldProps {
  block: Block;
  children: ReactNode;
}

function stop(event: MouseEvent): void {
  event.stopPropagation();
}

/**
 * Selection + drag wrapper for one canvas block (field or container). Click to
 * select; drag the grip handle in the toolbar to move the block — the card body
 * itself is not a drag activator, so clicking/interacting with it never starts a
 * drag. The beside / row-gap drop zones are rendered by the container body
 * around this wrapper, not inside it, so they never travel with a dragged block.
 * A hover/selection action toolbar holds the drag grip plus duplicate + delete.
 */
export function CanvasField({
  block,
  children
}: CanvasFieldProps): ReactElement {
  const isSelected = useFormEditorStore(s => s.selectedId === block.id);
  const storeApi = useFormEditorStoreApi();
  const ancestorDragging = use(SubtreeDraggingContext);
  // `handleRef` restricts drag activation to the grip: dnd-kit binds the
  // pointerdown listener to `handle ?? element`, so wiring the grip as the
  // handle means only it starts a drag, not the whole card.
  const {
    handleRef,
    isDragging,
    ref
  } = useDraggable({
    id: block.id,
    type: FIELD_DRAG_TYPE,
    data: { kind: "block", nodeId: block.id }
  });

  // This block is part of the drag ghost when it is itself dragged or any
  // ancestor is. Provide that down so the container body it wraps renders no
  // drop zones while the whole subtree travels with the cursor.
  const subtreeDragging = isDragging || ancestorDragging;

  const select = (event: MouseEvent): void => {
    event.stopPropagation();
    storeApi.getState().selectNode(block.id);
  };

  const duplicate = (event: MouseEvent): void => {
    event.stopPropagation();
    storeApi.getState().duplicateNode(block.id);
  };

  const remove = (event: MouseEvent): void => {
    event.stopPropagation();
    removeNodeWithConfirm(storeApi, block.id);
  };

  return (
    <div
      ref={ref}
      data-canvas-field
      css={[wrapperCss, isSelected && selectedCss]}
      data-selected={isSelected ? "true" : undefined}
      onClick={select}
    >
      <div css={actionsCss} onClick={stop} onMouseDown={stop}>
        <div css={actionsPillCss}>
          <span ref={handleRef} aria-label="拖动排序" css={gripCss} title="拖动排序">
            <EditorIcon name="grip-vertical" />
          </span>

          <span aria-hidden="true" css={actionDividerCss} />

          <Button
            aria-label="复制"
            css={actionButtonCss}
            icon={<EditorIcon name="copy" />}
            title="复制 (Cmd/Ctrl+D)"
            type="text"
            onClick={duplicate}
          />

          <Button
            aria-label="删除"
            css={deleteButtonCss}
            icon={<EditorIcon name="trash-2" />}
            title="删除 (Delete)"
            type="text"
            onClick={remove}
          />
        </div>
      </div>

      <SubtreeDraggingContext value={subtreeDragging}>
        {isLeafField(block)
          ? <div css={previewShieldCss} data-canvas-shield="">{children}</div>
          : children}
      </SubtreeDraggingContext>
    </div>
  );
}
