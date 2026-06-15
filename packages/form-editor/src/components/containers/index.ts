import type { FieldDefinition } from "../../types";

import { createId } from "../../engine/ids";
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
        addLabel: "新增一行",
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
