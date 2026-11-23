import type { FieldDefinition } from "../../types";

import { createId } from "../../engine/ids";
import { DEFAULT_DYNAMIC_ADD_LABEL, DEFAULT_FIXED_HEADER_LABEL, DEFAULT_FIXED_ITEM_KEY } from "../../engine/schema/subform";
import { defineContainerDefinition } from "../../types";

/**
 * Container field definitions. Containers carry no render `Component` — they
 * render structurally through the canvas (design time) and `FormRenderer`
 * (runtime). Their factories return an empty body; child blocks are dropped in
 * afterwards through the container's nested drop zones.
 */

export const sectionDefinition: FieldDefinition = defineContainerDefinition({
  config: {
    type: "section",
    name: "卡片",
    group: "container",
    keyed: false,
    icon: "square",
    create: () => {
      return {
        type: "section",
        variant: "card",
        title: "卡片标题",
        children: []
      };
    }
  }
});

export const tabsDefinition: FieldDefinition = defineContainerDefinition({
  config: {
    type: "tabs",
    name: "标签页",
    group: "container",
    keyed: false,
    icon: "layout-panel-top",
    create: () => {
      return {
        type: "tabs",
        tabs: [
          {
            id: createId("Tab"),
            label: "标签 1",
            children: []
          },
          {
            id: createId("Tab"),
            label: "标签 2",
            children: []
          }
        ]
      };
    }
  }
});

export const subformDefinition: FieldDefinition = defineContainerDefinition({
  config: {
    type: "subform",
    name: "子表单",
    group: "container",
    keyed: true,
    icon: "table",
    create: () => {
      return {
        type: "subform",
        variant: "stack",
        label: "子表单",
        rows: {
          mode: "dynamic",
          addLabel: DEFAULT_DYNAMIC_ADD_LABEL
        },
        template: []
      };
    }
  }
});

/**
 * Palette preset that inserts a `table`-variant subform already configured in
 * `fixed` row mode (checklist / matrix table), so designers can discover it
 * directly in the container palette without knowing it is a subform row mode.
 */
export const matrixTableDefinition: FieldDefinition = defineContainerDefinition({
  config: {
    type: "subform",
    paletteId: "matrix-table",
    name: "矩阵表格",
    group: "container",
    keyed: true,
    icon: "clipboard-list",
    create: () => {
      return {
        type: "subform",
        variant: "table",
        label: "矩阵表格",
        rows: {
          mode: "fixed",
          itemKey: DEFAULT_FIXED_ITEM_KEY,
          headerLabel: DEFAULT_FIXED_HEADER_LABEL,
          required: true,
          source: {
            kind: "static",
            options: [
              { label: "检查项 1", value: "item_1" },
              { label: "检查项 2", value: "item_2" }
            ]
          }
        },
        template: []
      };
    }
  }
});

export const flexDefinition: FieldDefinition = defineContainerDefinition({
  config: {
    type: "flex",
    name: "弹性布局",
    group: "container",
    keyed: false,
    icon: "stretch-horizontal",
    create: () => {
      return {
        type: "flex",
        direction: "row",
        children: []
      };
    }
  }
});

export const gridDefinition: FieldDefinition = defineContainerDefinition({
  config: {
    type: "grid",
    name: "栅格布局",
    group: "container",
    keyed: false,
    icon: "layout-grid",
    create: () => {
      return {
        type: "grid",
        columns: 2,
        children: []
      };
    }
  }
});
