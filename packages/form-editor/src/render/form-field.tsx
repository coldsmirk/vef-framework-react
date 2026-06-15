import type { ReactElement } from "react";

import type { FormField, LabelPosition } from "../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { isKeyedField } from "../engine/keys";
import { useFieldRegistry } from "../store/engine-provider";

// A field whose `type` has no registered renderer: render a quiet dashed
// placeholder built from theme tokens rather than unstyled default-weight black
// text, so a stale / consumer-removed type reads as a known empty slot.
const unknownFieldCss = css({
  padding: "8px 12px",
  border: `1px dashed ${globalCssVars.colorBorder}`,
  borderRadius: globalCssVars.borderRadius,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

export interface FormFieldRendererProps {
  field: FormField;
  value?: unknown;
  disabled?: boolean;
  errors?: string[];
  /**
   * Whether the field is currently required (static + runtime linkage). Drives
   * the label asterisk so it tracks the live required state.
   */
  required?: boolean;
  /**
   * Resolved label placement (field override falling back to the form default).
   */
  labelPosition?: LabelPosition;
  /**
   * DOM id for the control and its label. Defaults to `field-${field.id}`, but
   * subform rows pass a per-row id so repeated template instances never collide.
   */
  domId?: string;
  onChange?: (value: unknown) => void;
}

/**
 * Look up the field definition in the registry and delegate rendering to it.
 *
 * Value/onChange wiring only applies to keyed fields; non-keyed fields
 * (e.g. Button) receive `undefined` value and a no-op change handler. The owner
 * already knows which field changed (it wires one handler per field), so the
 * callback carries only the new value.
 */
export function FormFieldRenderer({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}: FormFieldRendererProps): ReactElement {
  const registry = useFieldRegistry();
  const definition = registry.get(field.type);

  if (!definition?.Component) {
    return (
      <div css={unknownFieldCss} data-unknown-type={field.type}>
        未知字段类型：
        {field.type}
      </div>
    );
  }

  const { Component } = definition;
  const resolvedDomId = domId ?? `field-${field.id}`;
  // Only keyed fields (non-empty data-binding key) carry a value; a non-keyed
  // field (e.g. Button) shows no value and its changes go nowhere.
  const keyed = isKeyedField(field);
  const fieldValue = keyed ? value : undefined;

  const handleChange = (next: unknown): void => {
    if (keyed) {
      onChange?.(next);
    }
  };

  return (
    <Component
      disabled={disabled}
      domId={resolvedDomId}
      errors={errors}
      field={field}
      labelPosition={labelPosition}
      required={required}
      value={fieldValue}
      onChange={handleChange}
    />
  );
}
