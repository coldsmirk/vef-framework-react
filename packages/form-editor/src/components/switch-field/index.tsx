import type { FC } from "react";

import type { FieldComponentProps, FieldDefinition, PropertiesDescriptor, SwitchField } from "../../types";

import { css } from "@emotion/react";
import { Switch } from "@vef-framework-react/components";

import { FieldFooter } from "../../render/parts/field-shell";
import { Label } from "../../render/parts/label";
import { defineFieldDefinition, definePropertyEntry } from "../../types";

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  width: "100%"
});

const rowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 10
});

const SwitchInput: FC<FieldComponentProps<SwitchField, boolean>> = ({
  disabled,
  domId,
  errors,
  field,
  required,
  value,
  onChange
}) => (
  <div css={wrapperCss}>
    <div css={rowCss}>
      <Switch
        checked={value === true}
        checkedChildren={field.onText}
        disabled={disabled}
        id={domId}
        size={field.size}
        unCheckedChildren={field.offText}
        onChange={next => onChange(next)}
      />

      {/* The shared Label part carries the required asterisk. SwitchField has no
          static required toggle, so `required` only arrives from a runtime
          `require` linkage — the marker must track it like every other field. */}
      <Label htmlFor={domId} position="right" required={required}>
        {field.label ?? "开关"}
      </Label>
    </div>

    {/* Helper text and `require`-linkage validation errors render through the
        shared field footer, identical to every FieldShell-based field. */}
    <FieldFooter errors={errors} helperText={field.helperText} />
  </div>
);

const switchProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<SwitchField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => {
          return { ...field, label };
        }
      }),
      definePropertyEntry<SwitchField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => {
          return { ...field, helperText };
        }
      })
    ]
  },
  {
    id: "appearance",
    label: "外观",
    tab: "props",
    entries: [
      definePropertyEntry<SwitchField, string | undefined>({
        id: "onText",
        label: "开启文字",
        type: "text",
        placeholder: "如 开",
        read: field => field.onText,
        write: (field, onText) => {
          return { ...field, onText };
        }
      }),
      definePropertyEntry<SwitchField, string | undefined>({
        id: "offText",
        label: "关闭文字",
        type: "text",
        placeholder: "如 关",
        read: field => field.offText,
        write: (field, offText) => {
          return { ...field, offText };
        }
      }),
      definePropertyEntry<SwitchField, "default" | "small" | undefined>({
        id: "size",
        label: "尺寸",
        type: "select",
        options: [
          { value: "default", label: "默认" },
          { value: "small", label: "小" }
        ],
        read: field => field.size,
        write: (field, size) => {
          return { ...field, size };
        }
      })
    ]
  }
];

export const switchFieldDefinition: FieldDefinition = defineFieldDefinition<SwitchField, boolean>({
  config: {
    type: "switch",
    name: "开关",
    group: "selection",
    keyed: true,
    icon: "toggle-left",
    create: () => {
      return { type: "switch", label: "开关" };
    }
  },
  Component: SwitchInput,
  properties: switchProperties
});
