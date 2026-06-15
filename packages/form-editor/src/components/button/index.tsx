import type { DynamicIconName } from "@vef-framework-react/components";
import type { FC } from "react";

import type { ButtonField, FieldComponentProps, FieldDefinition, PropertiesDescriptor } from "../../types";

import { css } from "@emotion/react";
import { Button as ButtonInternal } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { sizeEntry } from "../field-entries";

const buttonCss = css({
  minWidth: 88,
  fontWeight: 500
});

/**
 * Read-only renderer for buttons. The native `type` attribute is driven by
 * `field.action` (defaults to `"submit"`, matching the field factory).
 */
export const Button: FC<FieldComponentProps<ButtonField, undefined>> = ({
  disabled,
  domId,
  field
}) => (
  <ButtonInternal
    autoInsertSpace={false}
    block={field.block}
    css={buttonCss}
    danger={field.danger}
    disabled={disabled}
    ghost={field.ghost}
    htmlType={field.action ?? "submit"}
    icon={field.icon ? <EditorIcon name={field.icon} /> : undefined}
    id={domId}
    shape={field.shape}
    size={field.size}
    type={field.buttonType ?? "primary"}
  >
    {field.label ?? "按钮"}
  </ButtonInternal>
);

/**
 * Property descriptor for buttons. `general` carries the label only; `action`
 * lives in `appearance` because it changes how the button looks/behaves but
 * does not produce form data.
 */
const buttonProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    entries: [
      definePropertyEntry<ButtonField, string | undefined>({
        id: "label",
        label: "文案",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      })
    ]
  },
  {
    id: "appearance",
    label: "外观",
    entries: [
      definePropertyEntry<ButtonField, ButtonField["buttonType"]>({
        id: "buttonType",
        label: "按钮样式",
        type: "select",
        options: [
          { value: "primary", label: "主要" },
          { value: "default", label: "默认" },
          { value: "dashed", label: "虚线" },
          { value: "text", label: "文字" },
          { value: "link", label: "链接" }
        ],
        read: field => field.buttonType,
        write: (field, buttonType) => { return { ...field, buttonType }; }
      }),
      sizeEntry<ButtonField>(),
      definePropertyEntry<ButtonField, ButtonField["shape"]>({
        id: "shape",
        label: "形状",
        type: "select",
        options: [
          { value: "default", label: "默认" },
          { value: "round", label: "圆角" }
        ],
        read: field => field.shape,
        write: (field, shape) => { return { ...field, shape }; }
      }),
      definePropertyEntry<ButtonField, boolean | undefined>({
        id: "danger",
        label: "危险按钮",
        type: "checkbox",
        read: field => field.danger,
        write: (field, danger) => { return { ...field, danger: danger === true }; }
      }),
      definePropertyEntry<ButtonField, boolean | undefined>({
        id: "block",
        label: "块级(撑满宽度)",
        type: "checkbox",
        read: field => field.block,
        write: (field, block) => { return { ...field, block: block === true }; }
      }),
      definePropertyEntry<ButtonField, boolean | undefined>({
        id: "ghost",
        label: "幽灵按钮",
        type: "checkbox",
        read: field => field.ghost,
        write: (field, ghost) => { return { ...field, ghost: ghost === true }; }
      }),
      definePropertyEntry<ButtonField, ButtonField["action"]>({
        id: "action",
        label: "类型",
        type: "select",
        options: [
          { value: "submit", label: "提交" },
          { value: "reset", label: "重置" },
          { value: "button", label: "普通" }
        ],
        read: field => field.action,
        write: (field, action) => { return { ...field, action }; }
      }),
      definePropertyEntry<ButtonField, DynamicIconName | undefined>({
        id: "icon",
        label: "图标",
        type: "icon",
        read: field => field.icon,
        write: (field, icon) => { return { ...field, icon }; }
      })
    ]
  }
];

export const buttonDefinition: FieldDefinition = defineFieldDefinition<ButtonField, undefined>({
  config: {
    type: "button",
    name: "按钮",
    group: "action",
    keyed: false,
    icon: "mouse-pointer-click",
    // `action: "submit"` matches form-js' default so a button dropped into the
    // canvas submits the form unless the user changes it.
    create: () => {
      return {
        type: "button",
        label: "提交",
        action: "submit"
      };
    }
  },
  Component: Button,
  properties: buttonProperties
});
