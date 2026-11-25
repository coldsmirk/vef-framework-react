import type { MouseEvent, ReactElement, ReactNode } from "react";

import type { Block } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars } from "@vef-framework-react/components";
import { useDraggable } from "@vef-framework-react/core";
import { createContext, use } from "react";

import { isContainerNode, isLeafField } from "../../engine/schema/walk";
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

/**
 * How far the action bar rises above its block's top edge — enough to centre
 * its 24px on the selection ring. A scroll container that would clip the bar
 * reserves this much headroom.
 */
export const ACTION_BAR_RISE = 16;

/**
 * CSS variable naming the gap between stacked blocks, published by every stack
 * body for its own children. The bar never rises past it, so it cannot reach
 * the block above — covering that block would also catch the clicks aimed at
 * it.
 */
export const STACK_GAP_VAR = "--vef-form-editor-stack-gap";

/**
 * CSS variable naming the width of the canvas's right edge that an overlay
 * covers (the narrow-layout properties panel). Published by the stage; the
 * action bars slide left by it so their buttons stay reachable.
 */
export const CANVAS_OCCLUDED_RIGHT_VAR = "--vef-form-editor-canvas-occluded-right";

// A full-width, pointer-transparent rail along the block's top edge. It only
// positions the bar: absolute, so it adds no layout, and transparent to the
// pointer, so the block's own top strip stays clickable. Its inline padding
// clears the corner radius, where the selection ring turns. A high z-index
// keeps the bar above the neighbouring block.
const actionsRailCss = css({
  position: "absolute",
  top: `calc(-1 * min(${ACTION_BAR_RISE}px, var(${STACK_GAP_VAR}, ${ACTION_BAR_RISE}px)))`,
  left: 0,
  right: 0,
  zIndex: 3,
  display: "flex",
  justifyContent: "flex-end",
  paddingInline: globalCssVars.borderRadius,
  pointerEvents: "none"
});

// The action bar, straddling the selection ring at the block's top-right corner.
// It reaches 8px into its own block — the empty end of a field's label row, and
// clear of a button's text — which also keeps it in the block's hover chain: the
// pointer never crosses empty space on the way to it.
const actionsCss = css({
  // Sticky against the canvas scroller: the bar rests at the block's right end
  // and slides left only as far as an overlay covers that end.
  position: "sticky",
  right: `calc(var(${CANVAS_OCCLUDED_RIGHT_VAR}, 0px) + ${globalCssVars.borderRadius})`,
  display: "flex",
  alignItems: "center",
  height: 24,
  borderRadius: globalCssVars.borderRadiusSm,
  // Clips the buttons' hover wash to the bar's rounded corners.
  overflow: "hidden",
  background: globalCssVars.colorPrimary,
  color: globalCssVars.colorWhite,
  boxShadow: globalCssVars.shadowSm,
  opacity: 0,
  transform: "scale(0.96)",
  transformOrigin: "top right",
  transition: [
    `opacity ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `transform ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),
  pointerEvents: "none",

  // Reveal on the innermost hovered block only (`:hover` matches the whole
  // ancestor chain, which used to pop one bar per nesting level at once), and
  // on the selected block — its bar is the only path to grip-drag / duplicate
  // / delete, independent of where the pointer rests. `> * >` steps through
  // the rail, so a block reveals its own bar and never a nested block's.
  "[data-canvas-field]:hover:not(:has([data-canvas-field]:hover)) > * > &, [data-canvas-field][data-selected='true'] > * > &": {
    opacity: 1,
    transform: "scale(1)",
    pointerEvents: "auto"
  },

  // …except while a descendant block is hovered: a child slot near the
  // container's top-right corner would pop its bar right on top of the
  // selected container's (both anchor that corner), stacking two accent
  // bars. Yield to the hovered child's bar — the selected bar returns the
  // moment the pointer leaves the container's interior.
  "[data-canvas-field][data-selected='true']:has([data-canvas-field]:hover) > * > &": {
    opacity: 0,
    pointerEvents: "none"
  },

  // Placement mode: fold every action bar away — it is unusable mid-drag, and
  // as another accent surface it would clash with the drop indicator. The
  // longer selectors re-assert the reveal rules above so hover / selection
  // cannot bring the bar back while dragging.
  "[data-drag-active] &, [data-drag-active] [data-canvas-field]:hover:not(:has([data-canvas-field]:hover)) > * > &, [data-drag-active] [data-canvas-field][data-selected='true'] > * > &": {
    opacity: 0,
    pointerEvents: "none"
  }
});

