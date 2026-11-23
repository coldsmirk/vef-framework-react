import type {
  Block,
  DateField,
  DateGranularity,
  DateRangeField,
  FieldLinkage,
  FieldLinkageAction,
  FieldLinkageRule,
  FormSchema,
  LinkageCondition,
  LinkageOperator,
  PresentationDevice,
  PresentationLayer,
  PropertyEntryOption
} from "../../types";
import type { ScopePath } from "./walk";

import { isValidDateByGranularity, isValidDateRangeByGranularity } from "@vef-framework-react/shared";

import { assertNever } from "../assert-never";
import { leafSourceFormKey } from "../linkage/scope";
import { bodyScopeKey, mapPreservingIdentity } from "./nodes";
import { resolvePresentation, withPresentation } from "./presentation";
import { rewriteContainerBodies } from "./rewrite";
import { findField, findScope, isContainerNode, isLeafField, scopeEquals } from "./walk";

export type DateGranularityField = DateField | DateRangeField;

/**
 * antd `DatePicker` / `RangePicker` `picker` prop corresponding to a
 * {@link DateGranularity}. Omitted granularity defaults to `"date"` (day).
 */
export function antdPickerForGranularity(granularity: DateGranularity | undefined): "year" | "quarter" | "month" | "date" {
  switch (granularity) {
    case "year": {
      return "year";
    }

    case "quarter": {
      return "quarter";
    }

    case "month": {
      return "month";
    }

    default: {
      return "date";
    }
  }
}

/**
 * Options offered by the「精度」select on `date` and `daterange` fields.
 */
export const DATE_GRANULARITY_OPTIONS: PropertyEntryOption[] = [
  { value: "year", label: "年 (YYYY)" },
  { value: "quarter", label: "季度 (YYYY-Qn)" },
  { value: "month", label: "月 (YYYY-MM)" },
  { value: "day", label: "日 (YYYY-MM-DD)" }
];

/**
 * Whether a stored linkage literal carries no value and therefore cannot
 * conflict with a granularity change.
 */
function isEmptyLiteralValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  return Array.isArray(value) && value.length === 0;
}

/**
 * Whether a linkage literal value is valid under `nextGranularity` for a
 * `date` or `daterange` field. Empty values are always compatible.
 */
export function isDateLiteralCompatible(
  fieldType: "date" | "daterange",
  value: unknown,
  nextGranularity: DateGranularity,
  operator?: LinkageOperator
): boolean {
  if (isEmptyLiteralValue(value)) {
    return true;
  }

  if (fieldType === "date") {
    return isValidDateByGranularity(value, nextGranularity);
  }

  if (operator === "contains" && typeof value === "string") {
    return isValidDateByGranularity(value, nextGranularity);
  }

  return isValidDateRangeByGranularity(value, nextGranularity);
}

function isValueBearingOperator(operator: LinkageOperator): boolean {
  return operator !== "empty" && operator !== "notEmpty";
}

function withFieldGranularity<F extends DateGranularityField>(field: F, nextGranularity: DateGranularity): F {
  const normalized = nextGranularity === "day" ? undefined : nextGranularity;

  if (field.granularity === normalized) {
    return field;
  }

  const next = { ...field };

  if (normalized === undefined) {
    delete next.granularity;
  } else {
    next.granularity = normalized;
  }

  return next;
}

function conditionHasAuthoredDateLiteral(condition: LinkageCondition, targetKey: string): boolean {
  switch (condition.kind) {
    case "leaf": {
      return leafSourceFormKey(condition.sourceKey) === targetKey
        && isValueBearingOperator(condition.operator)
        && !isEmptyLiteralValue(condition.value);
    }

    case "group": {
      return condition.children.some(child => conditionHasAuthoredDateLiteral(child, targetKey));
    }

    case "expression": {
      return false;
    }

    default: {
      return assertNever(condition);
    }
  }
}

