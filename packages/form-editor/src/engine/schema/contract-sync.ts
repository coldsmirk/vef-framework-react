import type {
  Block,
  ColumnDataType,
  DynamicSubformRows,
  FieldOptionSource,
  FixedSubformRows,
  FormField,
  SubformNode,
  Validatable
} from "../../types";

import { isDeepEqual } from "@vef-framework-react/shared";

import { isKeyedNode } from "../keys";
import { getDynamicSubformRows, isFixedSubform } from "./subform";
import { isLeafField } from "./walk";

/**
 * Cross-device data-contract synchronization for twin nodes (same value scope,
 * same data-binding key on PC and mobile).
 *
 * The two device presentations may lay out their trees independently, but the
 * DATA layer is shared: a keyed node binds one value on both devices, so
 * editing a data-contract property on one device propagates to its twin on the
 * other device within the same undo step. Purely presentational properties
 * (`label`, `placeholder`, `helperText`, `size`, `headerLabel`, `headerWidth`,
 * `addLabel`, `variant`, layout sizing, `template` columns, etc.) stay
 * device-local.
 *
 * Date granularity is a data-contract property too, but it is deliberately not
 * handled here: switching it also invalidates date literals in linkage, so the
 * store's `setDateGranularity` action owns it end to end — field, twin and
 * linkage scrub in one step.
 *
 * Identity contract: when no data-contract property changed or the twin is
 * already aligned (or incompatible), the input twin reference is returned
 * unchanged so untouched branches keep structural sharing.
 */

type ValidationRules = NonNullable<Validatable["validate"]>;

/**
 * Distinct widget types that bind the same runtime value shape and share
 * data-contract properties (e.g. `code-editor` degrades to `textarea` during
 * PC → mobile conversion, and `select`/`radio` or `multi-select`/`checkbox-group`
 * are alternate controls over the same option source).
 */
const CONTRACT_EQUIVALENT_FAMILIES: Readonly<Record<string, string>> = {
  "code-editor": "multiline-text",
  textarea: "multiline-text",
  select: "single-choice",
  radio: "single-choice",
  "multi-select": "multi-choice",
  "checkbox-group": "multi-choice"
};

/**
 * Leaf field types that own an option source (`dataSource`).
 */
const OPTION_SOURCE_FIELD_TYPES: ReadonlySet<string> = new Set([
  "select",
  "multi-select",
  "radio",
  "checkbox-group"
]);

/**
 * Leaf field types that do not support static `validate` rules.
 */
const NON_VALIDATABLE_LEAF_TYPES: ReadonlySet<string> = new Set(["switch"]);

function areContractCompatibleLeafTypes(aType: string, bType: string): boolean {
  if (aType === bType) {
    return true;
  }

  const familyA = CONTRACT_EQUIVALENT_FAMILIES[aType];

  return familyA !== undefined && familyA === CONTRACT_EQUIVALENT_FAMILIES[bType];
}

/**
 * Strip `undefined`-valued entries from a `validate` object so cleared rules
 * compare equal to omitted keys and never leave dangling `undefined` slots on
 * the synced twin.
 */
function normalizeValidate(validate: ValidationRules | undefined): ValidationRules | undefined {
  if (validate === undefined) {
    return undefined;
  }

  const entries = Object.entries(validate).filter(([, value]) => value !== undefined);

  return entries.length === 0 ? undefined : (Object.fromEntries(entries) as ValidationRules);
}

function readValidate(field: FormField): ValidationRules | undefined {
  return normalizeValidate((field as Validatable).validate);
}

function readDataSource(field: FormField): FieldOptionSource | undefined {
  return (field as { dataSource?: FieldOptionSource }).dataSource;
}

function readColumnType(field: FormField): ColumnDataType | undefined {
  return (field as { columnType?: ColumnDataType }).columnType;
}

function readPrecision(field: FormField): number | undefined {
  return field.type === "number" ? field.precision : undefined;
}

function readUploadMaxCount(field: FormField): number | undefined {
  return field.type === "upload" ? field.maxCount : undefined;
}

function subformRowsContractChanged(before: SubformNode, after: SubformNode): boolean {
  if (before.rows === after.rows) {
    return false;
  }

  const beforeFixed = isFixedSubform(before);
  const afterFixed = isFixedSubform(after);

  if (beforeFixed !== afterFixed) {
    return true;
  }

  if (beforeFixed && afterFixed) {
    return before.rows.itemKey !== after.rows.itemKey
      || (before.rows.required === true) !== (after.rows.required === true)
      || !isDeepEqual(before.rows.source, after.rows.source);
  }

  const beforeDynamic = getDynamicSubformRows(before);
  const afterDynamic = getDynamicSubformRows(after);

  return beforeDynamic.min !== afterDynamic.min || beforeDynamic.max !== afterDynamic.max;
}

function leafContractChanged(before: FormField, after: FormField): boolean {
  if (before.type !== after.type) {
    return false;
  }

  if (
    !NON_VALIDATABLE_LEAF_TYPES.has(before.type)
    && !isDeepEqual(readValidate(before), readValidate(after))
  ) {
    return true;
  }

  if (
    OPTION_SOURCE_FIELD_TYPES.has(before.type)
    && !isDeepEqual(readDataSource(before), readDataSource(after))
  ) {
    return true;
  }

  if (readColumnType(before) !== readColumnType(after)) {
    return true;
  }

  if (before.type === "number" && readPrecision(before) !== readPrecision(after)) {
    return true;
  }

  return before.type === "upload" && readUploadMaxCount(before) !== readUploadMaxCount(after);
}

