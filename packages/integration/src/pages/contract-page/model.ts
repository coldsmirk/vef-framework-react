import type { Contract, ContractParams, JsonObject } from "../../types";

/**
 * The contract form's values. The two JSON Schemas are edited as text in a
 * code editor, so they are strings here and converted to/from the model's
 * object form at the edit and submit boundaries.
 */
export interface ContractFormValues {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  inputSchema: string;
  outputSchema: string;
  isEnabled: boolean;
}

function stringifySchema(schema?: JsonObject | null): string {
  return schema ? JSON.stringify(schema, null, 2) : "";
}

function parseSchema(text: string): JsonObject | null {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const parsed: unknown = JSON.parse(trimmed);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("JSON Schema 必须是一个对象");
  }

  return parsed as JsonObject;
}

/**
 * Project a saved contract into the editable form values (schemas as text).
 */
export function contractToFormValues(row: Contract): ContractFormValues {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    inputSchema: stringifySchema(row.inputSchema),
    outputSchema: stringifySchema(row.outputSchema),
    isEnabled: row.isEnabled
  };
}

/**
 * Convert the form values back into the API params (schemas parsed to objects).
 */
export function formValuesToParams(values: ContractFormValues): ContractParams {
  return {
    id: values.id,
    code: values.code,
    name: values.name,
    description: values.description,
    inputSchema: parseSchema(values.inputSchema),
    outputSchema: parseSchema(values.outputSchema),
    isEnabled: values.isEnabled
  };
}

/**
 * Defaults for a newly created contract.
 */
export const CONTRACT_FORM_DEFAULTS: ContractFormValues = {
  code: "",
  name: "",
  description: "",
  inputSchema: "",
  outputSchema: "",
  isEnabled: true
};