function linkageHasAuthoredDateLiteral(
  linkage: FieldLinkage | undefined,
  targetKey: string,
  includeOwnAssign: boolean
): boolean {
  if (!linkage?.rules) {
    return false;
  }

  return linkage.rules.some(rule => {
    if (rule.trigger.kind === "condition" && conditionHasAuthoredDateLiteral(rule.trigger.condition, targetKey)) {
      return true;
    }

    return rule.actions.some(action => {
      if (includeOwnAssign && action.type === "assign" && action.value.kind === "literal") {
        return !isEmptyLiteralValue(action.value.value);
      }

      if (action.type === "set_field" && action.targetKey === targetKey && action.value.kind === "literal") {
        return !isEmptyLiteralValue(action.value.value);
      }

      return false;
    });
  });
}

function scrubConditionDateLiterals(
  condition: LinkageCondition,
  targetKey: string,
  fieldType: "date" | "daterange",
  nextGranularity: DateGranularity
): LinkageCondition {
  switch (condition.kind) {
    case "leaf": {
      if (
        leafSourceFormKey(condition.sourceKey) !== targetKey
        || !isValueBearingOperator(condition.operator)
        || isDateLiteralCompatible(fieldType, condition.value, nextGranularity, condition.operator)
      ) {
        return condition;
      }

      return { ...condition, value: "" };
    }

    case "group": {
      const children = mapPreservingIdentity(
        condition.children,
        child => scrubConditionDateLiterals(child, targetKey, fieldType, nextGranularity)
      );

      return children === condition.children ? condition : { ...condition, children };
    }

    case "expression": {
      return condition;
    }

    default: {
      return assertNever(condition);
    }
  }
}

function scrubActionDateLiterals(
  action: FieldLinkageAction,
  targetKey: string,
  fieldType: "date" | "daterange",
  nextGranularity: DateGranularity,
  includeOwnAssign: boolean
): FieldLinkageAction {
  if (
    includeOwnAssign
    && action.type === "assign"
    && action.value.kind === "literal"
    && !isDateLiteralCompatible(fieldType, action.value.value, nextGranularity)
  ) {
    return { ...action, value: { kind: "literal", value: "" } };
  }

  if (
    action.type === "set_field"
    && action.targetKey === targetKey
    && action.value.kind === "literal"
    && !isDateLiteralCompatible(fieldType, action.value.value, nextGranularity)
  ) {
    return { ...action, value: { kind: "literal", value: "" } };
  }

  return action;
}

function scrubRuleDateLiterals(
  rule: FieldLinkageRule,
  targetKey: string,
  fieldType: "date" | "daterange",
  nextGranularity: DateGranularity,
  includeOwnAssign: boolean
): FieldLinkageRule {
  let { trigger } = rule;

  if (trigger.kind === "condition") {
    const condition = scrubConditionDateLiterals(trigger.condition, targetKey, fieldType, nextGranularity);

    if (condition !== trigger.condition) {
      trigger = { ...trigger, condition };
    }
  }

  const actions = mapPreservingIdentity(
    rule.actions,
    action => scrubActionDateLiterals(action, targetKey, fieldType, nextGranularity, includeOwnAssign)
  );

  return trigger === rule.trigger && actions === rule.actions
    ? rule
    : {
        ...rule,
        trigger,
        actions
      };
}

function scrubLinkageDateLiterals(
  linkage: FieldLinkage | undefined,
  targetKey: string,
  fieldType: "date" | "daterange",
  nextGranularity: DateGranularity,
  includeOwnAssign: boolean
): FieldLinkage | undefined {
  if (!linkage?.rules) {
    return linkage;
  }

  const rules = mapPreservingIdentity(
    linkage.rules,
    rule => scrubRuleDateLiterals(rule, targetKey, fieldType, nextGranularity, includeOwnAssign)
  );

  return rules === linkage.rules ? linkage : { ...linkage, rules };
}

/**
 * Update a single date / daterange field's granularity and scrub any
 * incompatible literals in its own `linkage` (own `assign` actions, self
 * `set_field` actions, and leaf conditions referencing its key). Used directly
 * by the property entry's `write` lens so field-level writes never leave
 * incompatible literals behind.
 */