/**
 * Fast-path check reporting whether an edit from `before` to `after` changed
 * any data-contract property that must propagate to a cross-device twin.
 * Lets the store skip scope/twin lookups on purely presentational edits
 * (e.g. keystrokes in `label`, `placeholder`, `headerLabel`, `addLabel`).
 */
export function hasNodeContractChange(before: Block, after: Block): boolean {
  if (!isKeyedNode(before) || !isKeyedNode(after) || before.key !== after.key) {
    return false;
  }

  if (before.type === "subform" && after.type === "subform") {
    return subformRowsContractChanged(before, after);
  }

  if (isLeafField(before) && isLeafField(after)) {
    return leafContractChanged(before, after);
  }

  return false;
}

function syncSubformRowsToTwin(after: SubformNode, twin: SubformNode): SubformNode {
  if (isFixedSubform(after)) {
    const nextRows: FixedSubformRows = {
      mode: "fixed",
      itemKey: after.rows.itemKey,
      source: after.rows.source
    };

    if (after.rows.required !== undefined) {
      nextRows.required = after.rows.required;
    }

    // Preserve the twin's own presentation settings (headerLabel / headerWidth)
    // when it is already fixed; omit them on a dynamic → fixed switch so the
    // twin keeps device defaults instead of inheriting the other device's copy.
    if (isFixedSubform(twin)) {
      if (twin.rows.headerLabel !== undefined) {
        nextRows.headerLabel = twin.rows.headerLabel;
      }

      if (twin.rows.headerWidth !== undefined) {
        nextRows.headerWidth = twin.rows.headerWidth;
      }
    }

    if (isFixedSubform(twin) && isDeepEqual(twin.rows, nextRows)) {
      return twin;
    }

    return { ...twin, rows: nextRows };
  }

  const afterDynamic = getDynamicSubformRows(after);
  const nextRows: DynamicSubformRows = { mode: "dynamic" };

  if (afterDynamic.min !== undefined) {
    nextRows.min = afterDynamic.min;
  }

  if (afterDynamic.max !== undefined) {
    nextRows.max = afterDynamic.max;
  }

  // Preserve the twin's own dynamic add-button copy when it is already dynamic.
  if (twin.rows?.mode === "dynamic" && twin.rows.addLabel !== undefined) {
    nextRows.addLabel = twin.rows.addLabel;
  }

  if (
    !isFixedSubform(twin)
    && (
      (twin.rows === undefined && nextRows.min === undefined && nextRows.max === undefined)
      || (twin.rows !== undefined && isDeepEqual(twin.rows, nextRows))
    )
  ) {
    return twin;
  }

  return { ...twin, rows: nextRows };
}

function setOrDeleteProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined
): void {
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

function syncLeafContractToTwin(before: FormField, after: FormField, twin: FormField): FormField {
  if (before.type !== after.type || !areContractCompatibleLeafTypes(after.type, twin.type)) {
    return twin;
  }

  let next: FormField = twin;
  let cloned = false;

  const mutable = (): Record<string, unknown> => {
    if (!cloned) {
      next = { ...next };
      cloned = true;
    }

    return next as unknown as Record<string, unknown>;
  };

  if (
    !NON_VALIDATABLE_LEAF_TYPES.has(after.type)
    && !NON_VALIDATABLE_LEAF_TYPES.has(twin.type)
  ) {
    const beforeValidate = readValidate(before);
    const afterValidate = readValidate(after);

    if (!isDeepEqual(beforeValidate, afterValidate) && !isDeepEqual(readValidate(next), afterValidate)) {
      setOrDeleteProperty(mutable(), "validate", afterValidate);
    }
  }

  if (
    OPTION_SOURCE_FIELD_TYPES.has(after.type)
    && OPTION_SOURCE_FIELD_TYPES.has(twin.type)
  ) {
    const beforeSource = readDataSource(before);
    const afterSource = readDataSource(after);

    if (!isDeepEqual(beforeSource, afterSource) && !isDeepEqual(readDataSource(next), afterSource)) {
      setOrDeleteProperty(mutable(), "dataSource", afterSource);
    }
  }

  const beforeColumnType = readColumnType(before);
  const afterColumnType = readColumnType(after);

  if (beforeColumnType !== afterColumnType && readColumnType(next) !== afterColumnType) {
    setOrDeleteProperty(mutable(), "columnType", afterColumnType);
  }

  if (before.type === "number" && after.type === "number" && next.type === "number") {
    const beforePrecision = before.precision;
    const afterPrecision = after.precision;

    if (beforePrecision !== afterPrecision && next.precision !== afterPrecision) {
      setOrDeleteProperty(mutable(), "precision", afterPrecision);
    }
  }

  if (before.type === "upload" && after.type === "upload" && next.type === "upload") {
    const beforeMaxCount = before.maxCount;
    const afterMaxCount = after.maxCount;

    if (beforeMaxCount !== afterMaxCount && next.maxCount !== afterMaxCount) {
      setOrDeleteProperty(mutable(), "maxCount", afterMaxCount);
    }
  }

  return next;
}

/**
 * Propagate any data-contract property that changed between `before` and
 * `after` onto `twin` (the opposite device's same-scope, same-key node).
 *
 * Returns `twin` unchanged when no contract property changed, the two nodes
 * have incompatible types, or `twin` already carries the updated values.
 */
export function syncNodeContractToTwin(before: Block, after: Block, twin: Block): Block {
  if (!hasNodeContractChange(before, after)) {
    return twin;
  }

  if (before.type === "subform" && after.type === "subform" && twin.type === "subform") {
    return syncSubformRowsToTwin(after, twin);
  }

  if (isLeafField(before) && isLeafField(after) && isLeafField(twin)) {
    return syncLeafContractToTwin(before, after, twin);
  }

  return twin;
}