// A translucent-white hairline separating the "move" handle from the actions.
const actionDividerCss = css({
  width: 1,
  height: 14,
  flexShrink: 0,
  background: `color-mix(in srgb, ${globalCssVars.colorWhite} 28%, transparent)`
});

// The keyboard focus ring sits inside the control: the bar clips its overflow.
const actionFocusCss = css({
  "&:focus-visible": {
    outline: `2px solid ${globalCssVars.colorWhite}`,
    outlineOffset: -2
  }
});

// Icons are sized through `fontSize`, never by overriding the svg: the shared
// `Icon` derives its size and its vertical alignment from the font size, so a
// hard-coded svg size leaves the glyph off the button's centre.
const ACTION_ICON_FONT_SIZE = 12;

const actionButtonCss = css(actionFocusCss, {
  width: 24,
  height: 24,
  minWidth: 0,
  padding: 0,
  borderRadius: 0,
  fontSize: ACTION_ICON_FONT_SIZE,
  // White glyphs on the accent bar, with a translucent-white press/hover wash.
  // VEF styles outrank the antd layer, so this sets the text-button colours
  // without `!important` / `&&`.
  color: globalCssVars.colorWhite,

  "&:hover": {
    color: globalCssVars.colorWhite,
    background: `color-mix(in srgb, ${globalCssVars.colorWhite} 18%, transparent)`
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

const gripCss = css(actionFocusCss, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  fontSize: ACTION_ICON_FONT_SIZE,
  // The handle is the quietest glyph (dimmed white), brightening on hover.
  color: `color-mix(in srgb, ${globalCssVars.colorWhite} 72%, transparent)`,
  cursor: "grab",
  transition: [
    `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),

  "&:hover": { color: globalCssVars.colorWhite, background: `color-mix(in srgb, ${globalCssVars.colorWhite} 18%, transparent)` },
  "&:active": { cursor: "grabbing" }
});

// The offscreen-skip boundary for big forms, applied to every leaf preview.
// `content-visibility: auto` lets the browser skip layout/paint for off-viewport
// previews (the antd control is the heavy part of a block), and the `auto` in
// `contain-intrinsic-size` remembers each preview's real size once rendered so
// scrollbar geometry stays honest. It must sit HERE and not on the stack slot:
// content-visibility implies paint containment, and on any ancestor of the
// floating action bar it would clip the bar away (the bar rises above the
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
    // `isContainer` lets the drag-overlay swap a container's full-subtree lift
    // for a compact chip without re-deriving the node's kind mid-drag.
    data: {
      kind: "block",
      nodeId: block.id,
      isContainer: isContainerNode(block)
    }
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
      data-node-id={block.id}
      data-selected={isSelected ? "true" : undefined}
      onClick={select}
    >
      <div css={actionsRailCss}>
        <div css={actionsCss} onClick={stop} onMouseDown={stop}>
          {/* Focusable so dnd-kit's KeyboardSensor can work: it binds keydown to
              this handle element, and a keydown only reaches an element that can
              hold focus — without tabIndex the documented Enter-to-pick-up /
              arrow-to-move flow can never start. */}
          <span
            ref={handleRef}
            aria-label="拖动排序"
            css={gripCss}
            role="button"
            tabIndex={0}
            title="拖动排序"
          >
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
