import type { KeyboardEvent, ReactElement } from "react";

import type { FieldDefinition } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { Feedback, useDraggable } from "@vef-framework-react/core";

import { currentLayer } from "../../engine/schema/presentation";
import { findNode, isContainerNode } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { useFormEditorStoreApi } from "../../store/form-store";
import { FIELD_DRAG_TYPE, palettePointerSensors } from "../dnd";

const itemCss = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: "100%",
  minHeight: 44,
  gap: 10,
  padding: "6px 10px",
  border: "1px solid transparent",
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgContainer,
  fontSize: globalCssVars.fontSize,
  fontFamily: "inherit",
  color: globalCssVars.colorText,
  cursor: "grab",
  userSelect: "none",
  textAlign: "left",
  transition: [
    `background-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `border-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `box-shadow ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),

  "&:hover": {
    background: globalCssVars.colorFillTertiary,
    borderColor: globalCssVars.colorBorderSecondary,
    boxShadow: globalCssVars.shadowXxs,
    color: globalCssVars.colorText
  },

  "&:hover [data-icon-slot]": {
    background: globalCssVars.colorBgContainer,
    color: globalCssVars.colorText
  },

  "&:active": {
    cursor: "grabbing",
    background: globalCssVars.colorFillSecondary
  },

  "&:focus-visible": {
    outline: "none",
    background: globalCssVars.colorFillTertiary,
    borderColor: globalCssVars.colorBorderSecondary,
    boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBorder}`
  },

  // While dragging, this card IS dnd-kit's feedback ghost: dnd-kit marks it
  // `data-dnd-dragging` and lifts it to a fixed overlay that follows the
  // pointer, while a cloned placeholder holds its palette slot. Keep the ghost
  // fully opaque (a faded ghost reads as "disabled") and give it an elevated,
  // emphasized look so it clearly reads as picked-up. dnd-kit owns this
  // element's position/transform via `!important`, so only paint properties
  // are set here.
  "&[data-dnd-dragging]": {
    borderColor: globalCssVars.colorPrimaryBorder,
    boxShadow: globalCssVars.shadowLg
  }
});

const iconSlotCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 6,
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextSecondary,
  flexShrink: 0,
  transition: [
    `background-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),

  "& > svg": {
    width: 18,
    height: 18
  }
});

const iconImgCss = css({
  width: 18,
  height: 18,
  objectFit: "contain"
});

const labelCss = css({
  flex: 1,
  minWidth: 0,
  fontWeight: 500,
  letterSpacing: 0,
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

// A square card that fills the drawer rail's content width (the 64px dock minus
// the rail group's 8px side padding), keeping the icon centered as the rail
// widens. Tracks PALETTE_DOCK_WIDTH_DRAWER in styles.ts.
const itemIconOnlyCss = css({
  boxSizing: "border-box",
  width: 48,
  minHeight: 48,
  justifyContent: "center",
  padding: 8
});

export interface PaletteItemProps {
  definition: FieldDefinition;
  /**
   * Icon-rail rendering for the narrow (drawer) layout: the label collapses
   * into the `title` tooltip and the card squares up around the icon. Drag
   * and double-click both keep working.
   */
  iconOnly?: boolean;
}

/**
 * A single palette card. Drag it onto the canvas to drop at a position, or
 * double-click (or press Enter) to append it — into the selected container, or
 * at the bottom of the form when nothing (or a tab container) is selected.
 *
 * The drag uses dnd-kit's Feedback plugin in `clone` mode: the palette card
 * stays in place while a clone follows the pointer, and the field is created
 * only on drop — copy semantics, no DOM removal/re-insert.
 *
 * The card is a `<div role="button">`, NOT a native `<button>`. dnd-kit's
 * pointer sensor runs `target.closest("button")` and suppresses drag
 * activation on interactive elements, so a native-button root lets a drag
 * start only on its bare padding — every child swallows the pointerdown and
 * resolves `closest("button")` back to the card itself. A non-interactive
 * root keeps the whole card draggable; `role` / `tabIndex` and the keydown
 * handler preserve the keyboard-append affordance a real button would give.
 *
 * The per-source `sensors` list is pointer-only: dnd-kit's KeyboardSensor
 * would otherwise claim Enter/Space to start a keyboard drag (swallowing the
 * event before the keydown handler runs), making the documented
 * keyboard-append affordance unreachable.
 */
export function PaletteItem({ definition, iconOnly = false }: PaletteItemProps): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const { ref } = useDraggable({
    id: `palette-${definition.config.type}`,
    type: FIELD_DRAG_TYPE,
    data: { kind: "palette", type: definition.config.type },
    plugins: [Feedback.configure({ feedback: "clone", dropAnimation: null })],
    sensors: palettePointerSensors
  });

  const appendField = (): void => {
    const {
      device,
      schema,
      selectedId
    } = storeApi.getState();
    const layer = currentLayer(schema, device);
    const selected = selectedId === null ? undefined : findNode(layer, selectedId);
    // Double-click drops into the selected container — the empty container's
    // hint promises "双击组件追加到此处", so honour it. Tabs are excluded
    // (which tab is open is canvas-local state the store cannot see); those
    // and plain selections append to the form tail as before.
    const target = selected !== undefined && isContainerNode(selected) && selected.type !== "tabs"
      ? { kind: "container" as const, containerId: selected.id }
      : undefined;

    storeApi.getState().insertField(target === undefined ? { definition } : { definition, target });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    appendField();
  };

  return (
    <div
      ref={ref}
      aria-label={definition.config.name}
      css={[itemCss, iconOnly && itemIconOnlyCss]}
      role="button"
      tabIndex={0}
      title={definition.config.name}
      onDoubleClick={appendField}
      onKeyDown={handleKeyDown}
    >
      <span data-icon-slot aria-hidden="true" css={iconSlotCss}>
        {definition.config.iconUrl
          ? <img alt="" css={iconImgCss} src={definition.config.iconUrl} />
          : <EditorIcon name={definition.config.icon ?? "square"} />}
      </span>

      {iconOnly ? null : <span css={labelCss}>{definition.config.name}</span>}
    </div>
  );
}
