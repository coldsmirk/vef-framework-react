import type { FC, FocusEvent, KeyboardEvent } from "react";

import type { FieldComponentProps, FieldDefinition, NumberField, PropertiesDescriptor } from "../../types";

import { InputNumber } from "@vef-framework-react/components";

import { FieldShell, useFieldCell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { columnTypeEntry, maxValueEntry, messageEntry, minValueEntry, requiredEntry, sizeEntry } from "../field-entries";
import { parseNumberDraft, useEntryCommit } from "../use-entry-commit";

const inputStyle = { width: "100%" } as const;

const NumberInput: FC<FieldComponentProps<NumberField, number | undefined>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange,
  onCommit
}) => {
  const cell = useFieldCell();
  const entryCommit = useEntryCommit({
    value,
    onCommit,
    commitOnEnter: true
  });

  const handleChange = (raw: string | number | null): void => {
    const next = typeof raw === "number" ? raw : undefined;

    entryCommit.notifyUserChange(next);
    onChange(next);
  };

  // Flush the input's raw text through `parseNumberDraft` before firing
  // `onCommit` so an out-of-range or unrounded draft that antd InputNumber
  // hasn't flushed yet lands in form state before the commit sequence reads it.
  const flushAndRead = (target: EventTarget): number | undefined => {
    if (!(target instanceof HTMLInputElement)) {
      return value;
    }

    const flushed = parseNumberDraft(target.value, field.min, field.max, field.precision);

    if (!Object.is(flushed, value)) {
      entryCommit.notifyUserChange(flushed);
      onChange(flushed);
    }

    return flushed;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!onCommit || event.key !== "Enter" || entryCommit.isComposing(event)) {
      return;
    }

    event.preventDefault();
    const flushed = flushAndRead(event.target);

    entryCommit.commitNow(flushed);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    if (!onCommit) {
      return;
    }

    const flushed = flushAndRead(event.target);

    entryCommit.handleBlur(flushed);
  };

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "数字"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <InputNumber
        aria-labelledby={cell?.labelId}
        controls={field.controls}
        disabled={disabled}
        id={domId}
        max={field.max}
        min={field.min}
        placeholder={field.placeholder}
        precision={field.precision}
        prefix={field.prefix}
        size={field.size}
        status={errors?.length ? "error" : undefined}
        step={field.step}
        style={inputStyle}
        suffix={field.suffix}
        value={value}
        onBlur={handleBlur}
        onChange={handleChange}
        onCompositionEnd={entryCommit.handleCompositionEnd}
        onCompositionStart={entryCommit.handleCompositionStart}
        onKeyDown={handleKeyDown}
      />
    </FieldShell>
  );
};

const numberProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<NumberField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => {
          return { ...field, label };
        }
      }),
      definePropertyEntry<NumberField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        read: field => field.placeholder,
        write: (field, placeholder) => {
          return { ...field, placeholder };
        }
      }),
      definePropertyEntry<NumberField, string | undefined>({
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
      sizeEntry<NumberField>(),
      definePropertyEntry<NumberField, string | undefined>({
        id: "prefix",
        label: "前缀",
        type: "text",
        placeholder: "如 ¥",
        read: field => field.prefix,
        write: (field, prefix) => {
          return { ...field, prefix };
        }
      }),
      definePropertyEntry<NumberField, string | undefined>({
        id: "suffix",
        label: "后缀",
        type: "text",
        placeholder: "如 元 / %",
        read: field => field.suffix,
        write: (field, suffix) => {
          return { ...field, suffix };
        }
      }),
      definePropertyEntry<NumberField, boolean | undefined>({
        id: "controls",
        label: "显示步进按钮",
        type: "checkbox",
        read: field => field.controls,
        write: (field, controls) => {
          return { ...field, controls: controls === true };
        }
      })
    ]
  },
  {
    id: "range",
    label: "取值",
    tab: "props",
    entries: [
      definePropertyEntry<NumberField, number | undefined>({
        id: "min",
        label: "最小值",
        type: "number",
        read: field => field.min,
        write: (field, min) => {
          return { ...field, min };
        }
      }),
      definePropertyEntry<NumberField, number | undefined>({
        id: "max",
        label: "最大值",
        type: "number",
        read: field => field.max,
        write: (field, max) => {
          return { ...field, max };
        }
      }),
      definePropertyEntry<NumberField, number | undefined>({
        id: "step",
        label: "步长",
        type: "number",
        read: field => field.step,
        write: (field, step) => {
          return { ...field, step };
        }
      }),
      definePropertyEntry<NumberField, number | undefined>({
        id: "precision",
        label: "精度",
        type: "number",
        description: "保留的小数位数",
        read: field => field.precision,
        // Clamped into toFixed's legal 0..100 digit range — an out-of-range
        // precision would make the renderers' rounding throw.
        write: (field, precision) => {
          return {
            ...field,
            precision: precision === undefined ? undefined : Math.min(100, Math.max(0, Math.floor(precision)))
          };
        }
      })
    ]
  },
  {
    id: "storage",
    label: "存储",
    tab: "props",
    entries: [
      columnTypeEntry<NumberField>([
        { value: "integer", label: "整数 (BIGINT)" },
        { value: "decimal", label: "小数 (DECIMAL)" }
      ])
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [
      requiredEntry<NumberField>(),
      minValueEntry<NumberField>(),
      maxValueEntry<NumberField>(),
      messageEntry<NumberField>()
    ]
  }
];

export const numberFieldDefinition: FieldDefinition = defineFieldDefinition<NumberField, number | undefined>({
  config: {
    type: "number",
    name: "数字",
    group: "basic-input",
    keyed: true,
    commit: "entry",
    icon: "hash",
    create: () => {
      return { type: "number", label: "数字" };
    }
  },
  Component: NumberInput,
  properties: numberProperties
});