export function applyDateGranularityToField<F extends DateGranularityField>(
  field: F,
  nextGranularity: DateGranularity
): F {
  let next = withFieldGranularity(field, nextGranularity);
  const linkage = scrubLinkageDateLiterals(next.linkage, next.key, next.type, nextGranularity, true);

  if (linkage !== next.linkage) {
    next = { ...next, linkage };
  }

  return next;
}

function findFieldLocation(schema: FormSchema, fieldId: string): {
  device: PresentationDevice;
  scope: ScopePath;
  field: DateGranularityField;
} | undefined {
  for (const device of ["pc", "mobile"] as const) {
    const layer = resolvePresentation(schema, device);

    if (layer === undefined) {
      continue;
    }

    const found = findField(layer, fieldId);

    if (found && (found.type === "date" || found.type === "daterange")) {
      return {
        device,
        scope: findScope(layer, fieldId) ?? [],
        field: found
      };
    }
  }

  return undefined;
}

function findMatchingTwin(
  layer: PresentationLayer,
  targetScope: ScopePath,
  key: string,
  fieldType: "date" | "daterange"
): DateGranularityField | undefined {
  function walk(blocks: Block[], scope: ScopePath): DateGranularityField | undefined {
    for (const block of blocks) {
      if (
        isLeafField(block)
        && scopeEquals(scope, targetScope)
        && block.type === fieldType
        && block.key === key
      ) {
        return block;
      }

      if (isContainerNode(block)) {
        const bodyKey = bodyScopeKey(block);
        const inner = bodyKey === undefined ? scope : [...scope, bodyKey];

        if (block.type === "tabs") {
          for (const tab of block.tabs) {
            const hit = walk(tab.children, inner);

            if (hit !== undefined) {
              return hit;
            }
          }
        } else if (block.type === "subform") {
          const hit = walk(block.template, inner);

          if (hit !== undefined) {
            return hit;
          }
        } else {
          const hit = walk(block.children, inner);

          if (hit !== undefined) {
            return hit;
          }
        }
      }
    }

    return undefined;
  }

  return walk(layer.children, []);
}

function layerHasAuthoredDateLiterals(
  layer: PresentationLayer,
  targetScope: ScopePath,
  targetKey: string,
  targetFieldId: string
): boolean {
  function walk(blocks: Block[], scope: ScopePath): boolean {
    for (const block of blocks) {
      if (scopeEquals(scope, targetScope)) {
        const isTarget = block.id === targetFieldId;

        if (linkageHasAuthoredDateLiteral(block.linkage, targetKey, isTarget)) {
          return true;
        }
      }

      if (isContainerNode(block)) {
        const bodyKey = bodyScopeKey(block);
        const inner = bodyKey === undefined ? scope : [...scope, bodyKey];

        if (block.type === "tabs") {
          if (block.tabs.some(tab => walk(tab.children, inner))) {
            return true;
          }
        } else if (block.type === "subform") {
          if (walk(block.template, inner)) {
            return true;
          }
        } else if (walk(block.children, inner)) {
          return true;
        }
      }
    }

    return false;
  }

  return walk(layer.children, []);
}

/**
 * Report whether switching `field`'s granularity would discard any authored
 * linkage literal anywhere in `schema` (own `assign`, same-scope `set_field`
 * targeting `field.key`, same-scope condition leaf values referencing
 * `field.key`, across matching device presentations and root-scope
 * `schema.linkage`). Drives the confirmation prompt before dropping data.
 */
export function hasAuthoredDateLiteralsInSchema(schema: FormSchema, field: DateGranularityField): boolean {
  const location = findFieldLocation(schema, field.id);

  if (!location) {
    return linkageHasAuthoredDateLiteral(field.linkage, field.key, true);
  }

  const { device, scope } = location;
  const layer = resolvePresentation(schema, device);

  if (layer && layerHasAuthoredDateLiterals(layer, scope, field.key, field.id)) {
    return true;
  }

  const otherDevice: PresentationDevice = device === "pc" ? "mobile" : "pc";
  const otherLayer = resolvePresentation(schema, otherDevice);
  const twin = otherLayer ? findMatchingTwin(otherLayer, scope, field.key, field.type) : undefined;

  if (otherLayer && twin && layerHasAuthoredDateLiterals(otherLayer, scope, field.key, twin.id)) {
    return true;
  }

  const pcRootAffected = scope.length === 0 && (device === "pc" || twin !== undefined);

  return pcRootAffected && linkageHasAuthoredDateLiteral(schema.linkage, field.key, false);
}

