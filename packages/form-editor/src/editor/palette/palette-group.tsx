import type { CollapseItem, CollapseProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { FieldDefinition, FieldGroup } from "../../types";

import { css } from "@emotion/react";
import { Collapse, globalCssVars } from "@vef-framework-react/components";
import { useState } from "react";

import { EditorIcon } from "../../icons";
import { FIELD_GROUP_LABELS } from "./field-groups";
import { PaletteItem } from "./palette-item";

const collapseCss = css({
  background: "transparent",
  border: "none",
  marginBlockEnd: 8,

  "&:last-of-type": {
    marginBlockEnd: 0
  },

  ".vef-collapse-item": {
    border: "none"
  },

  ".vef-collapse-header": {
    alignItems: "center",
    minHeight: 50,
    padding: "0 18px",
    borderRadius: 6,
    color: globalCssVars.colorText,
    fontSize: globalCssVars.fontSize,
    fontWeight: 600,
    transition: `background-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  },

  ".vef-collapse-header:hover": {
    backgroundColor: globalCssVars.colorFillQuaternary
  },

  ".vef-collapse-expand-icon": {
    height: "auto",
    paddingInlineEnd: 10
  },

  ".vef-collapse-panel": {
    background: "transparent",
    border: "none"
  },

  ".vef-collapse-body": {
    padding: "4px 12px 10px 12px"
  }
});

const chevronCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  color: globalCssVars.colorTextSecondary,
  transition: `transform ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,

  "& > svg": {
    width: 18,
    height: 18
  }
});

const chevronOpenCss = css({
  transform: "rotate(90deg)"
});

const headerLabelCss = css({
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  minWidth: 0
});

const labelTextCss = css({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const countCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 24,
  height: 24,
  borderRadius: 999,
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextTertiary,
  fontSize: globalCssVars.fontSize,
  fontWeight: 400,
  fontVariantNumeric: "tabular-nums"
});

const listCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});

const railGroupCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "6px 8px",

  "& + &": {
    borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

export interface PaletteGroupProps {
  group: FieldGroup;
  definitions: FieldDefinition[];
  /**
   * External override. When `true`, the group renders open regardless of
   * the user's local toggle state — used while a search keyword is active
   * so every matching group is visible. The user's local state is
   * preserved underneath, so flipping `forceOpen` back to `false` restores
   * whatever the user had chosen before the search.
   */
  forceOpen?: boolean;
  /**
   * Icon-rail rendering for the narrow (drawer) layout: no collapsible
   * header, just the group's items as icon-only cards separated by a
   * hairline.
   */
  rail?: boolean;
}

/**
 * Collapsible category section in the palette. Header shows the group's
 * localized label and item count; clicking the header expands or collapses
 * the single-column item list.
 *
 * `forceOpen` exists so the panel's search filter can override the user's
 * collapsed/expanded preference for the duration of a search without
 * destroying it — when the search clears, the panel removes `forceOpen`
 * and the local state takes back over.
 */
export function PaletteGroup({
  definitions,
  forceOpen,
  group,
  rail = false
}: PaletteGroupProps): ReactElement {
  const [openKeys, setOpenKeys] = useState<string[]>([group]);

  if (rail) {
    return (
      <div aria-label={FIELD_GROUP_LABELS[group]} css={railGroupCss} role="group">
        {definitions.map(definition => <PaletteItem key={definition.config.type} iconOnly definition={definition} />)}
      </div>
    );
  }

  const activeKey = forceOpen === true ? [group] : openKeys;
  const label = FIELD_GROUP_LABELS[group];

  const handleChange: CollapseProps["onChange"] = key => {
    // When an external override is in effect, antd still emits the user's
    // desired next key set. Store it so clearing the search restores the
    // user's underlying preference.
    const nextKeys = Array.isArray(key)
      ? key.map(String)
      : key
        ? [String(key)]
        : [];

    setOpenKeys(nextKeys);
  };

  const items: CollapseItem[] = [
    {
      key: group,
      label: (
        <span css={headerLabelCss}>
          <span css={labelTextCss}>{label}</span>
          <span css={countCss}>{definitions.length}</span>
        </span>
      ),
      children: (
        <div css={listCss}>
          {definitions.map(def => <PaletteItem key={def.config.type} definition={def} />)}
        </div>
      )
    }
  ];

  return (
    <Collapse
      destroyOnHidden
      activeKey={activeKey}
      css={collapseCss}
      expandIconPlacement="start"
      items={items}
      expandIcon={({ isActive }) => (
        <span aria-hidden="true" css={[chevronCss, isActive && chevronOpenCss]}>
          <EditorIcon name="chevron-right" />
        </span>
      )}
      onChange={handleChange}
    />
  );
}