interface LayerGranularityTarget {
  scope: ScopePath;
  fieldId: string;
  key: string;
  fieldType: "date" | "daterange";
  nextGranularity: DateGranularity;
}

function reconcileLayerDateGranularity(
  layer: PresentationLayer,
  target: LayerGranularityTarget
): PresentationLayer {
  const {
    fieldId: targetFieldId,
    fieldType,
    key: targetKey,
    nextGranularity,
    scope: targetScope
  } = target;

  function walk(blocks: Block[], scope: ScopePath): Block[] {
    return mapPreservingIdentity(blocks, block => {
      let next = block;

      if (scopeEquals(scope, targetScope)) {
        if (next.id === targetFieldId && isLeafField(next) && (next.type === "date" || next.type === "daterange")) {
          next = applyDateGranularityToField(next, nextGranularity);
        } else if (next.linkage !== undefined) {
          const linkage = scrubLinkageDateLiterals(next.linkage, targetKey, fieldType, nextGranularity, false);

          if (linkage !== next.linkage) {
            next = { ...next, linkage };
          }
        }
      }

      if (!isContainerNode(next)) {
        return next;
      }

      const bodyKey = bodyScopeKey(next);
      const inner = bodyKey === undefined ? scope : [...scope, bodyKey];

      return rewriteContainerBodies(next, body => walk(body, inner));
    });
  }

  const children = walk(layer.children, []);

  return children === layer.children ? layer : { ...layer, children };
}

/**
 * Switch a date / daterange field's granularity across the whole schema:
 * updates the field (and its same-key, same-type twin on the other device
 * presentation so PC and mobile never drift on granularity), and scrubs every
 * incompatible linkage literal targeting the field in its value scope (and in
 * root-scope `schema.linkage` when the PC root field changed).
 *
 * Identity-preserving: returns `schema` unchanged when nothing differed.
 */
export function reconcileDateGranularityInSchema(
  schema: FormSchema,
  fieldId: string,
  nextGranularity: DateGranularity
): FormSchema {
  const location = findFieldLocation(schema, fieldId);

  if (!location) {
    return schema;
  }

  const {
    device,
    field,
    scope
  } = location;
  const layer = resolvePresentation(schema, device);

  if (!layer) {
    return schema;
  }

  let nextSchema = schema;
  const nextLayer = reconcileLayerDateGranularity(layer, {
    scope,
    fieldId: field.id,
    key: field.key,
    fieldType: field.type,
    nextGranularity
  });

  if (nextLayer !== layer) {
    nextSchema = withPresentation(nextSchema, device, nextLayer);
  }

  const otherDevice: PresentationDevice = device === "pc" ? "mobile" : "pc";
  const otherLayer = resolvePresentation(nextSchema, otherDevice);
  const twin = otherLayer ? findMatchingTwin(otherLayer, scope, field.key, field.type) : undefined;

  if (otherLayer && twin) {
    const nextOtherLayer = reconcileLayerDateGranularity(otherLayer, {
      scope,
      fieldId: twin.id,
      key: field.key,
      fieldType: field.type,
      nextGranularity
    });

    if (nextOtherLayer !== otherLayer) {
      nextSchema = withPresentation(nextSchema, otherDevice, nextOtherLayer);
    }
  }

  const pcRootAffected = scope.length === 0 && (device === "pc" || twin !== undefined);

  if (pcRootAffected && nextSchema.linkage !== undefined) {
    const linkage = scrubLinkageDateLiterals(nextSchema.linkage, field.key, field.type, nextGranularity, false);

    if (linkage !== nextSchema.linkage) {
      nextSchema = { ...nextSchema, linkage };
    }
  }

  return nextSchema;
}
